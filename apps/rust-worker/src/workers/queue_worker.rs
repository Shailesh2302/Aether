use std::sync::Arc;
use tokio::sync::Semaphore;
use tracing::{info, error, warn};
use anyhow::Result;

use crate::types::{Job, JobType, ProcessingStatus};
use crate::queue::jobs::JobQueue;
use crate::workers::{VideoWorker, ClipWorker};
use crate::AppState;

pub struct QueueWorker {
    app_state: Arc<AppState>,
    semaphore: Semaphore,
}

impl QueueWorker {
    pub fn new(app_state: Arc<AppState>) -> Self {
        let semaphore = Semaphore::new(app_state.config.max_concurrent_jobs);
        Self { app_state, semaphore }
    }

    pub async fn start(&self) -> Result<()> {
        info!("Starting queue worker");

        let queue = JobQueue::new(self.app_state.redis.clone());

        loop {
            match queue.pop().await {
                Ok(Some(job)) => {
                    info!("Received job: {} ({:?})", job.id, job.job_type);
                    let app_state = self.app_state.clone();
                    tokio::spawn(async move {
                        let worker = QueueWorker::new(app_state);
                        if let Err(e) = worker.process_job(job).await {
                            error!("Job processing error: {}", e);
                        }
                    });
                }
                Ok(None) => {
                    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                }
                Err(e) => {
                    warn!("Failed to pop job from queue: {}", e);
                    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                }
            }
        }
    }

    async fn process_job(&self, job: Job) -> Result<()> {
        let _permit = self.semaphore.acquire().await
            .map_err(|e| anyhow::anyhow!("Failed to acquire semaphore: {}", e))?;

        info!("Processing job: {} of type {:?}", job.id, job.job_type);

        let result = match job.job_type {
            JobType::VideoProcess => {
                let worker = VideoWorker::new(self.app_state.clone());
                worker.process(job).await
            }
            JobType::ClipGenerate => {
                let worker = ClipWorker::new(self.app_state.clone());
                worker.process(job).await
            }
            JobType::AudioExtract => {
                self.process_audio_extract(job).await
            }
            JobType::ThumbnailGenerate => {
                self.process_thumbnail(job).await
            }
        };

        match result {
            Ok(_) => {
                info!("Job completed successfully: {}", job.id);
                self.update_job_status(&job.id, ProcessingStatus::Completed).await?;
            }
            Err(e) => {
                error!("Job failed: {} - {}", job.id, e);
                self.update_job_status(&job.id, ProcessingStatus::Failed).await?;
            }
        }

        Ok(())
    }

    async fn process_audio_extract(&self, job: Job) -> Result<()> {
        let output_path = job.output_path.clone()
            .unwrap_or_else(|| format!("{}/audio/{}.mp3",
                self.app_state.config.storage_path, job.video_id));

        crate::ffmpeg::extract_audio::extract(&job.input_path, &output_path).await?;
        Ok(())
    }

    async fn process_thumbnail(&self, job: Job) -> Result<()> {
        let output_path = job.output_path.clone()
            .unwrap_or_else(|| format!("{}/thumbnails/{}.jpg",
                self.app_state.config.storage_path, job.video_id));

        let time = job.parameters.thumbnail_time.unwrap_or(5.0);
        crate::ffmpeg::thumbnails::generate(&job.input_path, &output_path, time).await?;
        Ok(())
    }

    async fn update_job_status(&self, job_id: &str, status: ProcessingStatus) -> Result<()> {
        let queue = JobQueue::new(self.app_state.redis.clone());
        queue.update_status(job_id, status).await
    }
}