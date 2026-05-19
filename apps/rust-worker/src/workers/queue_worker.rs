use std::sync::Arc;
use tracing::info;

use crate::queue::jobs::JobQueue;
use crate::AppState;

pub struct QueueWorker {
    app_state: Arc<AppState>,
}

impl QueueWorker {
    pub fn new(app_state: Arc<AppState>) -> Self {
        Self { app_state }
    }

    pub async fn start(&self) -> anyhow::Result<()> {
        info!("Starting queue worker");

        let queue = JobQueue::new(self.app_state.redis.clone());

        loop {
            match queue.pop().await {
                Ok(Some(job)) => {
                    info!("Received job: {} ({})", job.id, job.job_type);
                }
                Ok(None) => {
                    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                }
                Err(e) => {
                    info!("Failed to pop job from queue: {}", e);
                    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                }
            }
        }
    }
}