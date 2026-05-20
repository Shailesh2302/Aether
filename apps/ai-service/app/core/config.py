from pydantic_settings import BaseSettings
from typing import Optional, List
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "OmniMind AI Service"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    API_V1_PREFIX: str = "/api/v1"

    NVIDIA_API_KEY: str = "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"
    NVIDIA_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    NVIDIA_CHAT_MODEL: str = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"
    NVIDIA_EMBEDDING_MODEL: str = "nvidia/nv-embed-v1"
    
    QDRANT_HOST: str = "2e308c4b-9092-44ce-b8fd-206f1fc3294e.sa-east-1-0.aws.cloud.qdrant.io"
    QDRANT_PORT: int = 6333
    QDRANT_GRPC_PORT: int = 6334
    QDRANT_COLLECTION: str = "omnimind"
    QDRANT_API_KEY: str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIiwic3ViamVjdCI6ImFwaS1rZXk6M2ZkYzE1YzYtNGYwMC00ODRhLWIxNGEtMDhkMGZiOWQxN2UwIn0.lwb1EbZvxlS2rkZcTj0W5bYpW7YC7-5bMZUghjVsjj0"

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