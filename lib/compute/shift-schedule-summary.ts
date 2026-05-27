import { DOW_LIST, type DOW, type Snapshot } from "@/lib/data/types";
import {
  activeScheduleShiftTypes,
  activeWeeklyPatternRows,
  classifyScheduleShiftType,
  DAILY_FOOTER_ROWS,
  emptyDowCounts,
  emptyShiftTypeCounts,
  resolveCatalogEntry,
  SCHEDULE_SHIFT_TYPES,
  type DailySummaryRowKey,
  type ScheduleShiftTypeKey,
  weeklyPatternFromOffPair,
  WEEKLY_PATTERN_ROWS,
  type WeeklyPatternKey,
  type WeeklyPatternRow,
} from "@/lib/compute/schedule-shift-types";

export type DailyShiftGrid = Record<ScheduleShiftTypeKey, Record<DOW, number>>;

export interface DailySummaryRows {
  totalShifts: Record<DOW, number>;
  totalCubiclesRequired: Record<DOW, number>;
}

export interface DailyShiftTable {
  byShiftType: DailyShiftGrid;
  summary: DailySummaryRows;
  weekTotals: Record<ScheduleShiftTypeKey, number>;
  weekPct: Record<ScheduleShiftTypeKey, number>;
  summaryWeekTotals: Record<DailySummaryRowKey, number>;
  summaryWeekPct: Record<"totalShifts", number>;
  activeShiftTypes: ScheduleShiftTypeKey[];
}

export type WeeklyPatternGrid = Record<
  WeeklyPatternKey,
  Record<ScheduleShiftTypeKey, number>
>;

export interface WeeklyPatternTable {
  byPattern: WeeklyPatternGrid;
  rowTotals: Record<WeeklyPatternKey, number>;
  columnTotals: Record<ScheduleShiftTypeKey, number>;
  grandTotal: number;
  rowPct: Record<WeeklyPatternKey, Record<ScheduleShiftTypeKey, number>>;
  activeShiftTypes: ScheduleShiftTypeKey[];
  activePatternRows: WeeklyPatternRow[];
}

export interface ShiftScheduleSummary {
  daily: DailyShiftTable;
  weeklyPatterns: WeeklyPatternTable;
}

function sumDow(row: Record<DOW, number>): number {
  return DOW_LIST.reduce((acc, day) => acc + row[day], 0);
}

function pctOfTotal(value: number, total: number): number {
  if (total <= 0) return 0;
  return (value / total) * 100;
}

function buildDailyCubiclePeaks(snapshot: Snapshot): Record<DOW, number> {
  const peaks = emptyDowCounts();
  const occ = snapshot.cubicles?.occupancy_by_day_hour ?? {};
  for (const day of DOW_LIST) {
    const hourly = occ[day] ?? [];
    peaks[day] = hourly.length > 0 ? Math.max(...hourly) : 0;
  }
  return peaks;
}

function initDailyGrid(): DailyShiftGrid {
  const grid = {} as DailyShiftGrid;
  for (const key of SCHEDULE_SHIFT_TYPES) {
    grid[key] = emptyDowCounts();
  }
  return grid;
}

function initWeeklyGrid(): WeeklyPatternGrid {
  const grid = {} as WeeklyPatternGrid;
  for (const row of WEEKLY_PATTERN_ROWS) {
    grid[row.key] = emptyShiftTypeCounts();
  }
  return grid;
}

function deriveTotalShifts(byShiftType: DailyShiftGrid): Record<DOW, number> {
  const totalShifts = emptyDowCounts();
  for (const day of DOW_LIST) {
    for (const key of SCHEDULE_SHIFT_TYPES) {
      totalShifts[day] += byShiftType[key][day];
    }
  }
  return totalShifts;
}

export function buildShiftScheduleSummary(snapshot: Snapshot): ShiftScheduleSummary {
  const catalog = snapshot.shift_catalog ?? [];
  // Supervisors are baseline-fixed (not part of CP-SAT overlays) — exclude
  // them so Total shifts reflects only roster slots the optimizer decides.
  const agents = (snapshot.agents ?? []).filter((a) => a.role !== "Supervisor");
  const byShiftType = initDailyGrid();
  const byPattern = initWeeklyGrid();

  for (const agent of agents) {
    const catalogEntry = resolveCatalogEntry(agent, catalog);
    const shiftType = classifyScheduleShiftType(agent, catalogEntry);

    for (const day of agent.works_days ?? []) {
      byShiftType[shiftType][day] += 1;
    }

    const patternKey = weeklyPatternFromOffPair(agent.off_pair);
    if (patternKey) {
      byPattern[patternKey][shiftType] += 1;
    }
  }

  const totalShifts = deriveTotalShifts(byShiftType);
  const totalCubiclesRequired = buildDailyCubiclePeaks(snapshot);

  const weekTotals = {} as Record<ScheduleShiftTypeKey, number>;
  const weekPct = {} as Record<ScheduleShiftTypeKey, number>;
  let shiftTypeWeekGrandTotal = 0;

  for (const key of SCHEDULE_SHIFT_TYPES) {
    weekTotals[key] = sumDow(byShiftType[key]);
    shiftTypeWeekGrandTotal += weekTotals[key];
  }
  for (const key of SCHEDULE_SHIFT_TYPES) {
    weekPct[key] = pctOfTotal(weekTotals[key], shiftTypeWeekGrandTotal);
  }

  const activeShiftTypes = activeScheduleShiftTypes(weekTotals);

  const summaryWeekTotals = {
    totalShifts: sumDow(totalShifts),
    totalCubiclesRequired: sumDow(totalCubiclesRequired),
  };

  const summaryWeekPct = {
    totalShifts: summaryWeekTotals.totalShifts > 0 ? 100 : 0,
  };

  const rowTotals = {} as Record<WeeklyPatternKey, number>;
  const columnTotals = emptyShiftTypeCounts();
  let grandTotal = 0;

  for (const row of WEEKLY_PATTERN_ROWS) {
    const rowSum = SCHEDULE_SHIFT_TYPES.reduce(
      (acc, key) => acc + byPattern[row.key][key],
      0,
    );
    rowTotals[row.key] = rowSum;
    grandTotal += rowSum;
  }
  for (const key of SCHEDULE_SHIFT_TYPES) {
    columnTotals[key] = WEEKLY_PATTERN_ROWS.reduce(
      (acc, row) => acc + byPattern[row.key][key],
      0,
    );
  }

  const rowPct = {} as Record<WeeklyPatternKey, Record<ScheduleShiftTypeKey, number>>;
  for (const row of WEEKLY_PATTERN_ROWS) {
    rowPct[row.key] = {} as Record<ScheduleShiftTypeKey, number>;
    for (const key of SCHEDULE_SHIFT_TYPES) {
      rowPct[row.key][key] = pctOfTotal(byPattern[row.key][key], rowTotals[row.key]);
    }
  }

  const activePatternRows = activeWeeklyPatternRows(rowTotals);

  return {
    daily: {
      byShiftType,
      summary: { totalShifts, totalCubiclesRequired },
      weekTotals,
      weekPct,
      summaryWeekTotals,
      summaryWeekPct,
      activeShiftTypes,
    },
    weeklyPatterns: {
      byPattern,
      rowTotals,
      columnTotals,
      grandTotal,
      rowPct,
      activeShiftTypes,
      activePatternRows,
    },
  };
}

