import { DOW_LIST, type DOW, type Snapshot } from "@/lib/data/types";
import {
  classifyScheduleShiftType,
  DAILY_SUMMARY_ROW_LABELS,
  emptyDowCounts,
  emptyShiftTypeCounts,
  isEightHourSplitType,
  isNonStraightEightHourType,
  isSplitShiftType,
  resolveCatalogEntry,
  SCHEDULE_SHIFT_TYPES,
  type DailySummaryRowKey,
  type ScheduleShiftTypeKey,
  weeklyPatternFromOffPair,
  WEEKLY_PATTERN_ROWS,
  type WeeklyPatternKey,
} from "@/lib/compute/schedule-shift-types";

export type DailyShiftGrid = Record<ScheduleShiftTypeKey, Record<DOW, number>>;

export interface DailySummaryRows {
  eightHourSplitTotal: Record<DOW, number>;
  totalSplitShifts: Record<DOW, number>;
  totalNonStraightEightHour: Record<DOW, number>;
  totalShifts: Record<DOW, number>;
  totalCubiclesRequired: Record<DOW, number>;
}

export interface DailyShiftTable {
  byShiftType: DailyShiftGrid;
  summary: DailySummaryRows;
  weekTotals: Record<ScheduleShiftTypeKey, number>;
  weekPct: Record<ScheduleShiftTypeKey, number>;
  summaryWeekTotals: Record<DailySummaryRowKey, number>;
  summaryWeekPct: Record<Exclude<DailySummaryRowKey, "totalCubiclesRequired">, number>;
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

function deriveDailySummary(byShiftType: DailyShiftGrid): Omit<DailySummaryRows, "totalCubiclesRequired"> {
  const eightHourSplitTotal = emptyDowCounts();
  const totalSplitShifts = emptyDowCounts();
  const totalNonStraightEightHour = emptyDowCounts();
  const totalShifts = emptyDowCounts();

  for (const day of DOW_LIST) {
    for (const key of SCHEDULE_SHIFT_TYPES) {
      const count = byShiftType[key][day];
      totalShifts[day] += count;
      if (isEightHourSplitType(key)) eightHourSplitTotal[day] += count;
      if (isSplitShiftType(key)) totalSplitShifts[day] += count;
      if (isNonStraightEightHourType(key)) totalNonStraightEightHour[day] += count;
    }
  }

  return { eightHourSplitTotal, totalSplitShifts, totalNonStraightEightHour, totalShifts };
}

export function buildShiftScheduleSummary(snapshot: Snapshot): ShiftScheduleSummary {
  const catalog = snapshot.shift_catalog ?? [];
  const agents = snapshot.agents ?? [];
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

  const derived = deriveDailySummary(byShiftType);
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

  const summaryWeekTotals = {
    eightHourSplitTotal: sumDow(derived.eightHourSplitTotal),
    totalSplitShifts: sumDow(derived.totalSplitShifts),
    totalNonStraightEightHour: sumDow(derived.totalNonStraightEightHour),
    totalShifts: sumDow(derived.totalShifts),
    totalCubiclesRequired: sumDow(totalCubiclesRequired),
  } as Record<DailySummaryRowKey, number>;

  const summaryWeekPct = {
    eightHourSplitTotal: pctOfTotal(summaryWeekTotals.eightHourSplitTotal, summaryWeekTotals.totalShifts),
    totalSplitShifts: pctOfTotal(summaryWeekTotals.totalSplitShifts, summaryWeekTotals.totalShifts),
    totalNonStraightEightHour: pctOfTotal(
      summaryWeekTotals.totalNonStraightEightHour,
      summaryWeekTotals.totalShifts,
    ),
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

  return {
    daily: {
      byShiftType,
      summary: { ...derived, totalCubiclesRequired },
      weekTotals,
      weekPct,
      summaryWeekTotals,
      summaryWeekPct,
    },
    weeklyPatterns: {
      byPattern,
      rowTotals,
      columnTotals,
      grandTotal,
      rowPct,
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
    eightHourSplitTotal: diffDowRows(
      baseline.daily.summary.eightHourSplitTotal,
      proposed.daily.summary.eightHourSplitTotal,
    ),
    totalSplitShifts: diffDowRows(
      baseline.daily.summary.totalSplitShifts,
      proposed.daily.summary.totalSplitShifts,
    ),
    totalNonStraightEightHour: diffDowRows(
      baseline.daily.summary.totalNonStraightEightHour,
      proposed.daily.summary.totalNonStraightEightHour,
    ),
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

  const summaryWeekTotals = {} as Record<DailySummaryRowKey, number>;
  for (const key of Object.keys(DAILY_SUMMARY_ROW_LABELS) as DailySummaryRowKey[]) {
    summaryWeekTotals[key] =
      proposed.daily.summaryWeekTotals[key] - baseline.daily.summaryWeekTotals[key];
  }

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

export { DAILY_SUMMARY_ROW_LABELS };
