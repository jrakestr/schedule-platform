"use client";

import { useMemo } from "react";
import { CheckCircle2, X } from "lucide-react";
import { SectionCard } from "@/components/shared/section-card";
import { MetricDeltaBadge } from "@/components/optimizer/metric-delta-badge";
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
import { compareOptimizations } from "@/lib/compute/optimization-metrics";
import { ShiftScheduleSummary } from "@/components/optimizer/shift-schedule-summary";
import { formatCurrency } from "@/lib/utils/formatters"; // Moved to shared utilities
import type { Snapshot } from "@/lib/data/types";

interface OptimizationResultsProps {
  runName: string;
  baseline: Snapshot;
  proposed: Snapshot;
  leadPct: number;
  showSuccessBanner?: boolean;
  onDismissSuccess?: () => void;
}

function formatDays(days: readonly string[]): string {
  if (days.length === 0) return "—";
  return days.join(", ");
}

export function OptimizationResults({
  runName,
  baseline,
  proposed,
  leadPct,
  showSuccessBanner = false,
  onDismissSuccess,
}: OptimizationResultsProps) {
  // Memoize computation. If baseline and proposed contain stable IDs, use them instead.
  const comparison = useMemo(
    () => compareOptimizations(baseline, proposed, leadPct),
    [baseline, proposed, leadPct],
  );

  const coverageDelta =
    comparison.proposed.weightedCoveragePct - comparison.baseline.weightedCoveragePct;
  const costDelta = comparison.proposed.totalCost - comparison.baseline.totalCost;
  const hoursDelta = comparison.proposed.totalHours - comparison.baseline.totalHours;
  const staffDelta =
    comparison.proposed.totalBodies - comparison.baseline.totalBodies;

  return (
    <div className="space-y-5">
      {/* Stateless success banner managed entirely by the parent component */}
      {showSuccessBanner && (
        <div 
          role="status"
          className="flex items-start justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200"
        >
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="text-sm font-semibold">Optimization completed</p>
              <p className="text-xs opacity-90">{runName}</p>
            </div>
          </div>
          {onDismissSuccess && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 shrink-0 p-0 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
              onClick={onDismissSuccess}
              aria-label="Dismiss banner"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      <SectionCard
        title="Optimization Results"
        description={`Baseline vs proposed roster for "${runName}".`}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Weighted Coverage"
            value={
              <span className="inline-flex items-center gap-2">
                <span>{comparison.proposed.weightedCoveragePct.toFixed(1)}%</span>
                <MetricDeltaBadge delta={coverageDelta} decimals={1} suffix="pp" />
              </span>
            }
            hint={`Baseline ${comparison.baseline.weightedCoveragePct.toFixed(1)}%`}
          />
          <StatTile
            label="Total Cost / Week"
            value={
              <span className="inline-flex items-center gap-2">
                <span>{formatCurrency(comparison.proposed.totalCost)}</span>
                <MetricDeltaBadge delta={costDelta} invertPolarity decimals={0} />
              </span>
            }
            hint={`Baseline ${formatCurrency(comparison.baseline.totalCost)}`}
          />
          <StatTile
            label="Scheduled Hours / Week"
            value={
              <span className="inline-flex items-center gap-2">
                <span>{Math.round(comparison.proposed.totalHours).toLocaleString()}h</span>
                <MetricDeltaBadge delta={hoursDelta} invertPolarity decimals={0} />
              </span>
            }
            hint={`Baseline ${Math.round(comparison.baseline.totalHours).toLocaleString()}h`}
          />
          <StatTile
            label="Roster Size"
            value={
              <span className="inline-flex items-center gap-2">
                <span>{comparison.proposed.totalBodies}</span>
                {staffDelta === 0 ? (
                  <Badge variant="secondary" className="text-[10px] h-5 font-normal">
                    unchanged
                  </Badge>
                ) : (
                  <MetricDeltaBadge delta={staffDelta} decimals={0} />
                )}
              </span>
            }
            hint={`Baseline ${comparison.baseline.totalBodies}`}
          />
        </div>
      </SectionCard>

      <ShiftScheduleSummary proposed={proposed} />

      <SectionCard
        title="Agent Assignment Changes"
        description={
          comparison.agentChanges.length > 0
            ? `${comparison.agentChanges.length} agent${comparison.agentChanges.length === 1 ? "" : "s"} with a shift or off-day change.`
            : "No shift or off-day changes from baseline."
        }
      >
        {comparison.agentChanges.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            Proposed roster matches baseline shift assignments.
          </p>
        ) : (
          <div className="rounded-md border max-h-96 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  {/* Applying sticky positions directly to TableHeads to ensure consistent cross-browser performance */}
                  <TableHead className="text-xs sticky top-0 bg-muted/40">Agent</TableHead>
                  <TableHead className="text-xs sticky top-0 bg-muted/40">Baseline Shift</TableHead>
                  <TableHead className="text-xs sticky top-0 bg-muted/40">Proposed Shift</TableHead>
                  <TableHead className="text-xs w-16 text-right sticky top-0 bg-muted/40">Δ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparison.agentChanges.map((row) => (
                  <TableRow key={row.agentId}>
                    <TableCell className="text-xs">
                      <div className="font-medium">{row.agentName}</div>
                      <div className="text-[10px] text-muted-foreground">{row.role}</div>
                      {row.daysChanged && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Days: {formatDays(row.baselineWorksDays)} → {formatDays(row.proposedWorksDays)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{row.baselineShiftLabel}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{row.baselineShiftId}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{row.proposedShiftLabel}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{row.proposedShiftId}</div>
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      <Badge
                        variant="outline"
                        className="text-[10px] h-5 font-semibold bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-900/50"
                      >
                        {row.shiftChanged && row.daysChanged
                          ? "shift+days"
                          : row.shiftChanged
                            ? "shift"
                            : "days"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
