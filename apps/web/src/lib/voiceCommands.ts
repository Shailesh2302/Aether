export type VoiceIntent =
  | { type: "navigate"; href: string; label: string }
  | { type: "search"; q: string }
  | { type: "help" }
  | { type: "openFile"; query: string };

const NAV_TARGETS: Array<{ keys: string[]; href: string; label: string }> = [
  { keys: ["dashboard", "home", "overview"], href: "/dashboard", label: "dashboard" },
  { keys: ["upload"], href: "/upload", label: "upload page" },
  { keys: ["search"], href: "/search", label: "search page" },
  { keys: ["clip"], href: "/dashboard/clips", label: "clips" },
  { keys: ["file", "library", "storage", "drive"], href: "/dashboard/files", label: "files" },
  { keys: ["video"], href: "/dashboard/videos", label: "videos" },
  { keys: ["chat"], href: "/dashboard/chat", label: "chat" },
  { keys: ["setting"], href: "/dashboard/settings", label: "settings" },
  { keys: ["billing", "subscription", "payment"], href: "/dashboard/billing", label: "billing" },
  { keys: ["pricing", "plan", "price"], href: "/pricing", label: "pricing" },
];

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Remove conversational filler so "bring me the docker video please" -> "docker". */
export function stripFillers(s: string): string {
  const cleaned = normalize(s)
    .replace(/\b(please|kindly)\b/g, " ")
    .replace(/\b(me|my|the|a|an|that|this|for me|to me)\b/g, " ")
    .replace(/\b(called|named|titled)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Media-type words only count as filler at the end ("the docker video" -> "docker").
  return cleaned
    .replace(/\s+(file|files|video|videos|pdf|pdfs|document|documents|clip|clips|footage|recording)$/, "")
    .trim();
}

export function parseVoiceCommand(raw: string): VoiceIntent | null {
  const text = normalize(raw);
  if (!text) return null;

  if (/^(help|what can you do|commands|how do i use (this|you))$/.test(text)) {
    return { type: "help" };
  }

  const goMatch = text.match(/^(go to|open page|show page|take me to|navigate to)\s+(.+)$/);
  if (goMatch) {
    const dest = goMatch[2];
    const target = NAV_TARGETS.find((t) => t.keys.some((k) => dest.includes(k)));
    if (target) return { type: "navigate", href: target.href, label: target.label };
    return null; // explicit page request we don't know - don't fall through to file noise
  }

  const searchMatch = text.match(/^(search|look up|look for|find videos? (about|on))\s+(for\s+)?(.+)$/);
  if (searchMatch) {
    const q = stripFillers(searchMatch[4] || searchMatch[2]);
    if (q) return { type: "search", q };
  }

  const openMatch = text.match(/^(open|find|show|play|get|bring|bring me|load|start)\s+(.+)$/);
  if (openMatch) {
    const query = stripFillers(openMatch[2]);
    if (query) return { type: "openFile", query };
    return null;
  }

  // Bare query: treat as a file lookup.
  const query = stripFillers(text);
  if (!query) return null;
  return { type: "openFile", query };
}

export function scoreMatch(query: string, name: string): number {
  const q = normalize(query);
  const n = normalize(name);
  if (!q) return 0;
  if (n.includes(q)) return 100 + q.length;
  // Short words ("no", "a", "3") match everywhere - ignore them, and require
  // at least half the remaining words to hit to avoid false positives.
  const words = q.split(" ").filter((w) => w.length > 2);
  if (words.length === 0) return 0;
  const hits = words.filter((w) => n.includes(w)).length;
  if (hits === 0 || hits / words.length < 0.5) return 0;
  return (hits / words.length) * 90;
}

export interface RankedFile<T> {
  file: T;
  score: number;
}

export function rankFiles<T extends { originalName: string }>(query: string, files: T[]): RankedFile<T>[] {
  return files
    .map((file) => ({ file, score: scoreMatch(query, file.originalName) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}
