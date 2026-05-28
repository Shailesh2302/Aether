FROM postgres:16-alpine

ENV POSTGRES_USER=aether
ENV POSTGRES_PASSWORD=aether_secret
ENV POSTGRES_DB=aether

RUN apk add --no-cache \
    postgis \
    postgresql-contrib

RUN mkdir -p /docker-entrypoint-initdb.d

COPY init.sql /docker-entrypoint-initdb.d/init.sql

EXPOSE 5432

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  pg_isready -U aether -d aether

CMD ["postgres", "-c", "shared_buffers=256MB", "-c", "max_connections=200"]