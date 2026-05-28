from pydantic_settings import BaseSettings
from typing import Optional, List
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "Aether AI Service"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    API_V1_PREFIX: str = "/api/v1"

    NVIDIA_API_KEY: str = ""
    NVIDIA_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    NVIDIA_CHAT_MODEL: str = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"
    NVIDIA_EMBEDDING_MODEL: str = "nvidia/nv-embed-v1"
    
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    QDRANT_GRPC_PORT: int = 6334
    QDRANT_COLLECTION: str = "aether"
    QDRANT_API_KEY: str = ""

    SENTENCE_TRANSFORMER_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"

    WHISPER_MODEL: str = "base"
    WHISPER_DEVICE: str = "cpu"

    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 100

    MAX_CHUNK_LENGTH: int = 8192

    SECURITY_API_KEY: Optional[str] = None
    SECURITY_ENABLED: bool = False

    LOG_LEVEL: str = "INFO"

    CORS_ORIGINS: List[str] = ["*"]

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()