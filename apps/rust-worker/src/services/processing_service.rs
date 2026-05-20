use std::sync::Arc;
use tracing::info;
use crate::types::ProcessingStatus;
use crate::queue::jobs::QueueJob;
use crate::queue::jobs::JobQueue;
use crate::AppState;

pub struct ProcessingService {
    app_state: Arc<AppState>,
}

impl ProcessingService {
    pub fn new(app_state: Arc<AppState>) -> Self {
        Self { app_state }
    }

    pub async fn queue_video_processing(
        &self,
        video_id: &str,
        input_path: &str,
    ) -> anyhow::Result<String> {
        let job = QueueJob {
            id: format!("job-{}", video_id),
            job_type: "VideoProcess".to_string(),
            video_id: video_id.to_string(),
            input_path: input_path.to_string(),
            output_path: None,
            status: "pending".to_string(),
            parameters: None,
        };

        let queue = JobQueue::new(self.app_state.redis.clone());
        queue.push(job).await?;

        info!("Queued video processing: {}", video_id);
        Ok(video_id.to_string())
    }

    pub async fn queue_clip_generation(
        &self,
        video_id: &str,
        _clip_id: &str,
        _start_time: f64,
        _duration: f64,
    ) -> anyhow::Result<String> {
        info!("Queued clip generation: {}", video_id);
        Ok(video_id.to_string())
    }
}