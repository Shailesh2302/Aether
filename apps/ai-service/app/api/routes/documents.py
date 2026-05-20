import tempfile
import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel

from app.api.dependencies import API_KEY_DEP
from app.core.logger import app_logger
from app.services.document_service import document_service
from app.services.pipeline import pipeline
from app.services.rag_service import rag_service

router = APIRouter(tags=["documents"])


class DocumentExtractResponse(BaseModel):
    text: str
    chunks: list
    metadata: dict


class DocumentIndexResponse(BaseModel):
    status: str
    file_id: str
    chunks_indexed: int
    collection: str


@router.post("/documents/extract", response_model=DocumentExtractResponse)
async def extract_document(
    file: UploadFile = File(...),
    api_key: API_KEY_DEP = None,
) -> DocumentExtractResponse:
    try:
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=os.path.splitext(file.filename)[1]
        ) as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name

        try:
            mime_type = file.content_type or None
            result = await document_service.extract(tmp_path, mime_type)

            return DocumentExtractResponse(
                text=result.text,
                chunks=result.chunks,
                metadata=result.metadata,
            )
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    except Exception as e:
        app_logger.error(f"Error extracting document: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class DocumentIndexRequest(BaseModel):
    file_id: str
    file_path: str
    user_id: str
    mime_type: Optional[str] = None
    collection: Optional[str] = None


@router.post("/documents/index", response_model=DocumentIndexResponse)
async def index_document(
    request: DocumentIndexRequest,
    api_key: API_KEY_DEP = None,
) -> DocumentIndexResponse:
    if not request.file_id or not request.user_id:
        raise HTTPException(status_code=400, detail="file_id and user_id are required")

    if not request.file_path:
        raise HTTPException(status_code=400, detail="file_path is required")

    if not os.path.exists(request.file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {request.file_path}")

    try:
        result = await pipeline.process_document(
            file_path=request.file_path,
            file_id=request.file_id,
            user_id=request.user_id,
            mime_type=request.mime_type,
        )

        return DocumentIndexResponse(
            status=result["status"],
            file_id=result["file_id"],
            chunks_indexed=result["chunks_indexed"],
            collection=result["collection"],
        )

    except Exception as e:
        app_logger.error(f"Error indexing document: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/documents/{file_id}")
async def delete_document(
    file_id: str,
    user_id: str,
    collection: Optional[str] = None,
    api_key: API_KEY_DEP = None,
) -> dict:
    try:
        collection = collection or f"user_{user_id}"
        success = await rag_service.delete_file(user_id, file_id)

        if success:
            return {"status": "deleted", "file_id": file_id, "collection": collection}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete document")

    except Exception as e:
        app_logger.error(f"Error deleting document: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/documents/types")
async def get_supported_types(api_key: API_KEY_DEP = None) -> dict:
    return {
        "supported_types": [
            {"mime": "application/pdf", "extension": ".pdf", "name": "PDF"},
            {
                "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "extension": ".docx",
                "name": "Word Document",
            },
            {
                "mime": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "extension": ".xlsx",
                "name": "Excel Spreadsheet",
            },
            {"mime": "text/plain", "extension": ".txt", "name": "Text File"},
        ]
    }