"use client";

import { useMemo } from "react";
import { SectionCard } from "@/components/shared/section-card";
import {
  MobileScrollTable,
  MobileTableSection,
  mobileNumCellClass,
  mobileNumHeadClass,
  mobileStickyCellClass,
  mobileStickyHeadClass,
  mobileStickyMutedCellClass,
  mobileTableClass,
  mobileTdClass,
  mobileThClass,
} from "@/components/shared/mobile-scroll-table";
import { buildShiftScheduleSummary } from "@/lib/compute/shift-schedule-summary";
import {
  DAILY_FOOTER_ROWS,
  DAILY_SUMMARY_ROW_LABELS,
  SCHEDULE_SHIFT_TYPE_LABELS,
  SCHEDULE_SHIFT_TYPE_SHORT_LABELS,
  type ScheduleShiftTypeKey,
} from "@/lib/compute/schedule-shift-types";
import { DOW_LIST, type Snapshot } from "@/lib/data/types";
import { cn } from "@/lib/utils";

interface ShiftScheduleSummaryProps {
  proposed: Snapshot;
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function ShiftTypeHeader({ shiftKey }: { shiftKey: ScheduleShiftTypeKey }) {
  return (
    <>
      <span className="sm:hidden" title={SCHEDULE_SHIFT_TYPE_LABELS[shiftKey]}>
        {SCHEDULE_SHIFT_TYPE_SHORT_LABELS[shiftKey]}
      </span>
      <span className="hidden sm:inline">{SCHEDULE_SHIFT_TYPE_LABELS[shiftKey]}</span>
    </>
  );
}

export function ShiftScheduleSummary({ proposed }: ShiftScheduleSummaryProps) {
  const summary = useMemo(() => buildShiftScheduleSummary(proposed), [proposed]);

  return (
    <SectionCard
      title="Shift Schedule Summary"
      description="Proposed roster schedule by shift type and weekly pattern."
      contentClassName="px-3 sm:px-5"
    >
      <div className="space-y-8">
        <DailyShiftsTable summary={summary} />
        <WeeklyPatternsTable summary={summary} />
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
  const shiftTypes = daily.activeShiftTypes;

  if (shiftTypes.length === 0) {
    return (
      <MobileTableSection title="Daily Shifts Scheduled">
        <p className="text-xs text-muted-foreground">No scheduled shifts in this roster.</p>
      </MobileTableSection>
    );
  }

  return (
    <MobileTableSection
      title="Daily Shifts Scheduled"
      description="Shifts scheduled per day of week"
    >
      <MobileScrollTable>
        <table className={mobileTableClass}>
          <thead>
            <tr className="border-b bg-muted/40">
              <th className={cn(mobileThClass, mobileStickyHeadClass)}>Shift type</th>
              {DOW_LIST.map((day) => (
                <th key={day} className={cn(mobileThClass, mobileNumHeadClass)}>
                  {day}
                </th>
              ))}
              <th className={cn(mobileThClass, mobileNumHeadClass, "min-w-[3rem]")}>
                <span className="sm:hidden">Wk</span>
                <span className="hidden sm:inline">Week total</span>
              </th>
              <th className={cn(mobileThClass, mobileNumHeadClass, "min-w-[2.5rem]")}>
                <span className="sm:hidden">%</span>
                <span className="hidden sm:inline">Share</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shiftTypes.map((key) => (
              <tr key={key} className="border-b">
                <td className={cn(mobileTdClass, mobileStickyCellClass, "font-medium")}>
                  <ShiftTypeHeader shiftKey={key} />
                </td>
                {DOW_LIST.map((day) => (
                  <td key={day} className={cn(mobileTdClass, mobileNumCellClass)}>
                    {daily.byShiftType[key][day]}
                  </td>
                ))}
                <td className={cn(mobileTdClass, mobileNumCellClass, "font-medium")}>
                  {daily.weekTotals[key]}
                </td>
                <td className={cn(mobileTdClass, mobileNumCellClass)}>
                  {formatPct(daily.weekPct[key])}
                </td>
              </tr>
            ))}

            {DAILY_FOOTER_ROWS.map((rowKey) => {
              const isCubicleRow = rowKey === "totalCubiclesRequired";
              const rowValues = daily.summary[rowKey];

              return (
                <tr key={rowKey} className="border-b bg-muted/40">
                  <td
                    className={cn(
                      mobileTdClass,
                      mobileStickyMutedCellClass,
                      isCubicleRow ? "font-semibold" : "font-medium text-muted-foreground",
                    )}
                  >
                    {DAILY_SUMMARY_ROW_LABELS[rowKey]}
                  </td>
                  {DOW_LIST.map((day) => (
                    <td
                      key={day}
                      className={cn(
                        mobileTdClass,
                        mobileNumCellClass,
                        isCubicleRow && "font-semibold",
                      )}
                    >
                      {rowValues[day]}
                    </td>
                  ))}
                  <td
                    className={cn(
                      mobileTdClass,
                      mobileNumCellClass,
                      isCubicleRow && "font-semibold",
                    )}
                  >
                    {daily.summaryWeekTotals[rowKey]}
                  </td>
                  <td
                    className={cn(
                      mobileTdClass,
                      mobileNumCellClass,
                      isCubicleRow ? "text-muted-foreground" : undefined,
                    )}
                  >
                    {isCubicleRow ? "—" : formatPct(daily.summaryWeekPct.totalShifts)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </MobileScrollTable>
    </MobileTableSection>
  );
}

function WeeklyPatternsTable({
  summary,
}: {
  summary: ReturnType<typeof buildShiftScheduleSummary>;
}) {
  const { weeklyPatterns } = summary;
  const shiftTypes = weeklyPatterns.activeShiftTypes;
  const patternRows = weeklyPatterns.activePatternRows;

  if (shiftTypes.length === 0 || patternRows.length === 0) {
    return null;
  }

  return (
    <MobileTableSection title="Weekly shift patterns">
      <MobileScrollTable>
        <table className={mobileTableClass}>
          <thead>
            <tr className="border-b bg-muted/40">
              <th className={cn(mobileThClass, mobileStickyHeadClass)}>Off days</th>
              {shiftTypes.map((key) => (
                <th
                  key={key}
                  className={cn(mobileThClass, mobileNumHeadClass, "min-w-[2.75rem] sm:min-w-[4rem]")}
                  title={SCHEDULE_SHIFT_TYPE_LABELS[key]}
                >
                  <ShiftTypeHeader shiftKey={key} />
                </th>
              ))}
              <th className={cn(mobileThClass, mobileNumHeadClass, "min-w-[3rem]")}>
                Total
              </th>
              <th className={cn(mobileThClass, mobileNumHeadClass, "min-w-[2.75rem]")}>
                Share
              </th>
            </tr>
          </thead>
          <tbody>
            {patternRows.map((row) => {
              const rowTotal = weeklyPatterns.rowTotals[row.key];
              const rowPctOfGrand =
                weeklyPatterns.grandTotal > 0
                  ? (rowTotal / weeklyPatterns.grandTotal) * 100
                  : 0;

              return (
                <tr key={row.key} className="border-b">
                  <td className={cn(mobileTdClass, mobileStickyCellClass, "font-medium")}>
                    {row.label}
                  </td>
                  {shiftTypes.map((key) => (
                    <td key={key} className={cn(mobileTdClass, mobileNumCellClass)}>
                      {weeklyPatterns.byPattern[row.key][key]}
                    </td>
                  ))}
                  <td className={cn(mobileTdClass, mobileNumCellClass, "font-medium")}>
                    {rowTotal}
                  </td>
                  <td className={cn(mobileTdClass, mobileNumCellClass)}>
                    {formatPct(rowPctOfGrand)}
                  </td>
                </tr>
              );
            })}

            <tr className="border-b bg-muted/40 font-medium">
              <td className={cn(mobileTdClass, mobileStickyMutedCellClass, "font-semibold")}>
                All patterns
              </td>
              {shiftTypes.map((key) => (
                <td key={key} className={cn(mobileTdClass, mobileNumCellClass, "font-semibold")}>
                  {weeklyPatterns.columnTotals[key]}
                </td>
              ))}
              <td className={cn(mobileTdClass, mobileNumCellClass, "font-semibold")}>
                {weeklyPatterns.grandTotal}
              </td>
              <td className={cn(mobileTdClass, mobileNumCellClass)}>
                {formatPct(weeklyPatterns.grandTotal > 0 ? 100 : 0)}
              </td>
            </tr>
          </tbody>
        </table>
      </MobileScrollTable>
    </MobileTableSection>
  );
}
