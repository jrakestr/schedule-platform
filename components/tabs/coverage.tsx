"use client";

import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import { SectionCard } from "@/components/shared/section-card";
import { DayTabs } from "@/components/shared/day-tabs";
import { ShapeChart } from "@/components/charts/shape-chart";
import { StatTile } from "@/components/charts/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { csaSupply, schedulerSupply } from "@/lib/compute/supply";
import { getLegacyCsaSupply } from "@/lib/compute/legacy-supply";
import { f0, f1, pct, sum } from "@/lib/utils";
import { CSA_FUNCTIONS, type DOW } from "@/lib/data/types";
import type { Snapshot } from "@/lib/data/types";

// =============================================================================
// Coverage Tab (Proposed vs Current/Legacy distribution analysis)
// =============================================================================

interface CoverageTabProps {
  snapshot: Snapshot;
  leadPct: number;
}

export function CoverageTab({ snapshot, leadPct }: CoverageTabProps) {
  const [day, setDay] = useState<DOW>("Mon");
  const [viewMode, setViewMode] = useState<"proposed" | "legacy" | "compare">("proposed");
  const [metricMode, setMetricMode] = useState<"share" | "raw">("share");

  const stats = useMemo(() => {
    const off = snapshot.volume.offered_per_interval.Combined[day];
    const sup = csaSupply(snapshot.agents, day, leadPct);
    const legacySup = getLegacyCsaSupply(day);
    const offered = sum(off);
    const staff = sum(sup);
    const legacyStaff = sum(legacySup);
    const offTotal = offered || 1;
    const supTotal = staff || 1;
    let matchedShare = 0;
    for (let i = 0; i < 48; i++) {
      matchedShare += Math.min(off[i] / offTotal, sup[i] / supTotal);
    }
    const peakOffShare = Math.max(...off.map((v) => (v / offTotal) * 100));
    const peakSupShare = Math.max(...sup.map((v) => (v / supTotal) * 100));
    return { off, sup, legacySup, offered, staff, legacyStaff, matchedShare, peakOffShare, peakSupShare };
  }, [snapshot, day, leadPct]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <SectionCard
          className="lg:col-span-2"
          title={`Where the calls are vs where the people are · ${day}`}
          description={metricMode === "share"
            ? "Both curves are normalized to 100% of the day. The view isolates the shape mismatch between demand and staffing — it does not quantify the headcount gap."
            : "Actual calls per interval mapped against scheduled agent headcount on phones. This views exact volumes and active capacities rather than normalized shapes."
          }
          toolbar={
            <div className="flex flex-wrap gap-2 items-center">
              <div className="inline-flex gap-1 bg-muted p-1 rounded-md">
                <Button
                  variant={viewMode === "proposed" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs rounded-sm"
                  onClick={() => setViewMode("proposed")}
                >
                  Proposed
                </Button>
                <Button
                  variant={viewMode === "legacy" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs rounded-sm"
                  onClick={() => setViewMode("legacy")}
                >
                  Current/Legacy
                </Button>
                <Button
                  variant={viewMode === "compare" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs rounded-sm"
                  onClick={() => setViewMode("compare")}
                >
                  Compare Both
                </Button>
              </div>

              <div className="inline-flex gap-1 bg-muted p-1 rounded-md">
                <Button
                  variant={metricMode === "share" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs rounded-sm"
                  onClick={() => setMetricMode("share")}
                >
                  % Share
                </Button>
                <Button
                  variant={metricMode === "raw" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs rounded-sm"
                  onClick={() => setMetricMode("raw")}
                >
                  Raw Counts
                </Button>
              </div>

              <DayTabs day={day} onChange={setDay} />
            </div>
          }
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <StatTile
              label="Daily call volume"
              value={f0(stats.offered)}
              hint="Forecasted calls that day."
            />
            <StatTile
              label="Proposed CSA hours"
              value={f1(stats.staff / 2)}
              hint="Effective proposed CSA agent-hours (Lead slider applied)."
            />
            <StatTile
              label="Current/Legacy CSA hours"
              value={f1(stats.legacyStaff / 2)}
              hint="Effective current CSA agent-hours."
            />
            <StatTile
              label="Volume-matched share"
              value={pct(stats.matchedShare)}
              hint="Share of the day's calls that land in hours where CSAs are scheduled."
              tone={
                stats.matchedShare >= 0.8
                  ? "text-emerald-700 dark:text-emerald-400"
                  : stats.matchedShare >= 0.6
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-rose-700 dark:text-rose-400"
              }
            />
          </div>

          <ShapeChart
            offered={stats.off}
            supplied={stats.sup}
            legacySupplied={stats.legacySup}
            viewMode={viewMode}
            intervals={snapshot.meta.intervals}
            metricMode={metricMode}
          />

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-3">
            <Legend swatch="#94a3b8" label={metricMode === "share" ? "Call volume shape (% of day's calls)" : "Call volume (actual calls)"} />
            {(viewMode === "proposed" || viewMode === "compare") && (
              <Legend swatch="#4f46e5" label={metricMode === "share" ? "Proposed Scheduled CSA shape (% of day's scheduled hours)" : "Proposed Scheduled CSAs (headcount)"} />
            )}
            {(viewMode === "legacy" || viewMode === "compare") && (
              <Legend swatch="#ea580c" label={metricMode === "share" ? "Current/Legacy Scheduled CSA shape (% of day's scheduled hours)" : "Current/Legacy Scheduled CSAs (headcount)"} />
            )}
          </div>
        </SectionCard>

        <aside className="space-y-5">
          <SectionCard title="How to read this" bgImage="/28.jpg" bgImageOpacity={0.06}>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                Headcount is fixed. This chart asks a different question than &ldquo;is
                headcount sufficient?&rdquo; — it asks whether the scheduled
                roster is aimed at the hours where the calls are.
              </p>
              <p>
                {metricMode === "share"
                  ? "The grey area is the share of the day's calls in each 30-min bucket."
                  : "The grey area is the actual number of calls offered in each 30-min bucket."
                } Toggle between <span className="font-semibold text-foreground">Proposed</span>, <span className="font-semibold text-foreground">Current/Legacy</span>, and <span className="font-semibold text-foreground">Compare Both</span> views in the toolbar above.
              </p>
              <p className="text-xs">
                The lead slider at the top weights CSA Leads at the configured
                percentage (default 60%) because Leads spend the rest of their
                time on coaching and floor support.
              </p>
            </div>
          </SectionCard>

          <SectionCard title="Function mix (weekly)">
            <div className="space-y-2 text-sm">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Inbound · CSA pool
              </div>
              {CSA_FUNCTIONS.filter((fn) => fn !== "Combined").map((fn) => {
                const v = snapshot.volume.weekly[fn]?.offered ?? 0;
                const total = snapshot.volume.weekly.Combined?.offered ?? 1;
                return (
                  <FunctionRow
                    key={fn}
                    name={fn}
                    value={v}
                    share={v / total}
                  />
                );
              })}
              <div className="border-t pt-2 mt-2 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Back office · Schedulers
              </div>
              {(
                ["Dispatch"] as const
              ).map((fn) => {
                const v = snapshot.volume.weekly[fn]?.offered ?? 0;
                return (
                  <FunctionRow
                    key={fn}
                    name="Scheduling"
                    value={v}
                    share={null}
                    badge="NDS + SDS"
                  />
                );
              })}
              <p className="text-xs text-muted-foreground pt-2 leading-relaxed">
                <Info className="inline h-3 w-3 mr-1 -mt-0.5" />
                Inbound calls go to the CSA pool. Scheduling is handled by
                Schedulers (NDS next-day, SDS same-day) and does not draw from CSA
                capacity.
              </p>
              <p className="text-xs text-muted-foreground">
                Scheduler weekly voice-supply check:{" "}
                <span className="num text-foreground">
                  {f1(sum(schedulerSupply(snapshot.agents, day)) / 2)} h on {day}.
                </span>
              </p>
            </div>
          </SectionCard>
        </aside>
      </div>

    </div>
  );
}

function FunctionRow({
  name,
  value,
  share,
  badge,
}: {
  name: string;
  value: number;
  share: number | null;
  badge?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-foreground">{name}</span>
      <div className="flex items-center gap-2">
        {badge && <Badge variant="secondary">{badge}</Badge>}
        <span className="num text-muted-foreground tabular-nums">
          {f0(value)}
        </span>
        {share !== null && (
          <span className="num text-muted-foreground text-xs w-12 text-right">
            {(share * 100).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-sm"
        style={{ background: swatch }}
      />
      {label}
    </span>
  );
}
