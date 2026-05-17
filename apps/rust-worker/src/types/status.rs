use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProcessingStatus {
    Pending,
    Queued,
    Processing,
    Completed,
    Failed,
    Cancelled,
}

impl std::fmt::Display for ProcessingStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ProcessingStatus::Pending => write!(f, "pending"),
            ProcessingStatus::Queued => write!(f, "queued"),
            ProcessingStatus::Processing => write!(f, "processing"),
            ProcessingStatus::Completed => write!(f, "completed"),
            ProcessingStatus::Failed => write!(f, "failed"),
            ProcessingStatus::Cancelled => write!(f, "cancelled"),
        }
    }
}

impl std::str::FromStr for ProcessingStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "pending" => Ok(ProcessingStatus::Pending),
            "queued" => Ok(ProcessingStatus::Queued),
            "processing" => Ok(ProcessingStatus::Processing),
            "completed" => Ok(ProcessingStatus::Completed),
            "failed" => Ok(ProcessingStatus::Failed),
            "cancelled" => Ok(ProcessingStatus::Cancelled),
            _ => Err(format!("Unknown status: {}", s)),
        }
    }
}