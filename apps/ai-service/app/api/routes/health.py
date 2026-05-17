from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.api.dependencies import API_KEY_DEP
from app.core.config import get_settings
from app.core.logger import app_logger
from app.services.rag_service import RAGService

settings = get_settings()

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check(api_key: API_KEY_DEP) -> JSONResponse:
    return JSONResponse(
        content={
            "status": "healthy",
            "service": settings.APP_NAME,
            "version": settings.APP_VERSION,
        }
    )


@router.get("/health/ready")
async def readiness_check(api_key: API_KEY_DEP) -> JSONResponse:
    try:
        rag_service = RAGService()
        collections = await rag_service.get_collections()

        return JSONResponse(
            content={
                "status": "ready",
                "qdrant_connected": True,
                "collections": collections,
            }
        )
    except Exception as e:
        app_logger.error(f"Readiness check failed: {str(e)}")
        return JSONResponse(
            content={
                "status": "not ready",
                "error": str(e),
            },
            status_code=503,
        )