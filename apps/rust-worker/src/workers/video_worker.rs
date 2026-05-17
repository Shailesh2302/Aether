use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, error};

use crate::types::{Job, ProcessingStatus};
use crate::ffmpeg::{self, get_metadata::GetMetadata};
use crate::services::video_service::VideoService;
use crate::AppState;

pub struct VideoWorker {
    app_state: Arc<AppState>,
}

impl VideoWorker {
    pub fn new(app_state: Arc<AppState>) -> Self {
        Self { app_state }
    }

    pub async fn process(&self, job: Job) -> anyhow::Result<()> {
        info!("Processing video job: {}", job.id);

        let metadata = ffmpeg::get_metadata(&job.input_path).await?;

        info!("Video metadata: {}x{} @ {:.2}s",
            metadata.width, metadata.height, metadata.duration);

        let audio_output = format!(
            "{}/audio/{}.mp3",
            self.app_state.config.storage_path,
            job.video_id
        );

        let thumbnail_output = format!(
            "{}/thumbnails/{}.jpg",
            self.app_state.config.storage_path,
            job.video_id
        );

        if let Err(e) = ffmpeg::extract_audio::extract(&job.input_path, &audio_output).await {
            error!("Failed to extract audio: {}", e);
        }

        if let Err(e) = ffmpeg::thumbnails::generate(&job.input_path, &thumbnail_output, 5.0).await {
            error!("Failed to generate thumbnail: {}", e);
        }

        let video_service = VideoService::new(self.app_state.clone());
        if let Err(e) = video_service.update_metadata(&job.video_id, metadata).await {
            error!("Failed to update video metadata: {}", e);
        }

        self.notify_progress(&job.video_id, ProcessingStatus::Completed, 100).await;

        info!("Video job completed: {}", job.id);
        Ok(())
    }

    async fn notify_progress(&self, video_id: &str, status: ProcessingStatus, progress: u8) {
        let ws_manager = self.app_state.ws_manager.read().await;
        ws_manager.broadcast_progress(video_id, status, progress).await;
    }
}