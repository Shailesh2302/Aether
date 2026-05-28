FROM rust:1.75-bookworm as builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
RUN mkdir src && touch src/lib.rs

RUN cargo fetch

COPY . .

RUN cargo build --release

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/aether-rust-worker /usr/local/bin/

RUN mkdir -p /tmp/aether/{video,audio,clips,thumbnails}

ENV RUST_LOG=info
ENV REDIS_URL=redis://localhost:6379
ENV STORAGE_PATH=/tmp/aether

EXPOSE 9000

CMD ["aether-rust-worker"]