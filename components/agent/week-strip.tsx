"use client";

import { DOW_LIST, type Agent } from "@/lib/data/types";
import { shiftColor } from "@/lib/compute/colors";
import { cn } from "@/lib/utils";

interface WeekStripProps {
  agent: Agent;
  shiftLabel?: string;
  className?: string;
}

/** Mon–Sun at-a-glance: shift window or OFF, with optional template chip row. */
export function WeekStrip({ agent, shiftLabel, className }: WeekStripProps) {
  const works = new Set(agent.works_days ?? []);

  return (
    <div className={cn("rounded-xl border bg-muted/15 overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-2 border-b bg-card/60 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ background: shiftColor(agent.shift_id) }}
          />
          <span className="font-mono text-xs font-semibold tabular-nums truncate">
            {agent.shift_id}
          </span>
          {shiftLabel && (
            <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">
              {shiftLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 text-[10px] text-muted-foreground">
          {agent.shift_class && (
            <span className="rounded-full border px-2 py-0.5 font-medium bg-background/80">
              {agent.shift_class}
            </span>
          )}
          {typeof agent.effective_hours_per_week === "number" && (
            <span className="num font-mono tabular-nums">
              {agent.effective_hours_per_week.toFixed(1)}h
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-7 divide-x divide-border/60">
        {DOW_LIST.map((d) => {
          const on = works.has(d);
          return (
            <div
              key={d}
              className={cn(
                "px-1 py-2.5 text-center min-w-0 transition-colors",
                on ? "bg-background/50" : "bg-muted/20",
              )}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {d}
              </div>
              {on ? (
                <>
                  <div
                    className="mx-auto mt-1.5 h-1 w-6 rounded-full"
                    style={{ background: shiftColor(agent.shift_id) }}
                  />
                  <div className="num mt-1.5 text-[9px] font-mono tabular-nums leading-tight text-foreground">
                    {agent.start_clock}
                  </div>
                  <div className="num text-[9px] font-mono tabular-nums text-muted-foreground">
                    {agent.end_clock}
                  </div>
                </>
              ) : (
                <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
                  Off
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(agent.off_pair || agent.start_clock) && (
        <div className="border-t px-3 py-1.5 text-[10px] text-muted-foreground num font-mono tabular-nums">
          {agent.start_clock} – {agent.end_clock}
          {agent.off_pair ? ` · off ${agent.off_pair}` : ""}
        </div>
      )}
    </div>
  );
}
