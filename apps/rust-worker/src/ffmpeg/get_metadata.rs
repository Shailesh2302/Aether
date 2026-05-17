use std::process::Stdio;
use tokio::process::Command;
use serde::Deserialize;
use tracing::{info, debug};

use crate::types::VideoMetadata;

pub trait GetMetadata {
    async fn get_metadata(path: &str) -> anyhow::Result<VideoMetadata>;
}

pub struct MetadataReader;

impl GetMetadata for MetadataReader {
    async fn get_metadata(path: &str) -> anyhow::Result<VideoMetadata> {
        info!("Getting metadata for: {}", path);

        let mut cmd = Command::new("ffprobe");
        cmd.args([
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            path,
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

        let output = cmd.output().await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("ffprobe failed: {}", stderr);
        }

        let json_str = String::from_utf8_lossy(&output.stdout);
        let probe_output: ProbeOutput = serde_json::from_str(&json_str)?;

        let video_stream = probe_output.streams.iter()
            .find(|s| s.codec_type == "video")
            .ok_or_else(|| anyhow::anyhow!("No video stream found"))?;

        let audio_stream = probe_output.streams.iter()
            .find(|s| s.codec_type == "audio");

        let format = probe_output.format;

        let filename = format.filename.split('/').last()
            .unwrap_or("unknown").to_string();

        let (width, height) = (
            video_stream.width.unwrap_or(0),
            video_stream.height.unwrap_or(0),
        );

        let fps = parse_fps(&video_stream.r_frame_rate);

        let metadata = VideoMetadata {
            id: uuid::Uuid::new_v4().to_string(),
            path: path.to_string(),
            filename,
            duration: format.duration.parse().unwrap_or(0.0),
            width,
            height,
            codec: video_stream.codec_name.clone(),
            bitrate: format.bit_rate.parse().unwrap_or(0),
            fps,
            file_size: format.size.parse().unwrap_or(0),
            audio_codec: audio_stream.map(|s| s.codec_name.clone()),
            audio_channels: audio_stream.and_then(|s| s.channels),
            audio_sample_rate: audio_stream.and_then(|s| s.sample_rate.as_ref().and_then(|r| r.parse().ok())),
        };

        debug!("Metadata: {}x{} @ {:.2}s", width, height, metadata.duration);

        Ok(metadata)
    }
}

#[derive(Debug, Deserialize)]
struct ProbeOutput {
    streams: Vec<StreamInfo>,
    format: FormatInfo,
}

#[derive(Debug, Deserialize)]
struct StreamInfo {
    codec_type: String,
    codec_name: String,
    width: Option<u32>,
    height: Option<u32>,
    r_frame_rate: Option<String>,
    channels: Option<u32>,
    sample_rate: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FormatInfo {
    filename: String,
    duration: String,
    size: String,
    bit_rate: String,
}

fn parse_fps(fps_str: &Option<String>) -> f64 {
    match fps_str {
        Some(fps) => {
            if let Some((num, den)) = fps.split_once('/') {
                let numerator: f64 = num.parse().unwrap_or(0.0);
                let denominator: f64 = den.parse().unwrap_or(1.0);
                if denominator > 0.0 {
                    numerator / denominator
                } else {
                    0.0
                }
            } else {
                fps.parse().unwrap_or(0.0)
            }
        }
        None => 0.0,
    }
}

pub async fn get_metadata(path: &str) -> anyhow::Result<VideoMetadata> {
    MetadataReader::get_metadata(path).await
}