from typing import List, Union

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import API_KEY_DEP
from app.schemas.embeddings import EmbeddingRequest, EmbeddingResponse, BatchEmbeddingRequest
from app.services.embedding_service import EmbeddingService

router = APIRouter(tags=["embeddings"])

embedding_service = EmbeddingService()


@router.post("/embeddings", response_model=EmbeddingResponse)
async def generate_embedding(
    request: EmbeddingRequest,
    api_key: API_KEY_DEP,
) -> EmbeddingResponse:
    try:
        embedding = await embedding_service.embed_text(request.text)

        return EmbeddingResponse(
            embedding=embedding,
            model=embedding_service.model_name,
            dimensions=len(embedding),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/embeddings/batch", response_model=List[EmbeddingResponse])
async def generate_batch_embeddings(
    request: BatchEmbeddingRequest,
    api_key: API_KEY_DEP,
) -> List[EmbeddingResponse]:
    try:
        embeddings = await embedding_service.embed_texts(request.texts)

        return [
            EmbeddingResponse(
                embedding=emb,
                model=embedding_service.model_name,
                dimensions=len(emb),
            )
            for emb in embeddings
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/embeddings/documents")
async def embed_documents(
    request: EmbeddingRequest,
    api_key: API_KEY_DEP,
) -> EmbeddingResponse:
    try:
        from app.loaders import pdf_loader, docx_loader, excel_loader

        chunks = []

        if request.text.endswith(".pdf"):
            chunks = await pdf_loader.load_file(request.text)
        elif request.text.endswith((".doc", ".docx")):
            chunks = await docx_loader.load_file(request.text)
        elif request.text.endswith((".xls", ".xlsx")):
            chunks = await excel_loader.load_file(request.text)

        if chunks:
            embeddings = await embedding_service.embed_texts(chunks)
            return EmbeddingResponse(
                embedding=embeddings[0],
                model=embedding_service.model_name,
                dimensions=len(embeddings[0]),
            )

        embedding = await embedding_service.embed_text(request.text)
        return EmbeddingResponse(
            embedding=embedding,
            model=embedding_service.model_name,
            dimensions=len(embedding),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))