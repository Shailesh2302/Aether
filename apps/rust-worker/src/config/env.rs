use std::env;

pub fn redis_url() -> String {
    env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_string())
}

pub fn redis_host() -> String {
    env::var("REDIS_HOST").unwrap_or_else(|_| "localhost".to_string())
}

pub fn redis_port() -> u16 {
    env::var("REDIS_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(6379)
}

pub fn queue_name() -> String {
    env::var("QUEUE_NAME").unwrap_or_else(|_| "omnimind:video:queue".to_string())
}

pub fn processing_queue() -> String {
    env::var("PROCESSING_QUEUE").unwrap_or_else(|_| "omnimind:video:processing".to_string())
}

pub fn ws_host() -> String {
    env::var("WS_HOST").unwrap_or_else(|_| "0.0.0.0".to_string())
}

pub fn ws_port() -> u16 {
    env::var("WS_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(9000)
}

pub fn storage_path() -> String {
    env::var("STORAGE_PATH").unwrap_or_else(|_| "/tmp/omnimind".to_string())
}

pub fn ffmpeg_path() -> Option<String> {
    env::var("FFMPEG_PATH").ok()
}

pub fn max_concurrent_jobs() -> usize {
    env::var("MAX_CONCURRENT_JOBS")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(4)
}

pub fn job_timeout_seconds() -> u64 {
    env::var("JOB_TIMEOUT_SECONDS")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3600)
}