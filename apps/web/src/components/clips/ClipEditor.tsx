"use client";

import { useState } from "react";
import { cn, formatDuration } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Check, X } from "lucide-react";
import type { File } from "@/lib/api";

interface ClipEditorProps {
  file: File;
  onSave: (startTime: number, endTime: number, name: string) => void;
  onCancel: () => void;
}

export function ClipEditor({ file, onSave, onCancel }: ClipEditorProps) {
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(file.duration || 60);
  const [name, setName] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);

  const handleSave = () => {
    if (name.trim() && endTime > startTime) {
      onSave(startTime, endTime, name.trim());
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Create Clip</h3>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="clip-name">Clip Name</Label>
        <Input
          id="clip-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter clip name"
        />
      </div>

      <div className="space-y-4 p-4 bg-muted rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Start Time</span>
          <span className="text-sm text-muted-foreground">
            {formatDuration(startTime)}
          </span>
        </div>
        <Slider
          value={[startTime]}
          onValueChange={([value]) => setStartTime(value)}
          max={endTime - 1}
          step={0.1}
        />
      </div>

      <div className="space-y-4 p-4 bg-muted rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">End Time</span>
          <span className="text-sm text-muted-foreground">
            {formatDuration(endTime)}
          </span>
        </div>
        <Slider
          value={[endTime]}
          onValueChange={([value]) => setEndTime(value)}
          min={startTime + 1}
          max={file.duration || 300}
          step={0.1}
        />
      </div>

      <div className="text-sm text-muted-foreground text-center">
        Duration: {formatDuration(endTime - startTime)}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={!name.trim() || endTime <= startTime}
          className="flex-1"
        >
          <Check className="h-4 w-4 mr-2" />
          Save Clip
        </Button>
      </div>
    </div>
  );
}