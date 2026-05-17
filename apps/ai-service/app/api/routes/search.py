from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import API_KEY_DEP
from app.schemas.search import SearchRequest, SearchResponse, SearchResult
from app.services.vector_service import VectorService
from app.services.embedding_service import EmbeddingService

router = APIRouter(tags=["search"])

vector_service = VectorService()
embedding_service = EmbeddingService()


@router.post("/search", response_model=SearchResponse)
async def semantic_search(
    request: SearchRequest,
    api_key: API_KEY_DEP,
) -> SearchResponse:
    try:
        query_embedding = await embedding_service.embed_text(request.query)

        results = await vector_service.search(
            query_embedding=query_embedding,
            collection_name=request.collection or "default",
            limit=request.limit or 10,
            score_threshold=request.score_threshold or 0.0,
            filter_conditions=request.filter,
        )

        search_results = [
            SearchResult(
                id=result["id"],
                score=result["score"],
                text=result["payload"].get("text", ""),
                metadata=result["payload"].get("metadata", {}),
            )
            for result in results
        ]

        return SearchResponse(
            results=search_results,
            total=len(search_results),
            query=request.query,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search/index")
async def index_document(
    request: SearchRequest,
    api_key: API_KEY_DEP,
) -> dict:
    try:
        query_embedding = await embedding_service.embed_text(request.query)

        await vector_service.insert(
            vectors=[query_embedding],
            collection_name=request.collection or "default",
            payloads=[{"text": request.query, "metadata": request.filter or {}}],
            ids=[None],
        )

        return {"status": "indexed", "collection": request.collection or "default"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/search/collection/{collection_name}")
async def delete_collection(
    collection_name: str,
    api_key: API_KEY_DEP,
) -> dict:
    try:
        await vector_service.delete_collection(collection_name)
        return {"status": "deleted", "collection": collection_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))