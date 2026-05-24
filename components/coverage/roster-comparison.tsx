"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchOptimizationSnapshot } from "@/lib/api/snapshot";
import {
  computeLegacyRosterMetrics,
  computeSnapshotRosterMetrics,
  type RosterComparisonMetrics,
} from "@/lib/compute/roster-comparison";
import { DOW_LIST_SUN_FIRST } from "@/lib/compute/cumulative-matched-share";
import { LabelWithHelp } from "@/components/shared/metric-help";
import { SectionCard } from "@/components/shared/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WFM_VOLUME_MATCHED } from "@/lib/copy/wfm-tooltips";
import { cn, f1, pct } from "@/lib/utils";
import type { DOW, Snapshot } from "@/lib/data/types";
import type { OptimizationMeta } from "@/lib/data/snapshot";

const MAX_COLUMNS = 5;

export type RosterSourceKey =
  | "baseline"
  | "legacy"
  | "active"
  | `opt:${string}`;

interface RosterSourceDefinition {
  key: RosterSourceKey;
  label: string;
  kind: "baseline" | "legacy" | "active" | "optimization";
}

interface RosterComparisonProps {
  volumeSnapshot: Snapshot;
  baselineSnapshot: Snapshot;
  activeSnapshot: Snapshot;
  leadPct: number;
  optimizations: OptimizationMeta[];
  activeOptId?: string;
}

interface LoadedColumn {
  key: RosterSourceKey;
  label: string;
  metrics?: RosterComparisonMetrics;
  loading?: boolean;
  error?: string;
}

function matchedTone(value: number | null): string {
  if (value === null) return "text-muted-foreground";
  if (value >= 0.8) return "text-emerald-700 dark:text-emerald-400";
  if (value >= 0.6) return "text-amber-700 dark:text-amber-400";
  return "text-rose-700 dark:text-rose-400";
}

function formatMetric(value: number | null, formatter: (v: number) => string): string {
  return value === null ? "—" : formatter(value);
}

function buildAvailableSources(
  optimizations: OptimizationMeta[],
  activeOptId: string | undefined,
): RosterSourceDefinition[] {
  const sources: RosterSourceDefinition[] = [
    { key: "baseline", label: "Default baseline", kind: "baseline" },
    { key: "legacy", label: "Current/Legacy", kind: "legacy" },
  ];

  if (activeOptId) {
    const activeRun = optimizations.find((opt) => opt.id === activeOptId);
    sources.push({
      key: "active",
      label: activeRun?.run_name ?? "Active roster",
      kind: "active",
    });
  }

  const succeeded = optimizations.filter((opt) => opt.status === "succeeded" && opt.id);
  for (const opt of succeeded) {
    if (opt.id === activeOptId) continue;
    sources.push({
      key: `opt:${opt.id}`,
      label: opt.run_name,
      kind: "optimization",
    });
  }

  return sources;
}

function defaultSelection(
  sources: RosterSourceDefinition[],
  activeOptId: string | undefined,
): RosterSourceKey[] {
  const keys = new Set<RosterSourceKey>(["baseline", "legacy"]);
  if (activeOptId && sources.some((s) => s.key === "active")) {
    keys.add("active");
  }
  return sources.filter((s) => keys.has(s.key)).map((s) => s.key);
}

function computeColumnMetrics(
  key: RosterSourceKey,
  volumeSnapshot: Snapshot,
  baselineSnapshot: Snapshot,
  activeSnapshot: Snapshot,
  leadPct: number,
  loadedSnapshots: Map<string, Snapshot>,
): RosterComparisonMetrics {
  if (key === "baseline") {
    return computeSnapshotRosterMetrics(baselineSnapshot, leadPct);
  }
  if (key === "legacy") {
    return computeLegacyRosterMetrics(volumeSnapshot);
  }
  if (key === "active") {
    return computeSnapshotRosterMetrics(activeSnapshot, leadPct);
  }
  const optId = key.slice(4);
  const snapshot = loadedSnapshots.get(optId);
  if (!snapshot) {
    throw new Error("Optimization snapshot not loaded");
  }
  return computeSnapshotRosterMetrics(snapshot, leadPct);
}

