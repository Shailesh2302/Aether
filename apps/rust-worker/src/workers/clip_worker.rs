use std::sync::Arc;
use tracing::info;
use crate::queue::jobs::QueueJob;
use crate::AppState;

pub struct ClipWorker {
    app_state: Arc<AppState>,
}

impl ClipWorker {
    pub fn new(app_state: Arc<AppState>) -> Self {
        Self { app_state }
    }

    pub async fn process(&self, job: QueueJob) -> anyhow::Result<()> {
        info!("Processing clip job: {}", job.id);
        Ok(())
    }
}