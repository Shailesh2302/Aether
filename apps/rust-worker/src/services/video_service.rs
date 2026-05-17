use std::sync::Arc;
use tracing::{info, debug};

use crate::types::VideoMetadata;
use crate::AppState;

pub struct VideoService {
    app_state: Arc<AppState>,
}

impl VideoService {
    pub fn new(app_state: Arc<AppState>) -> Self {
        Self { app_state }
    }

    pub async fn create_video(&self, video_id: &str, path: &str) -> anyhow::Result<()> {
        let key = format!("video:{}", video_id);
        self.app_state.redis.hset(&key, "path", path).await?;
        self.app_state.redis.hset(&key, "status", "created").await?;
        info!("Video created: {}", video_id);
        Ok(())
    }

    pub async fn update_metadata(&self, video_id: &str, metadata: VideoMetadata) -> anyhow::Result<()> {
        let key = format!("video:{}", video_id);

        let metadata_json = serde_json::to_string(&metadata)?;
        self.app_state.redis.hset(&key, "metadata", &metadata_json).await?;
        self.app_state.redis.hset(&key, "status", "processed").await?;

        info!("Video metadata updated: {}", video_id);
        Ok(())
    }

    pub async fn get_metadata(&self, video_id: &str) -> anyhow::Result<Option<VideoMetadata>> {
        let key = format!("video:{}", video_id);
        match self.app_state.redis.hget(&key, "metadata").await? {
            Some(data) => {
                let metadata: VideoMetadata = serde_json::from_str(&data)?;
                Ok(Some(metadata))
            }
            None => Ok(None),
        }
    }

    pub async fn update_status(&self, video_id: &str, status: &str) -> anyhow::Result<()> {
        let key = format!("video:{}", video_id);
        self.app_state.redis.hset(&key, "status", status).await?;
        Ok(())
    }

    pub async fn get_status(&self, video_id: &str) -> anyhow::Result<Option<String>> {
        let key = format!("video:{}", video_id);
        self.app_state.redis.hget(&key, "status").await
    }
}