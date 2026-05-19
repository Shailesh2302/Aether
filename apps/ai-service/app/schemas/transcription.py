from pydantic import BaseModel, Field
from typing import Optional, List


class TranscriptionRequest(BaseModel):
    audio_path: str = Field(..., min_length=1)
    language: Optional[str] = None
    model: Optional[str] = "base"


class TranscriptionSegment(BaseModel):
    id: int
    start: float
    end: float
    text: str


class TranscriptionResponse(BaseModel):
    text: str
    segments: List[TranscriptionSegment] = []
    language: str
    duration: Optional[float] = None