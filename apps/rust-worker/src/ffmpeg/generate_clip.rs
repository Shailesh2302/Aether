use std::process::Stdio;
use tokio::process::Command;
use tracing::{info, debug};

pub async fn generate(
    input: &str,
    output: &str,
    start_time: f64,
    duration: f64,
    quality: &str,
) -> anyhow::Result<()> {
    info!("Generating clip: {} -> {} ({}s @ {}s)", input, output, duration, start_time);

    let (crf, preset) = match quality {
        "high" => (18, "slow"),
        "medium" => (23, "medium"),
        "low" => (28, "fast"),
        _ => (23, "medium"),
    };

    let mut cmd = Command::new("ffmpeg");
    cmd.args([
        "-y",
        "-ss", &start_time.to_string(),
        "-i", input,
        "-t", &duration.to_string(),
        "-c:v", "libx264",
        "-preset", preset,
        "-crf", &crf.to_string(),
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        output,
    ])
    .stdout(Stdio::null())
    .stderr(Stdio::piped());

    debug!("Running clip generation with quality: {}", quality);

    let output = cmd.output().await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("FFmpeg clip generation failed: {}", stderr);
    }

    info!("Clip generated successfully");
    Ok(())
}

pub async fn generate_with_transitions(
    input: &str,
    output: &str,
    clips: Vec<(f64, f64)>,
    transition_duration: f64,
) -> anyhow::Result<()> {
    if clips.is_empty() {
        anyhow::bail!("No clips provided");
    }

    let filter_chain = build_transition_filter(&clips, transition_duration)?;

    let mut cmd = Command::new("ffmpeg");
    cmd.args(["-y", "-i", input])
        .arg("-filter_complex")
        .arg(&filter_chain)
        .args(["-c:v", "libx264", "-preset", "medium", "-crf", "23"])
        .args(["-c:a", "aac", "-b:a", "128k"])
        .arg(output)
        .stdout(Stdio::null())
        .stderr(Stdio::piped());

    let output = cmd.output().await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("FFmpeg clip generation with transitions failed: {}", stderr);
    }

    Ok(())
}

fn build_transition_filter(clips: &[(f64, f64)], transition: f64) -> anyhow::Result<String> {
    let mut filters = Vec::new();

    for (i, (start, end)) in clips.iter().enumerate() {
        let duration = end - start;
        filters.push(format!(
            "[0:v]trim=start={}:end={},setpts=PTS-STARTPTS,scale=1280:720[v{}]",
            start, end, i
        ));
    }

    Ok(filters.join(";"))
}