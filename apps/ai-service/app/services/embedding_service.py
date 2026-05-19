import os
from typing import List, Union
from openai import AsyncOpenAI
from app.core.config import get_settings
from app.core.logger import app_logger

settings = get_settings()


class EmbeddingService:
    def __init__(self):
        self.client = AsyncOpenAI(
            base_url=settings.NVIDIA_BASE_URL,
            api_key=settings.NVIDIA_API_KEY,
        )
        self.model = settings.NVIDIA_EMBEDDING_MODEL
        app_logger.info(f"Embedding Service initialized with model: {self.model}")

    @property
    def model_name(self) -> str:
        return self.model

    async def embed_text(self, text: str) -> List[float]:
        try:
            response = await self.client.embeddings.create(
                model=self.model,
                input=text,
            )
            return response.data[0].embedding
        except Exception as e:
            app_logger.error(f"Embedding error for text: {e}")
            raise

    async def embedTexts(self, texts: List[str]) -> List[List[float]]:
        try:
            response = await self.client.embeddings.create(
                model=self.model,
                input=texts,
            )
            return [item.embedding for item in response.data]
        except Exception as e:
            app_logger.error(f"Batch embedding error: {e}")
            raise

    async def embed_query(self, query: str) -> List[float]:
        return await self.embed_text(query)

    async def embed_documents(self, documents: List[str]) -> List[List[float]]:
        return await self.embedTexts(documents)


embedding_service = EmbeddingService()