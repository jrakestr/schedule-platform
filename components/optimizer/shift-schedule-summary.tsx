"use client";

import { useMemo } from "react";
import { SectionCard } from "@/components/shared/section-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildShiftScheduleSummary } from "@/lib/compute/shift-schedule-summary";
import {
  DAILY_SUMMARY_ROW_LABELS,
  SCHEDULE_SHIFT_TYPE_LABELS,
  SCHEDULE_SHIFT_TYPES,
  WEEKLY_PATTERN_ROWS,
  type DailySummaryRowKey,
} from "@/lib/compute/schedule-shift-types";
import { DOW_LIST, type Snapshot } from "@/lib/data/types";
import { cn } from "@/lib/utils";

interface ShiftScheduleSummaryProps {
  proposed: Snapshot;
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function CountCell({ value, className }: { value: number; className?: string }) {
  return (
    <TableCell className={cn("text-xs text-right tabular-nums", className)}>
      {value}
    </TableCell>
  );
}

function PctCell({ value, className }: { value: number; className?: string }) {
  return (
    <TableCell className={cn("text-xs text-right tabular-nums", className)}>
      {formatPct(value)}
    </TableCell>
  );
}

const SUMMARY_ROWS: DailySummaryRowKey[] = [
  "eightHourSplitTotal",
  "totalSplitShifts",
  "totalNonStraightEightHour",
  "totalShifts",
  "totalCubiclesRequired",
];

export function ShiftScheduleSummary({ proposed }: ShiftScheduleSummaryProps) {
  const summary = useMemo(() => buildShiftScheduleSummary(proposed), [proposed]);

  return (
    <SectionCard
      title="Shift Schedule Summary"
      description="Proposed roster schedule by shift type and weekly pattern."
    >
      <div className="space-y-8">
        <DailyShiftsTable summary={summary} />
        <WeeklyPatternsTable summary={summary} mode="counts" />
        <WeeklyPatternsTable summary={summary} mode="percentages" />
      </div>
    </SectionCard>
  );
}

function DailyShiftsTable({
  summary,
}: {
  summary: ReturnType<typeof buildShiftScheduleSummary>;
}) {
  const { daily } = summary;

  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold tracking-tight">Daily Shifts Scheduled</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Shifts scheduled per day of week
        </p>
      </div>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-xs min-w-[180px]">Shift Type</TableHead>
              {DOW_LIST.map((day) => (
                <TableHead key={day} className="text-xs text-right w-12">
                  {day}
                </TableHead>
              ))}
              <TableHead className="text-xs text-right w-16">Total Week</TableHead>
              <TableHead className="text-xs text-right w-16">Pct.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SCHEDULE_SHIFT_TYPES.map((key) => (
              <TableRow key={key}>
                <TableCell className="text-xs font-medium">
                  {SCHEDULE_SHIFT_TYPE_LABELS[key]}
                </TableCell>
                {DOW_LIST.map((day) => (
                  <CountCell key={day} value={daily.byShiftType[key][day]} />
                ))}
                <CountCell value={daily.weekTotals[key]} />
                <PctCell value={daily.weekPct[key]} />
              </TableRow>
            ))}

            {SUMMARY_ROWS.map((rowKey) => {
              const isCubicleRow = rowKey === "totalCubiclesRequired";
              const rowValues = daily.summary[rowKey];
              return (
                <TableRow
                  key={rowKey}
                  className={cn("bg-muted/40", isCubicleRow && "font-semibold")}
                >
                  <TableCell
                    className={cn(
                      "text-xs",
                      isCubicleRow ? "font-semibold" : "font-medium text-muted-foreground",
                    )}
                  >
                    {DAILY_SUMMARY_ROW_LABELS[rowKey]}
                  </TableCell>
                  {DOW_LIST.map((day) => (
                    <CountCell
                      key={day}
                      value={rowValues[day]}
                      className={isCubicleRow ? "font-semibold" : undefined}
                    />
                  ))}
                  <CountCell
                    value={daily.summaryWeekTotals[rowKey]}
                    className={isCubicleRow ? "font-semibold" : undefined}
                  />
                  <PctCell
                    value={
                      isCubicleRow
                        ? 0
                        : daily.summaryWeekPct[
                            rowKey as Exclude<DailySummaryRowKey, "totalCubiclesRequired">
                          ]
                    }
                    className={isCubicleRow ? "text-muted-foreground" : undefined}
                  />
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function WeeklyPatternsTable({
  summary,
  mode,
}: {
  summary: ReturnType<typeof buildShiftScheduleSummary>;
  mode: "counts" | "percentages";
}) {
  const { weeklyPatterns } = summary;
  const title =
    mode === "counts"
      ? "Weekly Shift Patterns Scheduled"
      : "Weekly Shift Patterns Scheduled (Percentages)";

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-xs min-w-[180px]">Weekly Pattern</TableHead>
              {SCHEDULE_SHIFT_TYPES.map((key) => (
                <TableHead key={key} className="text-xs text-right min-w-[72px]">
                  {SCHEDULE_SHIFT_TYPE_LABELS[key]}
                </TableHead>
              ))}
              <TableHead className="text-xs text-right w-20">All Shift Types</TableHead>
              <TableHead className="text-xs text-right w-20">Percent of Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {WEEKLY_PATTERN_ROWS.map((row) => {
              const rowTotal = weeklyPatterns.rowTotals[row.key];
              const rowPctOfGrand =
                weeklyPatterns.grandTotal > 0
                  ? (rowTotal / weeklyPatterns.grandTotal) * 100
                  : 0;

              return (
                <TableRow key={row.key}>
                  <TableCell className="text-xs font-medium">{row.label}</TableCell>
                  {SCHEDULE_SHIFT_TYPES.map((key) =>
                    mode === "counts" ? (
                      <CountCell
                        key={key}
                        value={weeklyPatterns.byPattern[row.key][key]}
                      />
                    ) : (
                      <PctCell key={key} value={weeklyPatterns.rowPct[row.key][key]} />
                    ),
                  )}
                  {mode === "counts" ? (
                    <>
                      <CountCell value={rowTotal} />
                      <PctCell value={rowPctOfGrand} />
                    </>
                  ) : (
                    <>
                      <TableCell className="text-xs text-right tabular-nums">—</TableCell>
                      <PctCell value={rowPctOfGrand} />
                    </>
                  )}
                </TableRow>
              );
            })}

            <TableRow className="bg-muted/40 font-medium">
              <TableCell className="text-xs font-semibold">All Patterns</TableCell>
              {SCHEDULE_SHIFT_TYPES.map((key) =>
                mode === "counts" ? (
                  <CountCell key={key} value={weeklyPatterns.columnTotals[key]} />
                ) : (
                  <PctCell
                    key={key}
                    value={
                      weeklyPatterns.grandTotal > 0
                        ? (weeklyPatterns.columnTotals[key] / weeklyPatterns.grandTotal) * 100
                        : 0
                    }
                  />
                ),
              )}
              {mode === "counts" ? (
                <>
                  <CountCell value={weeklyPatterns.grandTotal} className="font-semibold" />
                  <PctCell value={weeklyPatterns.grandTotal > 0 ? 100 : 0} />
                </>
              ) : (
                <>
                  <TableCell className="text-xs text-right tabular-nums">—</TableCell>
                  <PctCell value={100} />
                </>
              )}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
