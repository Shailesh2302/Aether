use std::sync::Arc;
use tracing::{info, debug};

use crate::types::{Job, ProcessingStatus};
use crate::queue::redis_client::RedisClient;

pub struct JobQueue {
    redis: Arc<RedisClient>,
    queue_key: String,
    processing_key: String,
    job_prefix: String,
}

impl JobQueue {
    pub fn new(redis: Arc<RedisClient>) -> Self {
        Self {
            redis,
            queue_key: "omnimind:video:queue".to_string(),
            processing_key: "omnimind:video:processing".to_string(),
            job_prefix: "omnimind:job:".to_string(),
        }
    }

    pub fn with_keys(redis: Arc<RedisClient>, queue: &str, processing: &str) -> Self {
        Self {
            redis,
            queue_key: queue.to_string(),
            processing_key: processing.to_string(),
            job_prefix: "omnimind:job:".to_string(),
        }
    }

    pub async fn push(&self, job: Job) -> anyhow::Result<()> {
        let job_json = serde_json::to_string(&job)?;
        self.redis.lpush(&self.queue_key, &job_json).await?;

        self.redis.hset(
            &format!("{}{}", self.job_prefix, job.id),
            "status",
            job.status.to_string().as_ref(),
        ).await?;

        info!("Job pushed to queue: {}", job.id);
        Ok(())
    }

    pub async fn pop(&self) -> anyhow::Result<Option<Job>> {
        match self.redis.brpop(&self.queue_key, 5).await? {
            Some(data) => {
                let job: Job = serde_json::from_str(&data)?;
                self.redis.rpush(&self.processing_key, &job.id).await?;
                debug!("Job popped from queue: {}", job.id);
                Ok(Some(job))
            }
            None => Ok(None),
        }
    }

    pub async fn update_status(&self, job_id: &str, status: ProcessingStatus) -> anyhow::Result<()> {
        let key = format!("{}{}", self.job_prefix, job_id);
        self.redis.hset(&key, "status", status.to_string().as_ref()).await?;
        info!("Job status updated: {} -> {:?}", job_id, status);
        Ok(())
    }

    pub async fn get_job(&self, job_id: &str) -> anyhow::Result<Option<Job>> {
        let key = format!("{}{}", self.job_prefix, job_id);
        match self.redis.hget(&key, "data").await? {
            Some(data) => {
                let job: Job = serde_json::from_str(&data)?;
                Ok(Some(job))
            }
            None => Ok(None),
        }
    }

    pub async fn complete(&self, job_id: &str) -> anyhow::Result<()> {
        self.redis.lrem(&self.processing_key, 0, job_id).await?;
        self.update_status(job_id, ProcessingStatus::Completed).await?;
        info!("Job completed: {}", job_id);
        Ok(())
    }

    pub async fn fail(&self, job_id: &str, error: &str) -> anyhow::Result<()> {
        self.redis.lrem(&self.processing_key, 0, job_id).await?;
        self.redis.hset(
            &format!("{}{}", self.job_prefix, job_id),
            "error",
            error,
        ).await?;
        self.update_status(job_id, ProcessingStatus::Failed).await?;
        info!("Job failed: {} - {}", job_id, error);
        Ok(())
    }

    pub async fn queue_size(&self) -> anyhow::Result<usize> {
        let mut conn = self.redis.get_connection().await?;
        let len: usize = redis::cmd("LLEN")
            .arg(&self.queue_key)
            .query_async(&mut conn)
            .await?;
        self.redis.return_connection(conn).await;
        Ok(len)
    }

    pub async fn processing_size(&self) -> anyhow::Result<usize> {
        let mut conn = self.redis.get_connection().await?;
        let len: usize = redis::cmd("LLEN")
            .arg(&self.processing_key)
            .query_async(&mut conn)
            .await?;
        self.redis.return_connection(conn).await;
        Ok(len)
    }
}

trait RedisExt {
    async fn lrem(&self, key: &str, count: i64, value: &str) -> anyhow::Result<()>;
}

impl RedisExt for RedisClient {
    async fn lrem(&self, key: &str, count: i64, value: &str) -> anyhow::Result<()> {
        let mut conn = self.get_connection().await?;
        redis::cmd("LREM")
            .arg(key)
            .arg(count)
            .arg(value)
            .query_async(&mut conn)
            .await?;
        self.return_connection(conn).await;
        Ok(())
    }
}