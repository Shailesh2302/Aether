from typing import List, Optional, Dict, Any
from app.services.embedding_service import embedding_service
from app.services.vector_service import vector_service
from app.core.logger import app_logger


class RAGService:
    def __init__(self):
        app_logger.info("RAG Service initialized")

    async def get_relevant_context(
        self,
        query: str,
        collection: str = "default",
        limit: int = 5,
    ) -> str:
        try:
            query_embedding = await embedding_service.embed_query(query)
            
            results = await vector_service.search(
                collection_name=collection,
                query_embedding=query_embedding,
                limit=limit,
                score_threshold=0.3,
            )

            if not results:
                return ""

            context_parts = []
            for result in results:
                text = result.get("payload", {}).get("text", "")
                if text:
                    context_parts.append(text)

            return "\n\n".join(context_parts)
        except Exception as e:
            app_logger.error(f"Error getting relevant context: {e}")
            return ""

    async def index_document(
        self,
        collection: str,
        document_id: str,
        text: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> bool:
        try:
            exists = await vector_service.collection_exists(collection)
            if not exists:
                await vector_service.create_collection(collection, 1536)

            chunks = self._chunk_text(text, chunk_size=1000, overlap=200)
            
            embeddings = await embedding_service.embed_documents(chunks)

            payloads = [
                {
                    "text": chunk,
                    "document_id": document_id,
                    **(metadata or {}),
                }
                for chunk in chunks
            ]

            await vector_service.insert(
                collection_name=collection,
                vectors=embeddings,
                payloads=payloads,
            )

            app_logger.info(f"Indexed {len(chunks)} chunks for document {document_id}")
            return True
        except Exception as e:
            app_logger.error(f"Error indexing document: {e}")
            return False

    async def delete_document(self, collection: str, document_id: str) -> bool:
        try:
            results = await vector_service.search(
                collection_name=collection,
                query_embedding=[0] * 1536,
                limit=1000,
            )

            ids_to_delete = [
                result["id"]
                for result in results
                if result.get("payload", {}).get("document_id") == document_id
            ]

            if ids_to_delete:
                await vector_service.delete_points(collection, ids_to_delete)

            return True
        except Exception as e:
            app_logger.error(f"Error deleting document: {e}")
            return False

    def _chunk_text(
        self,
        text: str,
        chunk_size: int = 1000,
        overlap: int = 200,
    ) -> List[str]:
        chunks = []
        start = 0
        text_length = len(text)

        while start < text_length:
            end = start + chunk_size
            chunk = text[start:end]
            chunks.append(chunk)
            start += chunk_size - overlap

        return chunks


rag_service = RAGService()