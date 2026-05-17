use std::process::Stdio;
use tokio::process::Command;
use tracing::{info, debug};

pub async fn generate(input: &str, output: &str, time: f64) -> anyhow::Result<()> {
    info!("Generating thumbnail for {} at {}s", input, time);

    let mut cmd = Command::new("ffmpeg");
    cmd.args([
        "-y",
        "-ss", &time.to_string(),
        "-i", input,
        "-vframes", "1",
        "-q:v", "2",
        "-vf", "scale=640:-1",
        output,
    ])
    .stdout(Stdio::null())
    .stderr(Stdio::piped());

    debug!("Generating thumbnail with FFmpeg");

    let output = cmd.output().await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("FFmpeg thumbnail generation failed: {}", stderr);
    }

    info!("Thumbnail generated: {}", output);
    Ok(())
}

pub async fn generate_multiple(
    input: &str,
    output_dir: &str,
    count: usize,
    interval: f64,
) -> anyhow::Result<Vec<String>> {
    info!("Generating {} thumbnails for {}", count, input);

    let duration = ffmpeg::get_metadata::get_metadata(input).await?.duration;
    let step = duration / count as f64;

    let mut paths = Vec::new();

    for i in 0..count {
        let time = step * i as f64;
        let output = format!("{}/thumb_{}.jpg", output_dir, i);

        generate(input, &output, time).await?;
        paths.push(output);
    }

    Ok(paths)
}

pub async fn generate_sprite(
    input: &str,
    output: &str,
    columns: u32,
    rows: u32,
    thumbnail_width: u32,
    thumbnail_height: u32,
) -> anyhow::Result<()> {
    let duration = ffmpeg::get_metadata::get_metadata(input).await?.duration;
    let total = columns * rows;
    let step = duration / total as f64;

    let temp_dir = format!("{}/sprite_temp", std::path::Path::new(output).parent().unwrap_or(std::path::Path::new(".")).display());
    std::fs::create_dir_all(&temp_dir).ok();

    for i in 0..total {
        let time = step * i as f64;
        let temp_path = format!("{}/thumb_{}.jpg", temp_dir, i);
        generate(input, &temp_path, time).await?;
    }

    let filter = format!(
        "tile=layout={}x{},margin=2,border=2",
        columns, rows
    );

    let mut cmd = Command::new("ffmpeg");
    cmd.args(["-y", "-i", &format!("{}/thumb_0.jpg", temp_dir)])
        .arg("-filter_complex")
        .arg(&filter)
        .args(["-frames:v", "1", "-s", &format!("{}x{}", thumbnail_width * columns, thumbnail_height * rows)])
        .arg(output)
        .stdout(Stdio::null())
        .stderr(Stdio::piped());

    let output = cmd.output().await?;

    std::fs::remove_dir_all(&temp_dir).ok();

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("FFmpeg sprite generation failed: {}", stderr);
    }

    Ok(())
}