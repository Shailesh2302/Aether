from pydantic_settings import BaseSettings
from typing import Optional
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "OmniMind AI Service"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    API_V1_PREFIX: str = "/api/v1"

    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4-turbo-preview"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"

    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    QDRANT_GRPC_PORT: int = 6334
    QDRANT_COLLECTION: str = "omnimind"
    QDRANT_API_KEY: Optional[str] = None

    SENTENCE_TRANSFORMER_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"

    WHISPER_MODEL: str = "base"
    WHISPER_DEVICE: str = "cpu"

    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200

    MAX_CHUNK_LENGTH: int = 8192

    SECURITY_API_KEY: Optional[str] = None
    SECURITY_ENABLED: bool = False

    LOG_LEVEL: str = "INFO"

    CORS_ORIGINS: list = ["*"]

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()