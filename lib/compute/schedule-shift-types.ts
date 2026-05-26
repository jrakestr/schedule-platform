import type { Agent, DOW, ShiftCatalogEntry } from "@/lib/data/types";

/** Spreadsheet-style shift type keys for schedule summary tables. */
export type ScheduleShiftTypeKey =
  | "eightHourRegular"
  | "eightHourSplit11"
  | "eightHourSplit12"
  | "sixHourRegular"
  | "tenHourRegular"
  | "tenHourSplit13"
  | "twelveHour";

export const SCHEDULE_SHIFT_TYPES: readonly ScheduleShiftTypeKey[] = [
  "eightHourRegular",
  "eightHourSplit11",
  "eightHourSplit12",
  "sixHourRegular",
  "tenHourRegular",
  "tenHourSplit13",
  "twelveHour",
] as const;

export const SCHEDULE_SHIFT_TYPE_LABELS: Record<ScheduleShiftTypeKey, string> = {
  eightHourRegular: "8-hour regular",
  eightHourSplit11: "8-hour split · 11h spread",
  eightHourSplit12: "8-hour split · 12h spread",
  sixHourRegular: "6-hour regular",
  tenHourRegular: "10-hour regular",
  tenHourSplit13: "10-hour split · 13h spread",
  twelveHour: "12-hour",
};

/** Summary row keys for the daily shifts table (non-shift-type rows). */
export type DailySummaryRowKey =
  | "eightHourSplitTotal"
  | "totalSplitShifts"
  | "totalNonStraightEightHour"
  | "totalShifts"
  | "totalCubiclesRequired";

export const DAILY_SUMMARY_ROW_LABELS: Record<DailySummaryRowKey, string> = {
  eightHourSplitTotal: "8-hour split total",
  totalSplitShifts: "Total split shifts",
  totalNonStraightEightHour: "Total non-straight 8-hour shifts",
  totalShifts: "Total Shifts",
  totalCubiclesRequired: "Total Cubicles Required",
};

export type WeeklyPatternKey =
  | "monFri"
  | "wedSun"
  | "thursMon"
  | "friTues"
  | "satWed"
  | "sunThurs"
  | "tuesSat";

export interface WeeklyPatternRow {
  key: WeeklyPatternKey;
  label: string;
  offPair: string;
}

/** Seven consecutive off-pair rotation patterns (matches roster OFF_PAIR_DAYS). */
export const WEEKLY_PATTERN_ROWS: readonly WeeklyPatternRow[] = [
  { key: "monFri", label: "Mon–Fri / Mon–Thurs", offPair: "Sat+Sun" },
  { key: "wedSun", label: "Wed–Sun / Wed–Sat", offPair: "Mon+Tue" },
  { key: "thursMon", label: "Thurs–Mon / Thurs–Sun", offPair: "Tue+Wed" },
  { key: "friTues", label: "Fri–Tues / Fri–Mon", offPair: "Wed+Thu" },
  { key: "satWed", label: "Sat–Wed / Sat–Tues", offPair: "Thu+Fri" },
  { key: "sunThurs", label: "Sun–Thurs / Sun–Wed", offPair: "Fri+Sat" },
  { key: "tuesSat", label: "Tues–Sat / Tues–Fri", offPair: "Sun+Mon" },
] as const;

const OFF_PAIR_TO_PATTERN = new Map<string, WeeklyPatternKey>(
  WEEKLY_PATTERN_ROWS.map((row) => [row.offPair, row.key]),
);

const EIGHT_HOUR_CLASSES = new Set([
  "EARLY",
  "AM_CORE",
  "MID",
  "PM_PEAK",
  "LATE",
  "OVERNIGHT",
  "FT8",
]);

const SIX_HOUR_CLASSES = new Set(["TWILIGHT", "MID6", "ON6"]);
const TEN_HOUR_CLASSES = new Set(["WKND_AM", "WKND_PM", "LT10"]);

function grossMinutesFromAgent(
  agent: Agent,
  catalogEntry?: ShiftCatalogEntry,
): number {
  if (catalogEntry?.gross_minutes != null) return catalogEntry.gross_minutes;
  if (agent.gross_hours != null && agent.gross_hours > 0) {
    return Math.round(agent.gross_hours * 60);
  }
  return 0;
}

