"use client";

import { useState } from "react";
import { videoApi, segmentsToVtt, type SubtitleTrack } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Languages, Loader2, Download, Captions } from "lucide-react";

interface TranslateBarProps {
  fileId: string;
  onSubtitles: (track: SubtitleTrack | null) => void;
  className?: string;
}

export function TranslateBar({ fileId, onSubtitles, className }: TranslateBarProps) {
  const [lang, setLang] = useState("Hindi");
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<SubtitleTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const translate = async () => {
    const target = lang.trim();
    if (!target || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await videoApi.translate(fileId, target);
      if (res.segments.length === 0) {
        setError("No transcript available to translate yet.");
        return;
      }
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      const url = URL.createObjectURL(
        new Blob([segmentsToVtt(res.segments)], { type: "text/vtt" })
      );
      setBlobUrl(url);
      const track: SubtitleTrack = {
        src: url,
        lang: target.slice(0, 2).toLowerCase(),
        label: target,
      };
      setActive(track);
      onSubtitles(track);
    } catch {
      setError("Translation failed - please try again.");
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl(null);
    setActive(null);
    onSubtitles(null);
  };

  const download = () => {
    if (!blobUrl || !active) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `subtitles-${active.label}.vtt`;
    a.click();
  };

  return (
    <div className={className}>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Captions className="h-3.5 w-3.5" />
        Subtitles
      </p>
      {active ? (
        <div className="flex items-center gap-2">
          <span className="flex-1 truncate text-xs">
            Showing: <span className="font-medium">{active.label}</span>
          </span>
          <Button size="sm" variant="ghost" onClick={download} aria-label="Download subtitles">
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" onClick={clear}>
            Off
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            placeholder="Hindi, Spanish, French…"
            className="h-8 text-xs"
          />
          <Button size="sm" onClick={translate} disabled={loading || !lang.trim()}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
          </Button>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