export function RosterComparison({
  volumeSnapshot,
  baselineSnapshot,
  activeSnapshot,
  leadPct,
  optimizations,
  activeOptId,
}: RosterComparisonProps) {
  const availableSources = useMemo(
    () => buildAvailableSources(optimizations, activeOptId),
    [optimizations, activeOptId],
  );

  const [selectedKeys, setSelectedKeys] = useState<RosterSourceKey[]>(() =>
    defaultSelection(availableSources, activeOptId),
  );
  const [loadedSnapshots, setLoadedSnapshots] = useState<Map<string, Snapshot>>(
    new Map(),
  );
  const [loadingKeys, setLoadingKeys] = useState<Set<RosterSourceKey>>(new Set());
  const [errors, setErrors] = useState<Map<RosterSourceKey, string>>(new Map());

  useEffect(() => {
    setSelectedKeys((prev) => {
      const valid = prev.filter((key) =>
        availableSources.some((source) => source.key === key),
      );
      if (valid.length > 0) return valid;
      return defaultSelection(availableSources, activeOptId);
    });
  }, [availableSources, activeOptId]);

  const optKeysToLoad = useMemo(
    () =>
      selectedKeys.filter(
        (key): key is `opt:${string}` =>
          key.startsWith("opt:") && !loadedSnapshots.has(key.slice(4)),
      ),
    [selectedKeys, loadedSnapshots],
  );

  useEffect(() => {
    for (const key of optKeysToLoad) {
      const optId = key.slice(4);
      setLoadingKeys((prev) => new Set(prev).add(key));
      setErrors((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });

      fetchOptimizationSnapshot(optId)
        .then((snapshot) => {
          setLoadedSnapshots((prev) => new Map(prev).set(optId, snapshot));
        })
        .catch((err: unknown) => {
          const message =
            err instanceof Error ? err.message : "Failed to load optimization run.";
          setErrors((prev) => new Map(prev).set(key, message));
        })
        .finally(() => {
          setLoadingKeys((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        });
    }
  }, [optKeysToLoad]);

  const toggleSource = useCallback((key: RosterSourceKey) => {
    setSelectedKeys((prev) => {
      if (prev.includes(key)) {
        return prev.length > 1 ? prev.filter((k) => k !== key) : prev;
      }
      if (prev.length >= MAX_COLUMNS) return prev;
      return [...prev, key];
    });
  }, []);

  const addSourceKey = useCallback((key: RosterSourceKey) => {
    setSelectedKeys((prev) => {
      if (prev.includes(key) || prev.length >= MAX_COLUMNS) return prev;
      return [...prev, key];
    });
  }, []);

  const columns: LoadedColumn[] = useMemo(() => {
    const labelByKey = new Map(availableSources.map((s) => [s.key, s.label]));
    return selectedKeys.map((key) => {
      const label = labelByKey.get(key) ?? key;
      if (loadingKeys.has(key)) {
        return { key, label, loading: true };
      }
      const error = errors.get(key);
      if (error) {
        return { key, label, error };
      }
      try {
        return {
          key,
          label,
          metrics: computeColumnMetrics(
            key,
            volumeSnapshot,
            baselineSnapshot,
            activeSnapshot,
            leadPct,
            loadedSnapshots,
          ),
        };
      } catch (err: unknown) {
        return {
          key,
          label,
          error: err instanceof Error ? err.message : "Unable to compute metrics.",
        };
      }
    });
  }, [
    selectedKeys,
    availableSources,
    loadingKeys,
    errors,
    volumeSnapshot,
    baselineSnapshot,
    activeSnapshot,
    leadPct,
    loadedSnapshots,
  ]);

  const addableSources = availableSources.filter(
    (source) => !selectedKeys.includes(source.key),
  );

  const windowLabels =
    columns.find((col) => col.metrics?.cumulativeWindows)?.metrics?.cumulativeWindows.map(
      (w) => w.label,
    ) ?? [];

  return (
    <SectionCard
      title={
        <LabelWithHelp
          label="Compare rosters"
          help={
            <>
              <p>{WFM_VOLUME_MATCHED}</p>
              <p className="mt-1.5">
                Side-by-side metrics for baseline, current/legacy supply, the
                active roster run, and saved optimization results. Volume
                forecast is shared across columns.
              </p>
            </>
          }
        />
      }
      description="Select up to five roster scenarios · Sun-first cumulative windows"
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          {availableSources.map((source) => {
            const selected = selectedKeys.includes(source.key);
            return (
              <Button
                key={source.key}
                variant={selected ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => toggleSource(source.key)}
              >
                {source.label}
              </Button>
            );
          })}
          {addableSources.length > 0 && selectedKeys.length < MAX_COLUMNS && (
            <Select
              value=""
              onValueChange={(value) => addSourceKey(value as RosterSourceKey)}
            >
              <SelectTrigger className="h-7 w-[160px] text-xs">
                <SelectValue placeholder="Add run…" />
              </SelectTrigger>
              <SelectContent>
                {addableSources.map((source) => (
                  <SelectItem key={source.key} value={source.key} className="text-xs">
                    {source.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      }
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 min-w-[180px] bg-card">
                Metric
              </TableHead>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className="min-w-[120px] text-right text-xs whitespace-nowrap"
                >
                  <div className="font-medium">{col.label}</div>
                  {col.key === "legacy" && (
                    <Badge variant="secondary" className="mt-1 text-[10px] font-normal">
                      legacy supply
                    </Badge>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <SummaryRow
              label="Volume-matched share (week)"
              columns={columns}
              getValue={(metrics) => metrics.volumeMatchedShare}
              format={(v) => pct(v)}
            />
            <SummaryRow
              label="Weighted coverage %"
              columns={columns}
              getValue={(metrics) => metrics.weightedCoveragePct / 100}
              format={(v) => `${(v * 100).toFixed(1)}%`}
              toneClass={() => "text-foreground"}
            />
            <SummaryRow
              label="Total CSA hours"
              columns={columns}
              getValue={(metrics) => metrics.totalCsaHours}
              format={(v) => f1(v)}
              toneClass={() => "text-foreground"}
            />

            <TableRow>
              <TableCell
                colSpan={columns.length + 1}
                className="bg-muted/30 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Daily volume-matched share
              </TableCell>
            </TableRow>
            {DOW_LIST_SUN_FIRST.map((day) => (
              <TableRow key={day}>
                <TableCell className="sticky left-0 z-10 bg-card font-medium">
                  {day}
                </TableCell>
                {columns.map((col) => (
                  <MetricCell
                    key={`${col.key}-${day}`}
                    col={col}
                    value={
                      col.metrics ? col.metrics.dailyMatched[day as DOW] : null
                    }
                    format={(v) => pct(v)}
                  />
                ))}
              </TableRow>
            ))}

            <TableRow>
              <TableCell
                colSpan={columns.length + 1}
                className="bg-muted/30 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Cumulative volume-matched share
              </TableCell>
            </TableRow>
            {windowLabels.map((windowLabel, rowIdx) => (
              <TableRow key={windowLabel}>
                <TableCell className="sticky left-0 z-10 bg-card font-medium">
                  {windowLabel}
                </TableCell>
                {columns.map((col) => (
                  <MetricCell
                    key={`${col.key}-cum-${windowLabel}`}
                    col={col}
                    value={
                      col.metrics?.cumulativeWindows[rowIdx]?.matchedShare ?? null
                    }
                    format={(v) => pct(v)}
                  />
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}

function SummaryRow({
  label,
  columns,
  getValue,
  format,
  toneClass = matchedTone,
}: {
  label: string;
  columns: LoadedColumn[];
  getValue: (metrics: RosterComparisonMetrics) => number | null;
  format: (value: number) => string;
  toneClass?: (value: number | null) => string;
}) {
  return (
    <TableRow>
      <TableCell className="sticky left-0 z-10 bg-card font-medium">{label}</TableCell>
      {columns.map((col) => (
        <MetricCell
          key={`${col.key}-${label}`}
          col={col}
          value={col.metrics ? getValue(col.metrics) : null}
          format={format}
          toneClass={toneClass}
        />
      ))}
    </TableRow>
  );
}

function MetricCell({
  col,
  value,
  format,
  toneClass = matchedTone,
}: {
  col: LoadedColumn;
  value: number | null;
  format: (value: number) => string;
  toneClass?: (value: number | null) => string;
}) {
  if (col.loading) {
    return (
      <TableCell className="text-right">
        <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />
      </TableCell>
    );
  }
  if (col.error) {
    return (
      <TableCell className="text-right text-xs text-rose-600 dark:text-rose-400">
        Error
      </TableCell>
    );
  }
  return (
    <TableCell
      className={cn(
        "num text-right tabular-nums text-sm",
        toneClass(value),
      )}
    >
      {formatMetric(value, format)}
    </TableCell>
  );
}
