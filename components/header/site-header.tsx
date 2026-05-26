"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteOptimizationRun } from "@/lib/api/optimizer";
import { Button } from "@/components/ui/button";
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
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { Snapshot } from "@/lib/data/types";
import type { TabId } from "@/components/tab-ids";
import type { OptimizationMeta } from "@/lib/data/snapshot";

interface SiteHeaderProps {
  snapshot: Snapshot;
  leadPct: number;
  setLeadPct: (n: number) => void;
  onJump: (tab: TabId) => void;
  optimizations: OptimizationMeta[];
  sidebarToggle?: React.ReactNode;
}

export function SiteHeader({
  snapshot,
  leadPct,
  setLeadPct,
  onJump,
  optimizations,
  sidebarToggle,
}: SiteHeaderProps) {
  const router = useRouter();
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

  const validOptimizations = useMemo(() => {
    return optimizations.filter((opt) => opt.id && opt.status === "succeeded");
  }, [optimizations]);

  const activeRun = useMemo(
    () => validOptimizations.find((opt) => opt.id === optId) ?? null,
    [validOptimizations, optId],
  );

  const [deletingRun, setDeletingRun] = useState(false);

  const handleDeleteActiveRun = async () => {
    if (!optId || !activeRun || isViewer) return;
    if (
      !confirm(
        `Permanently delete optimization run "${activeRun.run_name}"? This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeletingRun(true);
    try {
      await deleteOptimizationRun(optId);
      await setOptId("");
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete optimization run.");
    } finally {
      setDeletingRun(false);
    }
  };

  return (
    <header className="border-b relative overflow-hidden surface-panel">
        <div className="relative z-10 mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-6 px-4 py-5 sm:px-6">
          <div className="flex min-w-[280px] flex-1 items-start gap-3">
            {sidebarToggle}
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/80">
                Scheduling application
              </p>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                MJM Brokerage Scheduling Application
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex flex-col gap-1 min-w-[180px]">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Roster run
              </span>
              <div className="flex items-center gap-1.5">
                <Select
                  value={optId || "default"}
                  onValueChange={async (val) => {
                    await setOptId(val === "default" ? "" : val);
                    router.refresh();
                  }}
                >
                  <SelectTrigger className="w-[180px] h-9 text-xs surface-inset">
                    <SelectValue placeholder="Default Baseline" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default" className="text-xs">
                      Default Baseline
                    </SelectItem>
                    {optId &&
                      !validOptimizations.some((opt) => opt.id === optId) && (
                        <SelectItem value={optId} className="text-xs">
                          Run {optId.slice(0, 8)}…
                        </SelectItem>
                      )}
                    {validOptimizations.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id} className="text-xs">
                        {opt.run_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {optId && activeRun && !isViewer && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                    onClick={handleDeleteActiveRun}
                    disabled={deletingRun}
                    title={`Delete run "${activeRun.run_name}"`}
                    aria-label={`Delete run ${activeRun.run_name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <KpiTile
              label="Volume-matched share"
              tone={toneClass(matched)}
              tip="Share of weekly offered calls (call_segments_cleaned.csv forecast) that land in intervals where CSA Voice supply is scheduled. Shape metric — not Erlang service level."
              onClick={() => onJump("coverage")}
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
              onClick={() => onJump("supervisor")}
            >
              {supOK ? "24/7" : "Gap"}
            </KpiTile>

            <KpiTile
              label="Approved roster"
              tone="text-foreground"
              tip="53 roster bodies: 36 CSA, 8 SDS, 3 NDS, 6 Supervisor."
              onClick={() => onJump("roster")}
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
      </header>
  );
}

interface KpiTileProps {
  label: string;
  children: React.ReactNode;
  tone: string;
  tip: string;
  onClick?: () => void;
}

function KpiTile({ label, children, tone, tip, onClick }: KpiTileProps) {
  const inner = (
    <>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </div>
      <div className={cn("text-lg font-semibold num leading-tight mt-0.5", tone)}>
        {children}
      </div>
    </>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {onClick ? (
          <button
            type="button"
            onClick={onClick}
            className="px-3.5 py-2.5 rounded-lg surface-inset transition-colors hover:outline-primary/20 cursor-pointer min-w-[7rem] kpi-stat text-left"
          >
            {inner}
          </button>
        ) : (
          <div className="px-3.5 py-2.5 rounded-lg surface-inset transition-colors hover:outline-primary/20 cursor-help min-w-[7rem] kpi-stat">
            {inner}
          </div>
        )}
      </TooltipTrigger>
      <TooltipContent className="max-w-[240px] text-xs">
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}