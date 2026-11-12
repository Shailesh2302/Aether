from pydantic_settings import BaseSettings
from typing import Optional, List
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "Aether AI Service"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    API_V1_PREFIX: str = "/api/v1"

    NVIDIA_API_KEY: str = ""
    NVIDIA_BASE_URL: str = "https://openrouter.ai/api/v1"
    NVIDIA_CHAT_MODEL: str = "openai/gpt-4o-mini"
    NVIDIA_EMBEDDING_MODEL: str = "openai/text-embedding-3-small"
    EMBEDDING_DIMENSION: int = 1536
    LLM_MAX_TOKENS: int = 2048
    LLM_TIMEOUT_SECONDS: float = 180.0
    LLM_REASONING_EFFORT: str = "low"
    LLM_JSON_MODE: bool = False
    
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    QDRANT_GRPC_PORT: int = 6334
    QDRANT_API_KEY: str = ""


    WHISPER_MODEL: str = "base"
    WHISPER_DEVICE: str = "cpu"
    WHISPER_BEAM_SIZE: int = 2
    WHISPER_CONCURRENCY: int = 1
    WHISPER_VAD_FILTER: bool = True
    WHISPER_WARMUP: bool = True
    WHISPER_CPU_THREADS: int = 0

    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 100


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