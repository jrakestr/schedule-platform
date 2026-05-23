"use client";

import { DOW_LIST, type DOW } from "@/lib/data/types";
import { cn } from "@/lib/utils";

interface DayTabsProps {
  day: DOW;
  onChange: (day: DOW) => void;
  className?: string;
}

export function DayTabs({ day, onChange, className }: DayTabsProps) {
  return (
    <div
      className={cn(
        "inline-flex gap-0.5 p-1 rounded-lg surface-inset",
        className,
      )}
      role="tablist"
      aria-label="Day of week"
    >
      {DOW_LIST.map((d) => (
        <button
          key={d}
          type="button"
          role="tab"
          aria-selected={d === day}
          className={cn(
            "px-3 py-1 rounded-md text-sm transition-all font-medium",
            d === day
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
          )}
          onClick={() => onChange(d)}
        >
          {d}
        </button>
      ))}
    </div>
  );
}
