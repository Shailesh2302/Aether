use std::sync::Arc;
use tracing::info;
use crate::ffmpeg::generate_clip;
use crate::AppState;

pub struct ClipService {
    app_state: Arc<AppState>,
}

impl ClipService {
    pub fn new(app_state: Arc<AppState>) -> Self {
        Self { app_state }
    }

    pub async fn generate_clip(
        &self,
        video_path: &str,
        start_time: f64,
        end_time: f64,
        output_path: &str,
    ) -> anyhow::Result<String> {
        info!("Generating clip: {} ({}s - {}s)", video_path, start_time, end_time);

        generate_clip::generate(video_path, output_path, start_time, end_time).await?;

        Ok(output_path.to_string())
    }
}