from typing import List, Optional, Dict, Any
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, Filter, FieldCondition, MatchValue
from app.core.config import get_settings
from app.core.logger import app_logger

settings = get_settings()


class VectorService:
    def __init__(self):
        self.client = QdrantClient(
            host=settings.QDRANT_HOST,
            port=settings.QDRANT_PORT,
            api_key=settings.QDRANT_API_KEY,
        )
        app_logger.info(f"Vector service initialized: {settings.QDRANT_HOST}:{settings.QDRANT_PORT}")

    async def create_collection(
        self,
        collection_name: str,
        vector_size: int = 1536,
        distance: Distance = Distance.COSINE,
    ) -> bool:
        try:
            self.client.recreate_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(
                    size=vector_size,
                    distance=distance,
                ),
            )
            app_logger.info(f"Collection created: {collection_name}")
            return True
        except Exception as e:
            app_logger.error(f"Error creating collection {collection_name}: {e}")
            return False

    async def delete_collection(self, collection_name: str) -> bool:
        try:
            self.client.delete_collection(collection_name=collection_name)
            app_logger.info(f"Collection deleted: {collection_name}")
            return True
        except Exception as e:
            app_logger.error(f"Error deleting collection {collection_name}: {e}")
            return False

    async def insert(
        self,
        collection_name: str,
        vectors: List[List[float]],
        payloads: List[Dict[str, Any]],
        ids: Optional[List[str]] = None,
    ) -> bool:
        try:
            self.client.upsert(
                collection_name=collection_name,
                points=[
                    {
                        "id": ids[i] if ids else str(i),
                        "vector": vectors[i],
                        "payload": payloads[i],
                    }
                    for i in range(len(vectors))
                ],
            )
            app_logger.info(f"Inserted {len(vectors)} vectors into {collection_name}")
            return True
        except Exception as e:
            app_logger.error(f"Error inserting vectors: {e}")
            return False

    async def search(
        self,
        collection_name: str,
        query_embedding: List[float],
        limit: int = 10,
        score_threshold: float = 0.0,
        filter_conditions: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        try:
            search_filter = None
            if filter_conditions:
                search_filter = Filter(
                    must=[
                        FieldCondition(
                            key=key,
                            match=MatchValue(value=value),
                        )
                        for key, value in filter_conditions.items()
                    ]
                )

            results = self.client.search(
                collection_name=collection_name,
                query_vector=query_embedding,
                limit=limit,
                score_threshold=score_threshold,
                query_filter=search_filter,
                with_payload=True,
            )

            return [
                {
                    "id": result.id,
                    "score": result.score,
                    "payload": result.payload,
                }
                for result in results
            ]
        except Exception as e:
            app_logger.error(f"Error searching: {e}")
            return []

    async def delete_points(self, collection_name: str, ids: List[str]) -> bool:
        try:
            self.client.delete(
                collection_name=collection_name,
                points_selector=ids,
            )
            return True
        except Exception as e:
            app_logger.error(f"Error deleting points: {e}")
            return False

    async def collection_exists(self, collection_name: str) -> bool:
        try:
            collections = self.client.get_collections().collections
            return any(c.name == collection_name for c in collections)
        except Exception as e:
            app_logger.error(f"Error checking collection: {e}")
            return False


vector_service = VectorService()