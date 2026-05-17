use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipMetadata {
    pub id: String,
    pub video_id: String,
    pub path: String,
    pub start_time: f64,
    pub end_time: f64,
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub file_size: u64,
    pub thumbnail_path: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl ClipMetadata {
    pub fn new(
        id: String,
        video_id: String,
        path: String,
        start_time: f64,
        end_time: f64,
        width: u32,
        height: u32,
    ) -> Self {
        let duration = end_time - start_time;
        Self {
            id,
            video_id,
            path,
            start_time,
            end_time,
            duration,
            width,
            height,
            file_size: 0,
            thumbnail_path: None,
            created_at: chrono::Utc::now(),
        }
    }
}