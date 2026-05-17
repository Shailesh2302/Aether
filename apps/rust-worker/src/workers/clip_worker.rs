use std::sync::Arc;
use tracing::{info, error};
use uuid::Uuid;

use crate::types::{Job, ProcessingStatus, ClipMetadata};
use crate::ffmpeg;
use crate::services::clip_service::ClipService;
use crate::AppState;

pub struct ClipWorker {
    app_state: Arc<AppState>,
}

impl ClipWorker {
    pub fn new(app_state: Arc<AppState>) -> Self {
        Self { app_state }
    }

    pub async fn process(&self, job: Job) -> anyhow::Result<()> {
        info!("Processing clip job: {}", job.id);

        let clip_id = job.parameters.clip_id.clone()
            .unwrap_or_else(|| Uuid::new_v4().to_string());

        let start_time = job.parameters.start_time.unwrap_or(0.0);
        let duration = job.parameters.duration.unwrap_or(10.0);

        let metadata = ffmpeg::get_metadata(&job.input_path).await?;

        let clip_output = format!(
            "{}/clips/{}_{}.mp4",
            self.app_state.config.storage_path,
            job.video_id,
            clip_id
        );

        let thumbnail_output = format!(
            "{}/thumbnails/clip_{}_{}.jpg",
            self.app_state.config.storage_path,
            job.video_id,
            clip_id
        );

        self.notify_progress(&job.video_id, ProcessingStatus::Processing, 20).await;

        ffmpeg::generate_clip::generate(
            &job.input_path,
            &clip_output,
            start_time,
            duration,
            job.parameters.quality.as_deref().unwrap_or("medium"),
        ).await?;

        self.notify_progress(&job.video_id, ProcessingStatus::Processing, 60).await;

        if let Err(e) = ffmpeg::thumbnails::generate(&clip_output, &thumbnail_output, start_time).await {
            error!("Failed to generate clip thumbnail: {}", e);
        }

        let clip_metadata = ClipMetadata::new(
            clip_id.clone(),
            job.video_id.clone(),
            clip_output,
            start_time,
            start_time + duration,
            metadata.width,
            metadata.height,
        );

        let clip_service = ClipService::new(self.app_state.clone());
        if let Err(e) = clip_service.create_clip(clip_metadata).await {
            error!("Failed to save clip metadata: {}", e);
        }

        self.notify_progress(&job.video_id, ProcessingStatus::Completed, 100).await;

        info!("Clip job completed: {}", job.id);
        Ok(())
    }

    async fn notify_progress(&self, video_id: &str, status: ProcessingStatus, progress: u8) {
        let ws_manager = self.app_state.ws_manager.read().await;
        ws_manager.broadcast_progress(video_id, status, progress).await;
    }
}