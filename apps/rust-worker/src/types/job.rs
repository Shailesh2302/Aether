use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum JobType {
    VideoProcess,
    ClipGenerate,
    AudioExtract,
    ThumbnailGenerate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Job {
    pub id: String,
    pub job_type: JobType,
    pub video_id: String,
    pub input_path: String,
    pub output_path: Option<String>,
    pub parameters: JobParameters,
    pub status: super::status::ProcessingStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error: Option<String>,
}

impl Job {
    pub fn new(
        job_type: JobType,
        video_id: String,
        input_path: String,
        parameters: JobParameters,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            job_type,
            video_id,
            input_path,
            output_path: None,
            parameters,
            status: super::status::ProcessingStatus::Pending,
            created_at: now,
            updated_at: now,
            started_at: None,
            completed_at: None,
            error: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobParameters {
    pub start_time: Option<f64>,
    pub duration: Option<f64>,
    pub clip_id: Option<String>,
    pub thumbnail_time: Option<f64>,
    pub quality: Option<String>,
    pub format: Option<String>,
}

impl Default for JobParameters {
    fn default() -> Self {
        Self {
            start_time: None,
            duration: None,
            clip_id: None,
            thumbnail_time: None,
            quality: Some("medium".to_string()),
            format: Some("mp4".to_string()),
        }
    }
}