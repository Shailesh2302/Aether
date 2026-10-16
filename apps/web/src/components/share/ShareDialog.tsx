"use client";

import { useState } from "react";
import { shareApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Share2, Copy, Check, Loader2, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId?: string;
  clipId?: string;
  title: string;
}

const EXPIRY = [
  { label: "Never", value: 0 },
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
];

export function ShareDialog({ open, onOpenChange, fileId, clipId, title }: ShareDialogProps) {
  const [days, setDays] = useState(7);
  const [creating, setCreating] = useState(false);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const created = await shareApi.create({
        ...(fileId ? { fileId } : {}),
        ...(clipId ? { clipId } : {}),
        ...(days > 0 ? { expiresInDays: days } : {}),
      });
      setLink(shareApi.fullUrl(created.token));
    } catch {
      toast({ title: "Couldn't create link", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed - select the link manually" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            Share “{title}”
          </DialogTitle>
        </DialogHeader>
        {!link ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Anyone with the link can view and download. No sign-in needed.
            </p>
            <div className="space-y-2">
              <Label>Link expires</Label>
              <div className="flex gap-2">
                {EXPIRY.map((e) => (
                  <Button
                    key={e.label}
                    size="sm"
                    variant={days === e.value ? "default" : "outline"}
                    onClick={() => setDays(e.value)}
                  >
                    {e.label}
                  </Button>
                ))}
              </div>
            </div>
            <Button className="w-full" onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create link"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Label>Share this link</Label>
            <div className="flex gap-2">
              <Input value={link} readOnly onFocus={(e) => e.target.select()} />
              <Button size="icon" onClick={handleCopy} aria-label="Copy link">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setLink("");
              }}
            >
              Create another
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function RevokeShareButton({ id, onRevoked }: { id: string; onRevoked: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await shareApi.remove(id);
          onRevoked();
        } catch {
          toast({ title: "Couldn't revoke link", variant: "destructive" });
          setBusy(false);
        }
      }}
      className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      aria-label="Revoke link"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