export interface ShiftScheduleSummaryDiff {
  daily: {
    byShiftType: DailyShiftGrid;
    summary: DailySummaryRows;
    weekTotals: Record<ScheduleShiftTypeKey, number>;
    summaryWeekTotals: Record<DailySummaryRowKey, number>;
  };
  weeklyPatterns: {
    byPattern: WeeklyPatternGrid;
    rowTotals: Record<WeeklyPatternKey, number>;
    columnTotals: Record<ScheduleShiftTypeKey, number>;
    grandTotal: number;
  };
}

function diffDowRows(
  baseline: Record<DOW, number>,
  proposed: Record<DOW, number>,
): Record<DOW, number> {
  const out = emptyDowCounts();
  for (const day of DOW_LIST) {
    out[day] = proposed[day] - baseline[day];
  }
  return out;
}

function diffShiftTypeGrid(baseline: DailyShiftGrid, proposed: DailyShiftGrid): DailyShiftGrid {
  const out = initDailyGrid();
  for (const key of SCHEDULE_SHIFT_TYPES) {
    out[key] = diffDowRows(baseline[key], proposed[key]);
  }
  return out;
}

function diffWeeklyGrid(
  baseline: WeeklyPatternGrid,
  proposed: WeeklyPatternGrid,
): WeeklyPatternGrid {
  const out = initWeeklyGrid();
  for (const row of WEEKLY_PATTERN_ROWS) {
    for (const key of SCHEDULE_SHIFT_TYPES) {
      out[row.key][key] = proposed[row.key][key] - baseline[row.key][key];
    }
  }
  return out;
}

export function diffShiftScheduleSummaries(
  baseline: ShiftScheduleSummary,
  proposed: ShiftScheduleSummary,
): ShiftScheduleSummaryDiff {
  const dailyByShiftType = diffShiftTypeGrid(
    baseline.daily.byShiftType,
    proposed.daily.byShiftType,
  );

  const summary = {
    totalShifts: diffDowRows(
      baseline.daily.summary.totalShifts,
      proposed.daily.summary.totalShifts,
    ),
    totalCubiclesRequired: diffDowRows(
      baseline.daily.summary.totalCubiclesRequired,
      proposed.daily.summary.totalCubiclesRequired,
    ),
  };

  const weekTotals = {} as Record<ScheduleShiftTypeKey, number>;
  for (const key of SCHEDULE_SHIFT_TYPES) {
    weekTotals[key] = proposed.daily.weekTotals[key] - baseline.daily.weekTotals[key];
  }

  const summaryWeekTotals = {
    totalShifts:
      proposed.daily.summaryWeekTotals.totalShifts - baseline.daily.summaryWeekTotals.totalShifts,
    totalCubiclesRequired:
      proposed.daily.summaryWeekTotals.totalCubiclesRequired -
      baseline.daily.summaryWeekTotals.totalCubiclesRequired,
  };

  const rowTotals = {} as Record<WeeklyPatternKey, number>;
  for (const row of WEEKLY_PATTERN_ROWS) {
    rowTotals[row.key] =
      proposed.weeklyPatterns.rowTotals[row.key] - baseline.weeklyPatterns.rowTotals[row.key];
  }

  const columnTotals = emptyShiftTypeCounts();
  for (const key of SCHEDULE_SHIFT_TYPES) {
    columnTotals[key] =
      proposed.weeklyPatterns.columnTotals[key] - baseline.weeklyPatterns.columnTotals[key];
  }

  return {
    daily: {
      byShiftType: dailyByShiftType,
      summary,
      weekTotals,
      summaryWeekTotals,
    },
    weeklyPatterns: {
      byPattern: diffWeeklyGrid(
        baseline.weeklyPatterns.byPattern,
        proposed.weeklyPatterns.byPattern,
      ),
      rowTotals,
      columnTotals,
      grandTotal: proposed.weeklyPatterns.grandTotal - baseline.weeklyPatterns.grandTotal,
    },
  };
}

export { DAILY_FOOTER_ROWS, DAILY_SUMMARY_ROW_LABELS } from "@/lib/compute/schedule-shift-types";
