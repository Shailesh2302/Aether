FROM postgres:16-alpine

ENV POSTGRES_USER=omnimind
ENV POSTGRES_PASSWORD=omnimind_secret
ENV POSTGRES_DB=omnimind

RUN apk add --no-cache \
    postgis \
    postgresql-contrib

RUN mkdir -p /docker-entrypoint-initdb.d

COPY init.sql /docker-entrypoint-initdb.d/init.sql

EXPOSE 5432

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  pg_isready -U omnimind -d omnimind

CMD ["postgres", "-c", "shared_buffers=256MB", "-c", "max_connections=200"]