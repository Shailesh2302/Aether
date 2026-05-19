from pydantic import BaseModel, Field
from typing import Optional, List, Any


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    collection: Optional[str] = None
    limit: Optional[int] = Field(default=10, ge=1, le=100)
    score_threshold: Optional[float] = Field(default=0.0, ge=0.0, le=1.0)
    filter: Optional[dict] = None


class SearchResult(BaseModel):
    id: str
    score: float
    text: Optional[str] = None
    metadata: dict = {}


class SearchResponse(BaseModel):
    results: List[SearchResult]
    total: int
    query: str


class IndexRequest(BaseModel):
    text: str = Field(..., min_length=1)
    collection: Optional[str] = None
    filter: Optional[dict] = None