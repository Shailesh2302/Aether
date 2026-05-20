from typing import Optional, List
import asyncio

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from app.api.dependencies import API_KEY_DEP
from app.core.logger import app_logger
from app.schemas.chat import ChatRequest, ChatResponse, StreamChatRequest, Source
from app.services.rag_service import RAGService, Source as RAGSource
from app.services.llm_service import LLMService

router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    user_id: str = Query(..., description="User ID for RAG context"),
    file_id: Optional[str] = Query(None, description="Specific file ID to search within"),
    api_key: API_KEY_DEP = None,
) -> ChatResponse:
    rag_service = RAGService()
    llm_service = LLMService()

    sources = []
    context = ""

    if user_id:
        rag_context = await rag_service.get_relevant_context(
            query=request.message,
            user_id=user_id,
            collection=request.collection,
            file_id=file_id,
            limit=request.top_k or 5,
        )

        context = rag_context.context
        sources = [
            {
                "file_id": src.file_id,
                "text": src.text,
                "score": src.score,
                "metadata": src.metadata or {},
            }
            for src in rag_context.sources
        ]

    base_system = request.system_prompt or ""
    if context:
        enhanced_system = (
            f"{base_system}\n\nRelevant context from documents:\n{context}"
            if base_system
            else f"You are a helpful assistant. Use the following context to answer questions:\n\n{context}"
        )
    else:
        enhanced_system = base_system

    response = await llm_service.generate_response(
        query=request.message,
        context=context,
        system_prompt=enhanced_system,
    )

    return ChatResponse(
        message=response,
        sources=sources,
        metadata={
            "collection": request.collection or f"user:{user_id}",
            "file_id": file_id,
            "user_id": user_id,
            "chunks_retrieved": len(sources),
        },
    )


@router.post("/chat/stream")
async def stream_chat(
    request: StreamChatRequest,
    user_id: str = Query(..., description="User ID for RAG context"),
    file_id: Optional[str] = Query(None, description="Specific file ID to search within"),
    api_key: API_KEY_DEP = None,
) -> StreamingResponse:
    rag_service = RAGService()
    llm_service = LLMService()

    context = ""
    if user_id:
        rag_context = await rag_service.get_relevant_context(
            query=request.message,
            user_id=user_id,
            collection=request.collection,
            file_id=file_id,
            limit=request.top_k or 5,
        )
        context = rag_context.context

    base_system = request.system_prompt or ""
    if context:
        enhanced_system = (
            f"{base_system}\n\nRelevant context from documents:\n{context}"
            if base_system
            else f"You are a helpful assistant. Use the following context to answer questions:\n\n{context}"
        )
    else:
        enhanced_system = base_system

    async def generate():
        async for chunk in llm_service.generate_stream(
            query=request.message,
            context=context,
            system_prompt=enhanced_system,
        ):
            yield f"data: {chunk}\n\n"
            await asyncio.sleep(0.01)
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )


@router.post("/chat/simple")
async def simple_chat(
    request: ChatRequest,
    api_key: API_KEY_DEP = None,
) -> ChatResponse:
    llm_service = LLMService()

    response = await llm_service.generate_response(
        query=request.message,
        context="",
        system_prompt=request.system_prompt,
    )

    return ChatResponse(
        message=response,
        sources=[],
        metadata={},
    )


@router.get("/chat/history/{user_id}")
async def get_chat_history(
    user_id: str,
    limit: int = Query(10, ge=1, le=100),
    api_key: API_KEY_DEP = None,
) -> dict:
    return {
        "user_id": user_id,
        "history": [],
        "message": "Chat history not yet implemented",
    }