FROM qdrant/qdrant:v1.7.4

ENV QDRANT_STORAGE__STORAGE_PATH=/qdrant/storage
ENV QDRANT_SERVICE__GRPC_PORT=6334
ENV QDRANT_SERVICE__HTTP_PORT=6333

RUN mkdir -p /qdrant/storage

EXPOSE 6333 6334

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  curl -f http://localhost:6333/health || exit 1

CMD ["qdrant"]