function isSplitShift(shiftId: string, shiftClass: string): boolean {
  return shiftClass === "SPLIT" || shiftId.toUpperCase().includes("SPLIT");
}

function isSuper12(shiftId: string, shiftClass: string): boolean {
  return shiftClass === "SUPER12" || shiftId.toUpperCase().includes("SUPER12");
}

function isTenHourSplit(grossMinutes: number): boolean {
  return grossMinutes >= 750 && grossMinutes <= 810;
}

function splitSpreadBucket(grossMinutes: number): ScheduleShiftTypeKey {
  if (grossMinutes >= 630 && grossMinutes <= 690) return "eightHourSplit11";
  return "eightHourSplit12";
}

export function resolveCatalogEntry(
  agent: Agent,
  catalog: ShiftCatalogEntry[],
): ShiftCatalogEntry | undefined {
  return catalog.find((entry) => entry.shift_id === agent.shift_id);
}

/** Classify an agent into one of the seven schedule shift types. */
export function classifyScheduleShiftType(
  agent: Agent,
  catalogEntry?: ShiftCatalogEntry,
): ScheduleShiftTypeKey {
  const shiftId = agent.shift_id || "";
  const shiftClass = (catalogEntry?.shift_class ?? agent.shift_class ?? "").toUpperCase();
  const grossMinutes = grossMinutesFromAgent(agent, catalogEntry);

  if (isSplitShift(shiftId, shiftClass)) {
    return splitSpreadBucket(grossMinutes);
  }
  if (isSuper12(shiftId, shiftClass)) {
    return "twelveHour";
  }
  if (SIX_HOUR_CLASSES.has(shiftClass) || (grossMinutes >= 300 && grossMinutes <= 420)) {
    return "sixHourRegular";
  }
  if (TEN_HOUR_CLASSES.has(shiftClass)) {
    if (isTenHourSplit(grossMinutes)) return "tenHourSplit13";
    return "tenHourRegular";
  }
  if (EIGHT_HOUR_CLASSES.has(shiftClass)) {
    return "eightHourRegular";
  }
  if (grossMinutes >= 700 && grossMinutes <= 780) return "twelveHour";
  if (grossMinutes >= 570 && grossMinutes <= 690) {
    if (isTenHourSplit(grossMinutes)) return "tenHourSplit13";
    return "tenHourRegular";
  }
  if (grossMinutes >= 450 && grossMinutes <= 540) return "eightHourRegular";
  if (grossMinutes >= 300 && grossMinutes <= 420) return "sixHourRegular";
  return "eightHourRegular";
}

/** Map agent off_pair to weekly pattern row; null when non-standard (e.g. rotation). */
export function weeklyPatternFromOffPair(offPair: string | undefined): WeeklyPatternKey | null {
  if (!offPair) return null;
  const normalized = offPair.trim();
  if (normalized === "rotation") return null;
  return OFF_PAIR_TO_PATTERN.get(normalized) ?? null;
}

export function isSplitShiftType(key: ScheduleShiftTypeKey): boolean {
  return key === "eightHourSplit11" || key === "eightHourSplit12" || key === "tenHourSplit13";
}

export function isEightHourSplitType(key: ScheduleShiftTypeKey): boolean {
  return key === "eightHourSplit11" || key === "eightHourSplit12";
}

export function isNonStraightEightHourType(key: ScheduleShiftTypeKey): boolean {
  return (
    key === "eightHourSplit11" ||
    key === "eightHourSplit12" ||
    key === "sixHourRegular" ||
    key === "tenHourRegular" ||
    key === "tenHourSplit13" ||
    key === "twelveHour"
  );
}

export function emptyShiftTypeCounts(): Record<ScheduleShiftTypeKey, number> {
  return {
    eightHourRegular: 0,
    eightHourSplit11: 0,
    eightHourSplit12: 0,
    sixHourRegular: 0,
    tenHourRegular: 0,
    tenHourSplit13: 0,
    twelveHour: 0,
  };
}

export function emptyDowCounts(): Record<DOW, number> {
  return { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
}
