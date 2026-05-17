pub mod env;

use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub redis_url: String,
    pub redis_host: String,
    pub redis_port: u16,
    pub queue_name: String,
    pub processing_queue: String,
    pub ws_host: String,
    pub ws_port: u16,
    pub storage_path: String,
    pub ffmpeg_path: Option<String>,
    pub max_concurrent_jobs: usize,
    pub job_timeout_seconds: u64,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self {
            redis_url: env::redis_url(),
            redis_host: env::redis_host(),
            redis_port: env::redis_port(),
            queue_name: env::queue_name(),
            processing_queue: env::processing_queue(),
            ws_host: env::ws_host(),
            ws_port: env::ws_port(),
            storage_path: env::storage_path(),
            ffmpeg_path: env::ffmpeg_path(),
            max_concurrent_jobs: env::max_concurrent_jobs(),
            job_timeout_seconds: env::job_timeout_seconds(),
        })
    }
}