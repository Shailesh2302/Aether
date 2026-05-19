from pydantic import BaseModel, Field
from typing import Optional, List


class EmbeddingRequest(BaseModel):
    text: str = Field(..., min_length=1)
    model: Optional[str] = None


class EmbeddingResponse(BaseModel):
    embedding: List[float]
    model: str
    dimensions: int
    usage: dict = {}


class BatchEmbeddingRequest(BaseModel):
    texts: List[str] = Field(..., min_items=1)
    model: Optional[str] = None