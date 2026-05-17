use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoMetadata {
    pub id: String,
    pub path: String,
    pub filename: String,
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub codec: String,
    pub bitrate: u64,
    pub fps: f64,
    pub file_size: u64,
    pub audio_codec: Option<String>,
    pub audio_channels: Option<u32>,
    pub audio_sample_rate: Option<u32>,
}

impl VideoMetadata {
    pub fn aspect_ratio(&self) -> f64 {
        if self.height > 0 {
            self.width as f64 / self.height as f64
        } else {
            0.0
        }
    }

    pub fn is_portrait(&self) -> bool {
        self.height > self.width
    }

    pub fn is_landscape(&self) -> bool {
        self.width > self.height
    }

    pub fn resolution(&self) -> String {
        format!("{}x{}", self.width, self.height)
    }
}