"use client";

import { useMemo, useEffect, useState } from "react";
import { useQueryState } from "nuqs";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  SelectItem 
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"; // Assumed path for accessible tooltips

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

  // Fix hydration mismatch for locale-dependent date rendering
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

  // Avoid runtime crashes with empty/missing optimization IDs
  const validOptimizations = useMemo(() => {
    return optimizations.filter((opt) => opt.id);
  }, [optimizations]);

  return (
    <TooltipProvider>
      <header className="bg-card border-b relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-no-repeat bg-cover bg-center pointer-events-none select-none mix-blend-multiply dark:mix-blend-screen opacity-[0.05] dark:opacity-[0.02] bg-[url('/28.jpg')]"
        />
        <div className="relative z-10 mx-auto max-w-7xl px-6 py-4 flex flex-wrap items-start gap-6 justify-between">
          <div className="flex-1 min-w-[280px]">
            <h1 className="text-xl font-semibold tracking-tight">
              MJM ParaTransit · Schedule Review
            </h1>
            <p className="text-xs text-muted-foreground mt-1 num">
              Call volume · {snapshot.meta.source_rows.toLocaleString()} call
              records · forecast weeks {snapshot.meta.forecast_weeks.join(", ")}
              {refreshedLabel ? ` · refreshed ${refreshedLabel}` : null}
            </p>
          </div>
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex flex-col gap-1 min-w-[180px]">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Roster run
              </span>
              <Select 
                value={optId || "default"} 
                onValueChange={(val) => setOptId(val === "default" ? "" : val)}
              >
                <SelectTrigger className="w-[180px] h-9 text-xs bg-background">
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
              tip="Fixed approved headcount across CSA + NDS + SDS + Supervisor."
            >
              <AnimatedNumber value={snapshot.meta.total_bodies} />
            </KpiTile>

            <LeadSlider leadPct={leadPct} onChange={setLeadPct} disabled={isViewer} />
            <div className="flex items-center gap-2">
              {isViewer && (
                <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40 h-7 font-semibold font-sans px-2.5">
                  Viewer Mode (Read-Only)
                </Badge>
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
        <Card className="px-3 py-2 shadow-none border-border/60 transition-colors hover:border-primary/40 cursor-help">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className={cn("text-lg font-semibold num", tone)}>
            {children}
          </div>
        </Card>
      </TooltipTrigger>
      <TooltipContent className="max-w-[240px] text-xs">
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}

function FixedBanner() {
  return (
    <div className="bg-amber-100/80 border-t border-amber-200 dark:bg-amber-950/30 dark:border-amber-900">
      <div className="mx-auto max-w-7xl px-6 py-2 flex items-center justify-between text-xs text-amber-950 dark:text-amber-200 font-medium">
        <div>
          <span className="font-semibold text-amber-950 dark:text-amber-100">Fixed headcount.</span> 36 CSA (4
          Leads) · 3 NDS · 8 SDS (2 Leads) · 6 Supervisors. This platform
          shows how to distribute the existing roster. It does not request
          additional headcount.
        </div>
      </div>
    </div>
  );
}
