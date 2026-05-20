use std::process::Stdio;
use tokio::process::Command;
use tracing::info;

pub async fn generate(input: &str, output: &str, time: f64) -> anyhow::Result<()> {
    info!("Generating thumbnail for {} at {}s", input, time);

    let mut cmd = Command::new("ffmpeg");
    cmd.args([
        "-y",
        "-ss", &time.to_string(),
        "-i", input,
        "-vframes", "1",
        "-q:v", "2",
        output,
    ])
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());

    let out = cmd.output().await?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        anyhow::bail!("FFmpeg thumbnail generation failed: {}", stderr);
    }

    info!("Thumbnail generated: {}", output);
    Ok(())
}

pub async fn generate_batch(
    input: &str,
    output_dir: &str,
    count: usize,
    interval: f64,
) -> anyhow::Result<Vec<String>> {
    info!("Generating {} thumbnails for {}", count, input);

    let mut paths = Vec::new();

    for i in 0..count {
        let time = (i as f64) * interval;
        let output = format!("{}/thumb_{}.jpg", output_dir, i);

        match generate(input, &output, time).await {
            Ok(_) => paths.push(output),
            Err(e) => tracing::warn!("Failed to generate thumbnail {}: {}", i, e),
        }
    }

    Ok(paths)
}