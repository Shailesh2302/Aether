import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.logger import app_logger
from app.services.whisper_service import whisper_service

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    app_logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")

    # Warm Whisper in the background so the first voice command does not pay
    # the model-load cost. It runs in a worker thread and never blocks startup.
    warmup_task: asyncio.Task | None = None
    if settings.WHISPER_WARMUP:
        warmup_task = asyncio.create_task(whisper_service.warmup())

    yield

    if warmup_task is not None and not warmup_task.done():
        warmup_task.cancel()
        try:
            await warmup_task
        except asyncio.CancelledError:
            pass
        except Exception:
            pass
    app_logger.info(f"Shutting down {settings.APP_NAME}")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
    lifespan=lifespan,
)

wildcard_origins = "*" in settings.CORS_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if wildcard_origins else settings.CORS_ORIGINS,
    allow_credentials=not wildcard_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.routes import chat, embeddings, search, transcription, health, documents, video_intelligence, import_media


app.include_router(health.router, prefix=settings.API_V1_PREFIX)
app.include_router(chat.router, prefix=settings.API_V1_PREFIX)
app.include_router(embeddings.router, prefix=settings.API_V1_PREFIX)
app.include_router(search.router, prefix=settings.API_V1_PREFIX)
app.include_router(transcription.router, prefix=settings.API_V1_PREFIX)
app.include_router(documents.router, prefix=settings.API_V1_PREFIX)
app.include_router(video_intelligence.router, prefix=settings.API_V1_PREFIX)
app.include_router(import_media.router, prefix=settings.API_V1_PREFIX)
