"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SliderProps {
  value: number[];
  onValueChange: (value: number[]) => void;
  max?: number;
  min?: number;
  step?: number;
  className?: string;
}

const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  ({ value, onValueChange, max = 100, min = 0, step = 1, className }, ref) => {
    const percentage = ((value[0] - min) / (max - min)) * 100;

    return (
      <div ref={ref} className={cn("relative w-full", className)}>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="absolute h-full bg-primary transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value[0]}
          onChange={(e) => onValueChange([Number(e.target.value)])}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
    );
  }
);
Slider.displayName = "Slider";

export { Slider };