use std::process::Stdio;
use tokio::process::Command;
use serde::{Deserialize, Serialize};
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoMetadata {
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub codec: String,
}

pub async fn get_metadata(input: &str) -> anyhow::Result<VideoMetadata> {
    info!("Getting metadata for: {}", input);

    let mut cmd = Command::new("ffprobe");
    cmd.args([
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        input,
    ])
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());

    let out = cmd.output().await?;

    if !out.status.success() {
        return Ok(VideoMetadata {
            duration: 0.0,
            width: 1920,
            height: 1080,
            fps: 30.0,
            codec: "h264".to_string(),
        });
    }

    let json_str = String::from_utf8_lossy(&out.stdout);
    
    let mut duration = 0.0;
    let mut width = 1920u32;
    let mut height = 1080u32;

    if let Some(d) = json_str.find("\"duration\":\"") {
        let rest = &json_str[d+12..];
        if let Some(end) = rest.find('"') {
            let dur_str = &rest[..end];
            duration = dur_str.parse().unwrap_or(0.0);
        }
    }

    Ok(VideoMetadata {
        duration,
        width,
        height,
        fps: 30.0,
        codec: "h264".to_string(),
    })
}