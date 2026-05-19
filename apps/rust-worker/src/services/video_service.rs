use std::sync::Arc;
use tracing::info;
use crate::ffmpeg::extract_audio;
use crate::AppState;

pub struct VideoService {
    app_state: Arc<AppState>,
}

impl VideoService {
    pub fn new(app_state: Arc<AppState>) -> Self {
        Self { app_state }
    }

    pub async fn extract_audio(&self, video_path: &str, output_path: &str) -> anyhow::Result<String> {
        info!("Extracting audio from: {}", video_path);
        extract_audio::extract(video_path, output_path).await?;
        Ok(output_path.to_string())
    }
}