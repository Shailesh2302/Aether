use std::sync::Arc;
use tracing::info;

use crate::queue::redis_client::RedisClient;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct QueueJob {
    pub id: String,
    pub job_type: String,
    pub video_id: String,
    pub input_path: String,
    pub output_path: Option<String>,
    pub status: String,
}

pub struct JobQueue {
    redis: Arc<RedisClient>,
    queue_key: String,
}

impl JobQueue {
    pub fn new(redis: Arc<RedisClient>) -> Self {
        Self {
            redis,
            queue_key: "omnimind:video:queue".to_string(),
        }
    }

    pub async fn push(&self, job: QueueJob) -> anyhow::Result<()> {
        let job_json = serde_json::to_string(&job)?;
        self.redis.lpush(&self.queue_key, &job_json).await?;
        info!("Job pushed to queue: {}", job.id);
        Ok(())
    }

    pub async fn pop(&self) -> anyhow::Result<Option<QueueJob>> {
        match self.redis.brpop(&self.queue_key, 5).await? {
            Some(data) => {
                let job: QueueJob = serde_json::from_str(&data)?;
                Ok(Some(job))
            }
            None => Ok(None),
        }
    }
}