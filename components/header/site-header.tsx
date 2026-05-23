"use client";

import { useMemo, useEffect, useState } from "react";
import { useQueryState } from "nuqs";
import { cn } from "@/lib/utils";
import { LeadSlider } from "@/components/header/lead-slider";
import { ThemeToggle } from "@/components/header/theme-toggle";
import { CommandPalette } from "@/components/header/command-palette";
import { AnimatedNumber } from "@/components/charts/animated-number";
import { volumeMatchedShare } from "@/lib/compute/coverage";
import { toneClass } from "@/lib/compute/colors";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { Snapshot } from "@/lib/data/types";
import type { TabId } from "@/components/tab-ids";
import type { OptimizationMeta } from "@/lib/data/snapshot";

interface SiteHeaderProps {
  snapshot: Snapshot;
  takenAt: string | null;
  leadPct: number;
  setLeadPct: (n: number) => void;
  onJump: (tab: TabId) => void;
  optimizations: OptimizationMeta[];
}

export function SiteHeader({
  snapshot,
  takenAt,
  leadPct,
  setLeadPct,
  onJump,
  optimizations,
}: SiteHeaderProps) {
  const [optId, setOptId] = useQueryState("opt_id", {
    defaultValue: "",
    clearOnDefault: true,
    shallow: false,
  });

  const [mode] = useQueryState("mode", {
    defaultValue: "",
    clearOnDefault: true,
  });
  const isViewer = mode === "viewer";

  const matched = useMemo(
    () => volumeMatchedShare(snapshot, leadPct),
    [snapshot, leadPct],
  );

  const supOK = snapshot.supervisor_schedule.min_coverage >= 1;

  const [refreshedLabel, setRefreshedLabel] = useState<string | null>(null);

  useEffect(() => {
    if (takenAt) {
      setRefreshedLabel(
        new Date(takenAt).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    }
  }, [takenAt]);

  const validOptimizations = useMemo(() => {
    return optimizations.filter((opt) => opt.id);
  }, [optimizations]);

  return (
    <TooltipProvider>
      <header className="border-b relative overflow-hidden surface-panel">
        <div
          className="absolute inset-0 dot-grid pointer-events-none select-none opacity-40 dark:opacity-25"
          aria-hidden
        />
        <div
          className="absolute inset-0 pointer-events-none select-none"
          style={{
            background:
              "linear-gradient(105deg, hsl(var(--surface-wash) / 0.9) 0%, transparent 50%, hsl(var(--primary) / 0.03) 100%)",
          }}
          aria-hidden
        />
        <div className="relative z-10 mx-auto max-w-7xl px-6 py-5 flex flex-wrap items-start gap-6 justify-between">
          <div className="flex-1 min-w-[280px]">
            <p className="text-[10px] uppercase tracking-[0.2em] text-primary/80 font-semibold mb-1">
              Staffing review
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              MJM ParaTransit · Schedule Review
            </h1>
            <p className="text-xs text-muted-foreground mt-1.5 num font-mono leading-relaxed">
              Call volume · {snapshot.meta.source_rows.toLocaleString()} call
              records · forecast weeks {snapshot.meta.forecast_weeks.join(", ")}
              {refreshedLabel ? ` · refreshed ${refreshedLabel}` : null}
            </p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex flex-col gap-1 min-w-[180px]">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Roster run
              </span>
              <Select
                value={optId || "default"}
                onValueChange={(val) => setOptId(val === "default" ? "" : val)}
              >
                <SelectTrigger className="w-[180px] h-9 text-xs surface-inset">
                  <SelectValue placeholder="Default Baseline" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default" className="text-xs">
                    Default Baseline
                  </SelectItem>
                  {validOptimizations.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id} className="text-xs">
                      {opt.run_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <KpiTile
              label="Volume-matched share"
              tone={toneClass(matched)}
              tip="Share of weekly call volume that lands in hours where staff is scheduled. Higher = better aligned distribution of the fixed roster."
            >
              <AnimatedNumber
                value={matched}
                format={(v) => `${(v * 100).toFixed(1)}%`}
              />
            </KpiTile>

            <KpiTile
              label="Supervisor on duty"
              tone={
                supOK
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-rose-700 dark:text-rose-400"
              }
              tip="At least one supervisor on duty every hour of the week."
            >
              {supOK ? "24/7" : "Gap"}
            </KpiTile>

            <KpiTile
              label="Approved roster"
              tone="text-foreground"
              tip="53 roster bodies: 36 CSA, 8 SDS, 3 NDS, 6 Supervisor."
            >
              <AnimatedNumber value={snapshot.meta.total_bodies} />
            </KpiTile>

            <LeadSlider leadPct={leadPct} onChange={setLeadPct} disabled={isViewer} />
            <div className="flex items-center gap-2">
              {isViewer && (
                <span className="inline-flex items-center rounded-md border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold h-7 px-2.5">
                  Viewer Mode (Read-Only)
                </span>
              )}
              <CommandPalette snapshot={snapshot} onJump={onJump} />
              <ThemeToggle />
            </div>
          </div>
        </div>
        <FixedBanner />
      </header>
    </TooltipProvider>
  );
}

interface KpiTileProps {
  label: string;
  children: React.ReactNode;
  tone: string;
  tip: string;
}

function KpiTile({ label, children, tone, tip }: KpiTileProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="px-3.5 py-2.5 rounded-lg surface-inset transition-colors hover:outline-primary/20 cursor-help min-w-[7rem] kpi-stat">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            {label}
          </div>
          <div className={cn("text-lg font-semibold num leading-tight mt-0.5", tone)}>
            {children}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-[240px] text-xs">
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}

function FixedBanner() {
  return (
    <div className="relative border-t border-amber-200/80 dark:border-amber-900/50 bg-gradient-to-r from-amber-100/90 via-amber-50/80 to-amber-100/90 dark:from-amber-950/40 dark:via-amber-950/25 dark:to-amber-950/40">
      <div className="mx-auto max-w-7xl px-6 py-2 flex items-center justify-between text-xs text-amber-950 dark:text-amber-200 font-medium">
        <div>
          <span className="font-semibold text-amber-950 dark:text-amber-100">Fixed 53 roster.</span>{" "}
          36 CSA (4 Lead) · 8 SDS (2 Lead) · 3 NDS · 6 Supervisor. Redistribution
          only — no headcount requests.
        </div>
      </div>
    </div>
  );
}
