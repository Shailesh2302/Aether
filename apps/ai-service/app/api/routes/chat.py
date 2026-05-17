from typing import Optional, List
import asyncio

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.api.dependencies import API_KEY_DEP
from app.core.logger import app_logger
from app.schemas.chat import ChatRequest, ChatResponse, StreamChatRequest
from app.services.rag_service import RAGService
from app.services.llm_service import LLMService

router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    api_key: API_KEY_DEP,
) -> ChatResponse:
    rag_service = RAGService()
    llm_service = LLMService()

    context = await rag_service.get_relevant_context(
        query=request.message,
        collection=request.collection or "default",
        limit=request.top_k or 5,
    )

    response = await llm_service.generate_response(
        query=request.message,
        context=context,
        system_prompt=request.system_prompt,
    )

    return ChatResponse(
        message=response,
        sources=[],
        metadata={"collection": request.collection or "default"},
    )


@router.post("/chat/stream")
async def stream_chat(
    request: StreamChatRequest,
    api_key: API_KEY_DEP,
) -> StreamingResponse:
    rag_service = RAGService()
    llm_service = LLMService()

    context = await rag_service.get_relevant_context(
        query=request.message,
        collection=request.collection or "default",
        limit=request.top_k or 5,
    )

    async def generate():
        async for chunk in llm_service.generate_stream(
            query=request.message,
            context=context,
            system_prompt=request.system_prompt,
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
    api_key: API_KEY_DEP,
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