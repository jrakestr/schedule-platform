"use client";

import { useMemo } from "react";
import { LabelWithHelp } from "@/components/shared/metric-help";
import { SectionCard } from "@/components/shared/section-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  cumulativeMatchedShareByShift,
  cumulativeMatchedWindows,
  DOW_LIST_SUN_FIRST,
  type CumulativeMatchedWindow,
} from "@/lib/compute/cumulative-matched-share";
import { shiftColor } from "@/lib/compute/colors";
import { WFM_VOLUME_MATCHED } from "@/lib/copy/wfm-tooltips";
import { cn, pct } from "@/lib/utils";
import type { Snapshot } from "@/lib/data/types";

interface CumulativeMatchedTableProps {
  snapshot: Snapshot;
  leadPct: number;
  mode: "overall" | "byShift";
}

function matchedTone(value: number | null): string {
  if (value === null) return "text-muted-foreground";
  if (value >= 0.8) return "text-emerald-700 dark:text-emerald-400";
  if (value >= 0.6) return "text-amber-700 dark:text-amber-400";
  return "text-rose-700 dark:text-rose-400";
}

function MatchedCell({ value }: { value: number | null }) {
  return (
    <TableCell
      className={cn("num text-right tabular-nums text-sm", matchedTone(value))}
    >
      {value === null ? "—" : pct(value)}
    </TableCell>
  );
}

function windowHeaders(windows: CumulativeMatchedWindow[]) {
  return windows.map((w) => (
    <TableHead key={w.label} className="text-right text-xs whitespace-nowrap">
      {w.label}
    </TableHead>
  ));
}

export function CumulativeMatchedTable({
  snapshot,
  leadPct,
  mode,
}: CumulativeMatchedTableProps) {
  const overallWindows = useMemo(
    () => cumulativeMatchedWindows(snapshot, leadPct),
    [snapshot, leadPct],
  );

  const shiftRows = useMemo(
    () => cumulativeMatchedShareByShift(snapshot, leadPct),
    [snapshot, leadPct],
  );

  const helpText =
    "Cumulative volume-matched share across Sun-first day windows. Each column adds the next calendar day; shares are computed over all intervals in that window using proposed CSA Voice supply.";

  if (mode === "overall") {
    return (
      <SectionCard
        title={
          <LabelWithHelp
            label="Cumulative volume-matched share"
            help={
              <>
                <p>{WFM_VOLUME_MATCHED}</p>
                <p className="mt-1.5">{helpText}</p>
              </>
            }
          />
        }
        description="Sun-first running windows · proposed CSA Voice supply"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Through</TableHead>
              <TableHead className="text-right">Vol matched share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {overallWindows.map((w) => (
              <TableRow key={w.label}>
                <TableCell className="font-medium">{w.label}</TableCell>
                <MatchedCell value={w.matchedShare} />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
    );
  }

  if (!shiftRows.length) {
    return (
      <SectionCard title="Volume-matched share by shift">
        <p className="text-sm text-muted-foreground">
          No CSA-assigned shifts in this snapshot.
        </p>
      </SectionCard>
    );
  }

  const headers =
    shiftRows[0]?.windows ??
    DOW_LIST_SUN_FIRST.map((d, i) => ({
      throughDay: d,
      label: i === 0 ? d : `Sun–${d}`,
      days: DOW_LIST_SUN_FIRST.slice(0, i + 1),
      matchedShare: null,
    }));

  return (
    <SectionCard
      title={
        <LabelWithHelp
          label="Volume-matched share by shift"
          help={
            <>
              <p>{WFM_VOLUME_MATCHED}</p>
              <p className="mt-1.5">
                Each cell uses CSA Voice supply from agents on that shift
                template only, compared to total offered volume in the cumulative
                day window.
              </p>
            </>
          }
        />
      }
      description="Sun-first cumulative columns · CSA agents per shift"
      contentClassName="overflow-x-auto"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 bg-card">Shift</TableHead>
            <TableHead className="text-right text-xs">CSAs</TableHead>
            {windowHeaders(headers)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {shiftRows.map((row) => {
            const color = shiftColor(row.shiftId);
            return (
              <TableRow key={row.shiftId}>
                <TableCell className="sticky left-0 z-10 bg-card whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ background: color }}
                    />
                    <div>
                      <div className="font-mono text-sm font-medium">
                        {row.shiftId}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {row.startClock}–{row.endClock}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="num text-right tabular-nums text-sm text-muted-foreground">
                  {row.csaCount}
                </TableCell>
                {row.windows.map((w) => (
                  <MatchedCell key={w.label} value={w.matchedShare} />
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </SectionCard>
  );
}
