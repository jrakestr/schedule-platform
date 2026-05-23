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
        "inline-flex gap-1 bg-muted p-1 rounded-lg",
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
            "px-3 py-1 rounded-md text-sm transition-colors",
            d === day
              ? "bg-background shadow-sm font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onChange(d)}
        >
          {d}
        </button>
      ))}
    </div>
  );
}
