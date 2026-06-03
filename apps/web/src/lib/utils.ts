import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFileSize(bytes: number | string | undefined | null): string {
  if (bytes === null || bytes === undefined) return "—";
  const n = typeof bytes === "string" ? Number(bytes) : bytes;
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    Math.floor(Math.log(n) / Math.log(k)),
    sizes.length - 1
  );
  return `${parseFloat((n / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1))} ${sizes[i]}`;
}

export function formatDuration(seconds: number | undefined | null): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "0:00";
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatLongDuration(seconds: number | undefined | null): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "0s";
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export function formatDate(
  date: Date | string | number | undefined | null
): string {
  if (date === null || date === undefined) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatRelativeTime(
  date: Date | string | number | undefined | null
): string {
  if (date === null || date === undefined) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";

  const now = Date.now();
  const diff = now - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(d);
}

export function truncate(str: string | null | undefined, length: number): string {
  if (!str) return "";
  if (str.length <= length) return str;
  return str.slice(0, length) + "…";
}

export function getFileCategory(
  mimeType: string | null | undefined
): "video" | "audio" | "image" | "document" | "other" {
  if (!mimeType) return "other";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("image/")) return "image";
  if (
    mimeType === "application/pdf" ||
    mimeType.includes("msword") ||
    mimeType.includes("officedocument") ||
    mimeType.startsWith("text/")
  )
    return "document";
  return "other";
}

export function getStatusColor(
  status: string | null | undefined
): "default" | "secondary" | "destructive" | "success" | "warning" | "outline" {
  switch (status?.toUpperCase()) {
    case "COMPLETED":
    case "READY":
    case "SUCCESS":
      return "success";
    case "PROCESSING":
    case "RUNNING":
    case "PENDING":
    case "QUEUED":
      return "warning";
    case "FAILED":
    case "ERROR":
      return "destructive";
    default:
      return "secondary";
  }
}

export function getStatusLabel(status: string | null | undefined): string {
  if (!status) return "Unknown";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function getInitials(name: string | null | undefined, fallback = "U"): string {
  if (!name || name.trim().length === 0) return fallback;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function getImportanceLabel(score: number): {
  label: string;
  className: string;
} {
  if (score >= 0.8) return { label: "High", className: "text-red-500" };
  if (score >= 0.6) return { label: "Medium-High", className: "text-orange-500" };
  if (score >= 0.4) return { label: "Medium", className: "text-amber-500" };
  return { label: "Low", className: "text-muted-foreground" };
}

export function getCategoryLabel(category: string): string {
  return category
    .split("_")
    .map((s) => s.charAt(0) + s.slice(1).toLowerCase())
    .join(" ");
}
