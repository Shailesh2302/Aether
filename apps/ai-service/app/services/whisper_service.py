from typing import Optional, List
from dataclasses import dataclass
import asyncio
from faster_whisper import WhisperModel
from app.core.config import get_settings
from app.core.logger import app_logger

settings = get_settings()


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
        app_logger.info(f"Whisper Service initialized with model: {self.model_name}")

    @property
    def model(self):
        if self._model is None:
            app_logger.info(f"Loading Whisper model: {self.model_name}")
            self._model = WhisperModel(
                self.model_name,
                device=self.device,
                compute_type="float16" if self.device == "cuda" else "int8",
            )
            app_logger.info(f"Whisper model loaded: {self.model_name}")
        return self._model

    def get_available_models(self) -> List[str]:
        return ["tiny", "base", "small", "medium", "large-v3"]

    async def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
        task: str = "transcribe",
    ) -> TranscriptionResult:
        app_logger.info(f"Starting transcription for: {audio_path}")

        def _run_transcription():
            segments, info = self.model.transcribe(
                audio_path,
                language=language,
                task=task,
                beam_size=5,
                word_timestamps=False,
            )

            segment_list = []
            full_text = ""

            for seg in segments:
                segment_list.append(
                    TranscriptionSegment(
                        start_sec=seg.start,
                        end_sec=seg.end,
                        text=seg.text.strip(),
                    )
                )
                full_text += seg.text.strip() + " "

            return {
                "text": full_text.strip(),
                "segments": segment_list,
                "language": info.language if info.language else language or "en",
                "duration_sec": info.duration or 0.0,
            }

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
    ) -> TranscriptionResult:
        return await self.transcribe(file_path, language)


whisper_service = WhisperService()