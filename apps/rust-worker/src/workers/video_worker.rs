use std::sync::Arc;
use tracing::info;
use crate::queue::jobs::QueueJob;
use crate::AppState;

pub struct VideoWorker {
    app_state: Arc<AppState>,
}

impl VideoWorker {
    pub fn new(app_state: Arc<AppState>) -> Self {
        Self { app_state }
    }

    pub async fn process(&self, job: QueueJob) -> anyhow::Result<()> {
        info!("Processing video job: {}", job.id);
        Ok(())
    }
}