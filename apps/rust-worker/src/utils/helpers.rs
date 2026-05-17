use std::path::{Path, PathBuf};
use chrono::{DateTime, Utc};

pub fn ensure_directory(path: &str) -> anyhow::Result<()> {
    let path = Path::new(path);
    if !path.exists() {
        std::fs::create_dir_all(path)?;
    }
    Ok(())
}

pub fn get_file_extension(path: &str) -> Option<String> {
    Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
}

pub fn get_filename(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string()
}

pub fn generate_output_path(
    base_dir: &str,
    prefix: &str,
    extension: &str,
) -> String {
    let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
    format!("{}/{}_{}.{}", base_dir, prefix, timestamp, extension)
}

pub fn format_duration(seconds: f64) -> String {
    let hours = (seconds / 3600.0).floor() as u32;
    let minutes = ((seconds % 3600.0) / 60.0).floor() as u32;
    let secs = (seconds % 60.0).floor() as u32;

    if hours > 0 {
        format!("{:02}:{:02}:{:02}", hours, minutes, secs)
    } else {
        format!("{:02}:{:02}", minutes, secs)
    }
}

pub fn format_file_size(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.2} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

pub fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

pub fn is_video_file(path: &str) -> bool {
    matches!(
        get_file_extension(path).as_deref(),
        Some("mp4") | Some("mov") | Some("avi") | Some("mkv") | Some("webm") | Some("flv")
    )
}

pub fn is_audio_file(path: &str) -> bool {
    matches!(
        get_file_extension(path).as_deref(),
        Some("mp3") | Some("wav") | Some("aac") | Some("ogg") | Some("flac")
    )
}