"use client";

import { useState } from "react";
import { filesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Download, FileDown } from "lucide-react";

interface ExportMenuProps {
  fileId: string;
  hasSummary: boolean;
  className?: string;
}

const FORMATS = [
  { id: "txt", label: "Transcript (.txt)" },
  { id: "srt", label: "Subtitles (.srt)" },
  { id: "vtt", label: "Subtitles (.vtt)" },
  { id: "md", label: "Summary (.md)" },
  { id: "json", label: "Summary (.json)" },
] as const;

export function ExportMenu({ fileId, hasSummary, className }: ExportMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={className}>
      <Button
        size="sm"
        variant="outline"
        className="w-full"
        onClick={() => setOpen((v) => !v)}
      >
        <FileDown className="h-4 w-4 mr-1" />
        Export
      </Button>
      {open && (
        <div className="mt-2 space-y-1 rounded-md border p-2">
          {FORMATS.map((f) => {
            const needsSummary = f.id === "md" || f.id === "json";
            const disabled = needsSummary && !hasSummary;
            return (
              <a
                key={f.id}
                href={disabled ? undefined : filesApi.exportUrl(fileId, f.id)}
                download={!disabled}
                onClick={disabled ? (e) => e.preventDefault() : undefined}
                className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors ${
                  disabled
                    ? "cursor-not-allowed text-muted-foreground/50"
                    : "hover:bg-accent"
                }`}
                title={disabled ? "Generate a summary first" : `Download ${f.label}`}
              >
                <Download className="h-3 w-3" />
                {f.label}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
