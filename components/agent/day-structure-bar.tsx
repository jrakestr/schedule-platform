"use client";

import { useMemo } from "react";
import { parseSegs } from "@/lib/compute/supply";
import { segmentKindColor } from "@/lib/navigation/panel-params";
import { cn } from "@/lib/utils";

interface DayStructureBarProps {
  structure: string;
  className?: string;
}

function formatMin(m: number): string {
  const wrapped = ((m % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const min = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

const KINDS = ["Voice", "Break", "Lunch"] as const;

/** Horizontal segment bar for Voice / Break / Lunch day structure. */
export function DayStructureBar({ structure, className }: DayStructureBarProps) {
  const segments = useMemo(() => parseSegs(structure), [structure]);

  if (!segments.length) {
    return (
      <p className="text-xs text-muted-foreground">{structure || "No structure data"}</p>
    );
  }

  const startMin = segments[0]?.start ?? 0;
  const endMin = segments[segments.length - 1]?.end ?? startMin + 1;
  const span = Math.max(endMin - startMin, 1);

  return (
    <div className={cn("rounded-xl border bg-muted/15 p-3 space-y-2.5", className)}>
      <div
        className="flex h-3.5 w-full overflow-hidden rounded-full border bg-background/80 shadow-inner"
        role="img"
        aria-label="Day structure timeline"
      >
        {segments.map((seg, i) => {
          const widthPct = ((seg.end - seg.start) / span) * 100;
          return (
            <div
              key={`${seg.start}-${seg.kind}-${i}`}
              className="h-full shrink-0 first:rounded-l-full last:rounded-r-full"
              style={{
                width: `${widthPct}%`,
                backgroundColor: segmentKindColor(seg.kind),
              }}
              title={`${formatMin(seg.start)}–${formatMin(seg.end)} ${seg.kind}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        {KINDS.map((kind) => (
          <span
            key={kind}
            className="inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: segmentKindColor(kind) }}
            />
            {kind}
          </span>
        ))}
      </div>
    </div>
  );
}
