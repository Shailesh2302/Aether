use std::sync::Arc;
use tracing::{info, error};

use crate::types::{Job, JobType, JobParameters, ProcessingStatus};
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
        let job = Job::new(
            JobType::VideoProcess,
            video_id.to_string(),
            input_path.to_string(),
            JobParameters::default(),
        );

        let queue = JobQueue::new(self.app_state.redis.clone());
        queue.push(job.clone()).await?;

        info!("Queued video processing: {} -> {}", video_id, job.id);
        Ok(job.id)
    }

    pub async fn queue_clip_generation(
        &self,
        video_id: &str,
        input_path: &str,
        clip_id: &str,
        start_time: f64,
        duration: f64,
    ) -> anyhow::Result<String> {
        let params = JobParameters {
            start_time: Some(start_time),
            duration: Some(duration),
            clip_id: Some(clip_id.to_string()),
            quality: Some("medium".to_string()),
            format: Some("mp4".to_string()),
        };

        let job = Job::new(
            JobType::ClipGenerate,
            video_id.to_string(),
            input_path.to_string(),
            params,
        );

        let queue = JobQueue::new(self.app_state.redis.clone());
        queue.push(job.clone()).await?;

        info!("Queued clip generation: {} -> {}", video_id, job.id);
        Ok(job.id)
    }

    pub async fn queue_audio_extraction(
        &self,
        video_id: &str,
        input_path: &str,
        output_path: Option<String>,
    ) -> anyhow::Result<String> {
        let params = JobParameters::default();

        let mut job = Job::new(
            JobType::AudioExtract,
            video_id.to_string(),
            input_path.to_string(),
            params,
        );
        job.output_path = output_path;

        let queue = JobQueue::new(self.app_state.redis.clone());
        queue.push(job.clone()).await?;

        info!("Queued audio extraction: {} -> {}", video_id, job.id);
        Ok(job.id)
    }

    pub async fn queue_thumbnail_generation(
        &self,
        video_id: &str,
        input_path: &str,
        time: f64,
        output_path: Option<String>,
    ) -> anyhow::Result<String> {
        let params = JobParameters {
            thumbnail_time: Some(time),
            ..Default::default()
        };

        let mut job = Job::new(
            JobType::ThumbnailGenerate,
            video_id.to_string(),
            input_path.to_string(),
            params,
        );
        job.output_path = output_path;

        let queue = JobQueue::new(self.app_state.redis.clone());
        queue.push(job.clone()).await?;

        info!("Queued thumbnail generation: {} -> {}", video_id, job.id);
        Ok(job.id)
    }

    pub async fn get_job_status(&self, job_id: &str) -> anyhow::Result<Option<ProcessingStatus>> {
        let queue = JobQueue::new(self.app_state.redis.clone());
        let key = format!("omnimind:job:{}", job_id);
        match self.app_state.redis.hget(&key, "status").await? {
            Some(status_str) => {
                let status: ProcessingStatus = status_str.parse()
                    .map_err(|e: String| anyhow::anyhow!("Failed to parse status: {}", e))?;
                Ok(Some(status))
            }
            None => Ok(None),
        }
    }

    pub async fn cancel_job(&self, job_id: &str) -> anyhow::Result<()> {
        let queue = JobQueue::new(self.app_state.redis.clone());
        queue.update_status(job_id, ProcessingStatus::Cancelled).await?;
        info!("Job cancelled: {}", job_id);
        Ok(())
    }
}