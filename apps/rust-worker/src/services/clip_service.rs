use std::sync::Arc;
use tracing::{info, debug};

use crate::types::ClipMetadata;
use crate::AppState;

pub struct ClipService {
    app_state: Arc<AppState>,
}

impl ClipService {
    pub fn new(app_state: Arc<AppState>) -> Self {
        Self { app_state }
    }

    pub async fn create_clip(&self, clip: ClipMetadata) -> anyhow::Result<()> {
        let key = format!("clip:{}", clip.id);
        let clip_json = serde_json::to_string(&clip)?;
        self.app_state.redis.hset(&key, "data", &clip_json).await?;
        self.app_state.redis.hset(&key, "videoId", &clip.video_id).await?;

        let video_clips_key = format!("video:{}:clips", clip.video_id);
        self.app_state.redis.rpush(&video_clips_key, &clip.id).await?;

        info!("Clip created: {}", clip.id);
        Ok(())
    }

    pub async fn get_clip(&self, clip_id: &str) -> anyhow::Result<Option<ClipMetadata>> {
        let key = format!("clip:{}", clip_id);
        match self.app_state.redis.hget(&key, "data").await? {
            Some(data) => {
                let clip: ClipMetadata = serde_json::from_str(&data)?;
                Ok(Some(clip))
            }
            None => Ok(None),
        }
    }

    pub async fn get_clips_for_video(&self, video_id: &str) -> anyhow::Result<Vec<ClipMetadata>> {
        let key = format!("video:{}:clips", video_id);
        let mut conn = self.app_state.redis.get_connection().await?;
        let clip_ids: Vec<String> = redis::cmd("LRANGE")
            .arg(&key)
            .arg(0)
            .arg(-1)
            .query_async(&mut conn)
            .await?;
        self.app_state.redis.return_connection(conn).await;

        let mut clips = Vec::new();
        for clip_id in clip_ids {
            if let Some(clip) = self.get_clip(&clip_id).await? {
                clips.push(clip);
            }
        }

        Ok(clips)
    }

    pub async fn delete_clip(&self, clip_id: &str) -> anyhow::Result<()> {
        let key = format!("clip:{}", clip_id);
        self.app_state.redis.del(&key).await?;
        info!("Clip deleted: {}", clip_id);
        Ok(())
    }

    pub async fn update_thumbnail(&self, clip_id: &str, thumbnail_path: &str) -> anyhow::Result<()> {
        if let Some(mut clip) = self.get_clip(clip_id).await? {
            clip.thumbnail_path = Some(thumbnail_path.to_string());
            let key = format!("clip:{}", clip_id);
            let clip_json = serde_json::to_string(&clip)?;
            self.app_state.redis.hset(&key, "data", &clip_json).await?;
        }
        Ok(())
    }
}