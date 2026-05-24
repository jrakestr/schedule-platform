"use client";

import { useMemo, useState } from "react";
import { getIntervalSeries } from "@/lib/compute/distribution";
import { formatClock12 } from "@/lib/compute/day-structure";
import { cn } from "@/lib/utils";
import type { DOW, Snapshot } from "@/lib/data/types";

const WINDOW_START = 4;
const WINDOW_END = 24;
const BAR_H = 56;

interface StaffingStripProps {
  snapshot: Snapshot;
  day: DOW;
  leadPct: number;
  className?: string;
}

/** Required vs proposed CSA headcount strip for the intraday timeline window. */
export function StaffingStrip({
  snapshot,
  day,
  leadPct,
  className,
}: StaffingStripProps) {
  const [activeHour, setActiveHour] = useState<number | null>(null);

  const { hours, maxVal, intervals } = useMemo(() => {
    const { required, proposed } = getIntervalSeries(
      snapshot,
      day,
      "Combined",
      leadPct,
    );
    const hourlyReq = Array.from(
      { length: 24 },
      (_, h) => (required[h * 2] + required[h * 2 + 1]) / 2,
    );
    const hourlyProp = Array.from(
      { length: 24 },
      (_, h) => (proposed[h * 2] + proposed[h * 2 + 1]) / 2,
    );
    const windowHours = Array.from(
      { length: WINDOW_END - WINDOW_START },
      (_, i) => WINDOW_START + i,
    );
    const max = Math.max(
      ...windowHours.flatMap((h) => [hourlyReq[h] ?? 0, hourlyProp[h] ?? 0]),
      1,
    );
    return {
      hours: windowHours.map((h) => ({
        hour: h,
        required: hourlyReq[h] ?? 0,
        proposed: hourlyProp[h] ?? 0,
      })),
      intervals: { required, proposed },
      maxVal: max,
    };
  }, [snapshot, day, leadPct]);

  const activeRow = activeHour !== null ? hours.find((h) => h.hour === activeHour) : null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium uppercase tracking-wider">
          CSA headcount
        </span>
        <span className="inline-flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-sm bg-slate-400/70" />
            Required
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-sm bg-indigo-500/80" />
            Proposed
          </span>
        </span>
      </div>
      <div
        className="grid gap-px overflow-hidden rounded-md border bg-border/40"
        style={{
          gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))`,
        }}
      >
        {hours.map(({ hour, required, proposed }) => (
          <button
            key={hour}
            type="button"
            className={cn(
              "relative cursor-pointer bg-muted/30 transition-colors hover:bg-muted/50",
              activeHour === hour && "ring-1 ring-inset ring-primary/40",
            )}
            style={{ height: BAR_H }}
            title={`${String(hour).padStart(2, "0")}:00 · Req ${required.toFixed(1)} · Prop ${proposed.toFixed(1)}`}
            onClick={() => setActiveHour((h) => (h === hour ? null : hour))}
          >
            <div
              className="absolute bottom-1 left-1 right-1 rounded-t-sm bg-slate-400/55"
              style={{ height: `${Math.max(4, (required / maxVal) * (BAR_H - 8))}px` }}
            />
            <div
              className="absolute bottom-1 left-1/4 right-1/4 rounded-t-sm bg-indigo-500/80"
              style={{ height: `${Math.max(4, (proposed / maxVal) * (BAR_H - 8))}px` }}
            />
          </button>
        ))}
      </div>
      {activeRow && (
        <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
          <div className="mb-2 text-sm font-semibold">
            {day} · {formatClock12(activeRow.hour * 60)}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-1.5 text-left font-medium">Interval</th>
                <th className="py-1.5 text-right font-medium num">Staffing</th>
                <th className="py-1.5 text-right font-medium num">Required</th>
                <th className="py-1.5 text-right font-medium num">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {[0, 1].map((half) => {
                const idx = activeRow.hour * 2 + half;
                const prop = intervals.proposed[idx] ?? 0;
                const req = intervals.required[idx] ?? 0;
                const cov = prop - req;
                return (
                  <tr key={half} className="border-b border-border/40">
                    <td className="py-1.5 font-mono">
                      {formatClock12(activeRow.hour * 60 + half * 30)}
                    </td>
                    <td className="py-1.5 text-right num tabular-nums">{prop.toFixed(1)}</td>
                    <td className="py-1.5 text-right num tabular-nums">{req.toFixed(1)}</td>
                    <td
                      className={cn(
                        "py-1.5 text-right num tabular-nums font-semibold",
                        cov < -0.5 && "text-rose-700 dark:text-rose-400",
                        cov > 0.5 && "text-sky-700 dark:text-sky-400",
                      )}
                    >
                      {cov >= 0 ? "+" : ""}
                      {cov.toFixed(1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div
        className="grid text-xs text-muted-foreground num tabular-nums"
        style={{
          gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))`,
        }}
      >
        {hours.map(({ hour }) => (
          <span key={hour} className="text-center">
            {hour % 2 === 0 ? String(hour).padStart(2, "0") : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
