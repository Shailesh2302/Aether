from typing import Optional, List
from dataclasses import dataclass
import asyncio
import tempfile
import threading
import time
import wave

from faster_whisper import WhisperModel

from app.core.config import get_settings
from app.core.logger import app_logger

settings = get_settings()

COMMAND_PROMPT = (
    "Short voice commands: play, pause, resume, stop, next video, previous video, "
    "mute, unmute, volume up, volume down, seek forward, seek backward, go back, "
    "show highlights, show moments, open smart clips, create clip, download, share, "
    "fullscreen, exit fullscreen, search, go to dashboard, go to files, go to settings."
)


@dataclass
class TranscriptionSegment:
    start_sec: float
    end_sec: float
    text: str


@dataclass
class TranscriptionResult:
    text: str
    segments: List[TranscriptionSegment]
    language: str
    duration_sec: float


class WhisperService:
    def __init__(self):
        self.model_name = settings.WHISPER_MODEL
        self.device = settings.WHISPER_DEVICE
        self._model = None
        self._model_lock = threading.Lock()
        self._semaphore: Optional[asyncio.Semaphore] = None
        app_logger.info(f"Whisper Service initialized with model: {self.model_name}")

    @property
    def model(self) -> WhisperModel:
        # Double-checked locking: model load can be triggered concurrently from
        # worker threads (e.g. warmup racing the first real request).
        if self._model is None:
            with self._model_lock:
                if self._model is None:
                    app_logger.info(f"Loading Whisper model: {self.model_name}")
                    started = time.monotonic()
                    kwargs = {
                        "device": self.device,
                        "compute_type": "float16" if self.device == "cuda" else "int8",
                        "num_workers": 1,
                    }
                    if settings.WHISPER_CPU_THREADS > 0:
                        kwargs["cpu_threads"] = settings.WHISPER_CPU_THREADS
                    self._model = WhisperModel(self.model_name, **kwargs)
                    app_logger.info(
                        f"Whisper model loaded in {time.monotonic() - started:.2f}s: {self.model_name}"
                    )
        return self._model

    def _get_semaphore(self) -> asyncio.Semaphore:
        # Whisper inference is CPU-bound; keep the number of concurrent runs
        # bounded so a burst of requests cannot starve the event loop.
        if self._semaphore is None:
            self._semaphore = asyncio.Semaphore(max(1, settings.WHISPER_CONCURRENCY))
        return self._semaphore

    def get_available_models(self) -> List[str]:
        return ["tiny", "base", "small", "medium", "large-v3"]

    async def warmup(self) -> None:
        """Load the model and run a tiny inference so the first user request is fast."""
        started = time.monotonic()
        try:
            # Share the inference semaphore so warmup cannot run alongside a
            # real request on a single-core box.
            async with self._get_semaphore():
                await asyncio.to_thread(self._warmup_sync)
            app_logger.info(f"Whisper warmup complete in {time.monotonic() - started:.2f}s")
        except Exception as e:  # noqa: BLE001 - warmup must never crash startup
            app_logger.warning(f"Whisper warmup failed (model will load lazily): {e}")

    def _warmup_sync(self) -> None:
        model = self.model
        # 1 second of 16 kHz silence as a WAV file - avoids a numpy dependency.
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as tmp:
            with wave.open(tmp.name, "wb") as wav:
                wav.setnchannels(1)
                wav.setsampwidth(2)
                wav.setframerate(16000)
                wav.writeframes(b"\x00\x00" * 16000)
            segments, _info = model.transcribe(
                tmp.name,
                language="en",
                beam_size=1,
                vad_filter=False,
                condition_on_previous_text=False,
                without_timestamps=True,
            )
            for _ in segments:
                pass

    async def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
        task: str = "transcribe",
        command: bool = False,
        beam_size: Optional[int] = None,
        vad_filter: Optional[bool] = None,
    ) -> TranscriptionResult:
        """Transcribe an audio file.

        ``command`` enables the low-latency path used by the voice assistant:
        English-only, greedy decoding (beam 1), no timestamps and a prompt
        biased toward short navigation commands.
        """
        app_logger.info(
            f"Starting transcription for: {audio_path} "
            f"(command={command}, language={language or 'auto'})"
        )

        if command:
            language = language or "en"
            beam_size = 1 if beam_size is None else max(1, min(beam_size, 5))
        elif beam_size is None:
            beam_size = settings.WHISPER_BEAM_SIZE
        if vad_filter is None:
            vad_filter = settings.WHISPER_VAD_FILTER

        def _run_transcription():
            segments, info = self.model.transcribe(
                audio_path,
                language=language,
                task=task,
                beam_size=max(1, beam_size),
                word_timestamps=False,
                vad_filter=vad_filter,
                vad_parameters={"min_silence_duration_ms": 300 if command else 500},
                condition_on_previous_text=not command,
                without_timestamps=command,
                initial_prompt=COMMAND_PROMPT if command else None,
            )

            segment_list = []
            full_text_parts = []

            for seg in segments:
                text = seg.text.strip()
                if not text:
                    continue
                segment_list.append(
                    TranscriptionSegment(
                        start_sec=float(seg.start or 0.0),
                        end_sec=float(seg.end or 0.0),
                        text=text,
                    )
                )
                full_text_parts.append(text)

            return {
                "text": " ".join(full_text_parts).strip(),
                "segments": segment_list,
                "language": info.language if info.language else language or "en",
                "duration_sec": float(info.duration or 0.0),
            }

        async with self._get_semaphore():
            result = await asyncio.to_thread(_run_transcription)

        app_logger.info(
            f"Transcription complete: {len(result['segments'])} segments, "
            f"language: {result['language']}, duration: {result['duration_sec']:.2f}s"
        )

        return TranscriptionResult(
            text=result["text"],
            segments=result["segments"],
            language=result["language"],
            duration_sec=result["duration_sec"],
        )

    async def transcribe_file(
        self,
        file_path: str,
        language: Optional[str] = None,
        command: bool = False,
    ) -> TranscriptionResult:
        return await self.transcribe(file_path, language=language, command=command)


whisper_service = WhisperService()
