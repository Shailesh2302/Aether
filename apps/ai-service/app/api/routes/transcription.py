import tempfile
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse

from app.api.dependencies import API_KEY_DEP
from app.schemas.transcription import TranscriptionRequest, TranscriptionResponse
from app.services.whisper_service import WhisperService

router = APIRouter(tags=["transcription"])

whisper_service = WhisperService()


@router.post("/transcription", response_model=TranscriptionResponse)
async def transcribe_audio(
    file: UploadFile = File(...),
    language: Optional[str] = None,
    api_key: API_KEY_DEP = None,
) -> TranscriptionResponse:
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name

        try:
            result = await whisper_service.transcribe(
                audio_path=tmp_path,
                language=language,
            )

            return TranscriptionResponse(
                text=result["text"],
                language=result.get("language", "en"),
                duration=result.get("duration", 0.0),
                segments=result.get("segments", []),
            )
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/transcription/from-url", response_model=TranscriptionResponse)
async def transcribe_from_url(
    request: TranscriptionRequest,
    api_key: API_KEY_DEP = None,
) -> TranscriptionResponse:
    try:
        result = await whisper_service.transcribe(
            audio_path=request.url,
            language=request.language,
        )

        return TranscriptionResponse(
            text=result["text"],
            language=result.get("language", "en"),
            duration=result.get("duration", 0.0),
            segments=result.get("segments", []),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/transcription/models")
async def list_models(api_key: API_KEY_DEP = None) -> JSONResponse:
    models = whisper_service.get_available_models()

    return JSONResponse(
        content={
            "models": models,
            "current_model": whisper_service.model_name,
        }
    )