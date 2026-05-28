use std::env;

#[derive(Clone)]
pub struct Config {
    pub redis_url: String,
    pub redis_host: String,
    pub redis_port: u16,
    pub queue_name: String,
    pub processing_queue: String,
    pub ws_host: String,
    pub ws_port: u16,
    pub storage_path: String,
    pub max_concurrent_jobs: usize,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self {
            redis_url: env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_string()),
            redis_host: env::var("REDIS_HOST").unwrap_or_else(|_| "localhost".to_string()),
            redis_port: env::var("REDIS_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(6379),
            queue_name: env::var("QUEUE_NAME").unwrap_or_else(|_| "aether:video:queue".to_string()),
            processing_queue: env::var("PROCESSING_QUEUE").unwrap_or_else(|_| "aether:video:processing".to_string()),
            ws_host: env::var("WS_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            ws_port: env::var("WS_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(9000),
            storage_path: env::var("STORAGE_PATH").unwrap_or_else(|_| "/tmp/aether".to_string()),
            max_concurrent_jobs: env::var("MAX_CONCURRENT_JOBS").ok().and_then(|p| p.parse().ok()).unwrap_or(4),
        })
    }
}