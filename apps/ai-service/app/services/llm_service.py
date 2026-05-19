import os
import asyncio
from typing import Optional, List, AsyncGenerator
from openai import AsyncOpenAI
from app.core.config import get_settings
from app.core.logger import app_logger

settings = get_settings()


class LLMService:
    def __init__(self):
        self.client = AsyncOpenAI(
            base_url=settings.NVIDIA_BASE_URL,
            api_key=settings.NVIDIA_API_KEY,
        )
        self.model = settings.NVIDIA_CHAT_MODEL
        app_logger.info(f"LLM Service initialized with model: {self.model}")

    async def generate_response(
        self,
        query: str,
        context: str = "",
        system_prompt: Optional[str] = None,
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
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.6,
                top_p=0.95,
                max_tokens=4096,
                extra_body={
                    "chat_template_kwargs": {"enable_thinking": True},
                    "reasoning_budget": 16384,
                },
            )

            return response.choices[0].message.content or ""
        except Exception as e:
            app_logger.error(f"LLM generate_response error: {e}")
            raise

    async def generate_stream(
        self,
        query: str,
        context: str = "",
        system_prompt: Optional[str] = None,
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
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.6,
                top_p=0.95,
                max_tokens=4096,
                stream=True,
                extra_body={
                    "chat_template_kwargs": {"enable_thinking": True},
                    "reasoning_budget": 16384,
                },
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
    ) -> str:
        processed_messages = []
        
        if context:
            processed_messages.append({
                "role": "system",
                "content": f"Use the following context to answer:\n\n{context}"
            })
        
        processed_messages.extend(messages)

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=processed_messages,
                temperature=0.6,
                top_p=0.95,
                max_tokens=4096,
                extra_body={
                    "chat_template_kwargs": {"enable_thinking": True},
                    "reasoning_budget": 16384,
                },
            )

            return response.choices[0].message.content or ""
        except Exception as e:
            app_logger.error(f"LLM generate_with_history error: {e}")
            raise


llm_service = LLMService()