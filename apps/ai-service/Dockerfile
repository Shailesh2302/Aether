FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS deps
COPY apps/ai-service/requirements.txt ./requirements.txt
RUN pip install --prefix=/install -r requirements.txt

FROM base AS runner
COPY --from=deps /install /usr/local
COPY apps/ai-service/app ./app

ENV HOST=0.0.0.0 \
    PORT=3002 \
    WHISPER_DEVICE=cpu \
    WHISPER_MODEL=base

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -fs http://localhost:3002/api/v1/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3002"]
