import json
import re
import asyncio
from typing import Optional, List, Any, AsyncGenerator
from openai import AsyncOpenAI
from app.core.config import get_settings
from app.core.logger import app_logger

settings = get_settings()

MAX_LLM_RETRIES = 3
RETRYABLE_STATUS = {408, 409, 429, 500, 502, 503, 504}

_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL | re.IGNORECASE)
_TRAILING_COMMA_RE = re.compile(r",\s*([}\]])")


def extract_json(text: str) -> Optional[Any]:
    """Best-effort extraction of a JSON object/array from an LLM response.

    Handles markdown fences, leading/trailing prose, and trailing commas. Returns
    ``None`` when no valid JSON can be recovered.
    """
    if not text:
        return None

    candidates: List[str] = []
    stripped = text.strip()
    candidates.append(stripped)

    fence = _FENCE_RE.search(stripped)
    if fence:
        candidates.append(fence.group(1).strip())

    # Slice from the first opening brace/bracket to the last matching closer.
    starts = [i for i in (stripped.find("{"), stripped.find("[")) if i != -1]
    if starts:
        start = min(starts)
        end = max(stripped.rfind("}"), stripped.rfind("]"))
        if end > start:
            candidates.append(stripped[start:end + 1])

    for candidate in candidates:
        for value in (candidate, _TRAILING_COMMA_RE.sub(r"\1", candidate)):
            try:
                return json.loads(value)
            except (json.JSONDecodeError, TypeError):
                continue

    app_logger.warning("Could not extract JSON from LLM response")
    return None


async def _with_retries(fn, *args, **kwargs):
    """Retry transient provider failures (network_error / 429 / 5xx) with backoff."""
    last_err: Exception | None = None
    for attempt in range(1, MAX_LLM_RETRIES + 1):
        try:
            return await fn(*args, **kwargs)
        except Exception as e:  # noqa: BLE001 - inspect and re-raise if not retryable
            status = getattr(e, "status_code", None) or getattr(getattr(e, "response", None), "status_code", None)
            retryable = status in RETRYABLE_STATUS or status is None
            if not retryable or attempt == MAX_LLM_RETRIES:
                raise
            last_err = e
            delay = 2 ** (attempt - 1)
            app_logger.warning(f"LLM call failed (attempt {attempt}), retrying in {delay}s: {e}")
            await asyncio.sleep(delay)
    raise last_err  # pragma: no cover


class LLMService:
    def __init__(self):
        self._client: Optional[AsyncOpenAI] = None
        self.model = settings.NVIDIA_CHAT_MODEL
        app_logger.info(f"LLM Service initialized with model: {self.model}")

    @property
    def client(self) -> AsyncOpenAI:
        if self._client is None:
            if not settings.NVIDIA_API_KEY:
                app_logger.warning("NVIDIA_API_KEY not set - LLM calls will fail at runtime")
            self._client = AsyncOpenAI(
                base_url=settings.NVIDIA_BASE_URL,
                api_key=settings.NVIDIA_API_KEY,
                timeout=settings.LLM_TIMEOUT_SECONDS,
            )
        return self._client

    def _request_kwargs(
        self,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        max_tokens: Optional[int] = None,
        json_mode: bool = False,
    ) -> dict:
        kwargs: dict = {
            "temperature": 0.6 if temperature is None else temperature,
            "top_p": 0.95 if top_p is None else top_p,
            "max_tokens": max_tokens or settings.LLM_MAX_TOKENS,
        }
        if json_mode and settings.LLM_JSON_MODE:
            kwargs["response_format"] = {"type": "json_object"}
        if settings.LLM_REASONING_EFFORT != "high":
            kwargs["extra_body"] = {
                "reasoning": {
                    "effort": settings.LLM_REASONING_EFFORT,
                    "exclude": True,
                }
            }
        return kwargs

    async def generate_response(
        self,
        query: str,
        context: str = "",
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        json_mode: bool = False,
    ) -> str:
        messages = []

        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        elif context:
            messages.append({
                "role": "system",
                "content": f"You are a helpful assistant. Use the following context to answer questions.\n\nContext:\n{context}"
            })
        else:
            messages.append({
                "role": "system",
                "content": "You are a helpful assistant."
            })

        messages.append({"role": "user", "content": query})

        try:
            response = await _with_retries(
                self.client.chat.completions.create,
                model=self.model,
                messages=messages,
                **self._request_kwargs(
                    temperature=temperature,
                    max_tokens=max_tokens,
                    json_mode=json_mode,
                ),
            )

            message = response.choices[0].message
            return (message.content or "").strip() or "(no content)"
        except Exception as e:
            app_logger.error(f"LLM generate_response error: {e}")
            raise

    async def generate_stream(
        self,
        query: str,
        context: str = "",
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> AsyncGenerator[str, None]:
        messages = []

        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        elif context:
            messages.append({
                "role": "system",
                "content": f"You are a helpful assistant. Use the following context to answer questions.\n\nContext:\n{context}"
            })
        else:
            messages.append({
                "role": "system",
                "content": "You are a helpful assistant."
            })

        messages.append({"role": "user", "content": query})

        try:
            stream = await _with_retries(
                self.client.chat.completions.create,
                model=self.model,
                messages=messages,
                stream=True,
                **self._request_kwargs(
                    temperature=temperature,
                    max_tokens=max_tokens,
                ),
            )

            async for chunk in stream:
                content = chunk.choices[0].delta.content
                if content:
                    yield content
        except Exception as e:
            app_logger.error(f"LLM generate_stream error: {e}")
            raise

    async def generate_with_history(
        self,
        messages: List[dict],
        context: str = "",
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        json_mode: bool = False,
    ) -> str:
        processed_messages = []
        
        if context:
            processed_messages.append({
                "role": "system",
                "content": f"Use the following context to answer:\n\n{context}"
            })
        
        processed_messages.extend(messages)

        try:
            response = await _with_retries(
                self.client.chat.completions.create,
                model=self.model,
                messages=processed_messages,
                **self._request_kwargs(
                    temperature=temperature,
                    max_tokens=max_tokens,
                    json_mode=json_mode,
                ),
            )

            return response.choices[0].message.content or ""
        except Exception as e:
            app_logger.error(f"LLM generate_with_history error: {e}")
            raise


llm_service = LLMService()