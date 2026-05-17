use thiserror::Error;

#[derive(Error, Debug)]
pub enum WorkerError {
    #[error("Redis error: {0}")]
    Redis(String),

    #[error("FFmpeg error: {0}")]
    Ffmpeg(String),

    #[error("Job not found: {0}")]
    JobNotFound(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Processing failed: {0}")]
    ProcessingFailed(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Redis error: {0}")]
    RedisAsync(String),

    #[error("Timeout: {0}")]
    Timeout(String),
}

impl From<redis::RedisError> for WorkerError {
    fn from(e: redis::RedisError) -> Self {
        WorkerError::Redis(e.to_string())
    }
}

impl From<anyhow::Error> for WorkerError {
    fn from(e: anyhow::Error) -> Self {
        WorkerError::ProcessingFailed(e.to_string())
    }
}

pub type Result<T> = std::result::Result<T, WorkerError>;

#[derive(Debug, Clone, serde::Serialize)]
pub struct ErrorResponse {
    pub code: String,
    pub message: String,
    pub details: Option<serde_json::Value>,
}

impl ErrorResponse {
    pub fn new(code: &str, message: &str) -> Self {
        Self {
            code: code.to_string(),
            message: message.to_string(),
            details: None,
        }
    }

    pub fn with_details(mut self, details: serde_json::Value) -> Self {
        self.details = Some(details);
        self
    }

    pub fn not_found(resource: &str) -> Self {
        Self::new("NOT_FOUND", &format!("{} not found", resource))
    }

    pub fn invalid_input(message: &str) -> Self {
        Self::new("INVALID_INPUT", message)
    }

    pub fn processing_error(message: &str) -> Self {
        Self::new("PROCESSING_ERROR", message)
    }

    pub fn internal_error(message: &str) -> Self {
        Self::new("INTERNAL_ERROR", message)
    }
}