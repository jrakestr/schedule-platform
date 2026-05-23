"use client";

import { useState, useEffect } from "react";
import { Slider } from "@/components/ui/slider";

interface LeadSliderProps {
  leadPct: number;
  onChange: (value: number) => void;
}

export function LeadSlider({ leadPct, onChange }: LeadSliderProps) {
  const [localValue, setLocalValue] = useState(Math.round(leadPct * 100));

  useEffect(() => {
    setLocalValue(Math.round(leadPct * 100));
  }, [leadPct]);

  return (
    <div className="flex flex-col gap-1 min-w-[180px]">
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex justify-between">
        <span>Lead time on phones</span>
        <span className="num text-foreground font-medium">{localValue}%</span>
      </label>
      <Slider
        min={50}
        max={80}
        step={5}
        value={[localValue]}
        onValueChange={(v) => setLocalValue(v[0])}
        onValueCommit={(v) => onChange(v[0] / 100)}
      />
    </div>
  );
}
