from pydantic import BaseModel, Field
from typing import Optional, List


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    collection: Optional[str] = None
    top_k: Optional[int] = Field(default=5, ge=1, le=20)
    system_prompt: Optional[str] = None


class StreamChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    collection: Optional[str] = None
    top_k: Optional[int] = Field(default=5, ge=1, le=20)
    system_prompt: Optional[str] = None


class ChatResponse(BaseModel):
    message: str
    sources: List[dict] = []
    metadata: dict = {}


class Source(BaseModel):
    file_id: Optional[str] = None
    text: Optional[str] = None
    score: Optional[float] = None
    metadata: dict = {}