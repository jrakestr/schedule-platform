"use client";

import { DOW_LIST, type Agent } from "@/lib/data/types";
import { shiftColor } from "@/lib/compute/colors";
import { cn } from "@/lib/utils";

interface WeekStripProps {
  agent: Agent;
  className?: string;
}

/** Mon–Sun at-a-glance with shift template merged into one visual block. */
export function WeekStrip({ agent, className }: WeekStripProps) {
  const works = new Set(agent.works_days ?? []);
  const dotColor = shiftColor(agent.shift_id);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/5 dark:ring-white/10"
            style={{ background: dotColor }}
          />
          <span className="truncate text-xs font-semibold tracking-tight font-mono">
            {agent.shift_id}
          </span>
          <span className="hidden truncate text-[11px] text-muted-foreground sm:inline num">
            {agent.start_clock}–{agent.end_clock}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[10px] text-muted-foreground">
          {agent.shift_class && (
            <span className="rounded-md border border-border/60 bg-muted/30 px-1.5 py-0.5 font-medium uppercase tracking-wide">
              {agent.shift_class}
            </span>
          )}
          {typeof agent.effective_hours_per_week === "number" && (
            <span className="num font-medium tabular-nums">
              {agent.effective_hours_per_week.toFixed(1)}h/wk
            </span>
          )}
        </div>
      </div>

      <div className="grid w-full min-w-0 grid-cols-7 divide-x divide-border/40">
        {DOW_LIST.map((d) => {
          const on = works.has(d);
          return (
            <div
              key={d}
              className={cn(
                "min-w-0 px-1 py-3 text-center",
                on ? "bg-background" : "bg-muted/25",
              )}
            >
              <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {d.slice(0, 3)}
              </div>
              {on ? (
                <>
                  <div
                    className="mx-auto mt-2 h-1 w-6 max-w-full rounded-full"
                    style={{ background: dotColor }}
                  />
                  <div className="num mt-2 text-[10px] font-medium tabular-nums leading-tight text-foreground">
                    {agent.start_clock}
                  </div>
                  <div className="num text-[10px] tabular-nums text-muted-foreground">
                    {agent.end_clock}
                  </div>
                </>
              ) : (
                <div className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/45">
                  Off
                </div>
              )}
            </div>
          );
        })}
      </div>

      {agent.off_pair && (
        <div className="border-t border-border/50 px-4 py-2 text-[10px] text-muted-foreground">
          Off days:{" "}
          <span className="font-medium text-foreground/80">{agent.off_pair}</span>
        </div>
      )}
    </div>
  );
}
