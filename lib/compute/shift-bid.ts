import type { ShiftCatalogEntry } from "@/lib/data/types";

/** Optimizer bid categories — mirrors scripts/optimize_roster_with_cubicles.py */
export type ShiftBidKey =
  | "sixHour"
  | "eightHour"
  | "tenHour"
  | "twelveHour"
  | "splitShift";

export const SHIFT_BID_ORDER: readonly ShiftBidKey[] = [
  "eightHour",
  "sixHour",
  "tenHour",
  "twelveHour",
  "splitShift",
] as const;

export const SHIFT_BID_LABELS: Record<ShiftBidKey, string> = {
  eightHour: "8-hour",
  sixHour: "6-hour",
  tenHour: "10-hour",
  twelveHour: "12-hour",
  splitShift: "Split",
};

export const SHIFT_BID_DOT_CLASS: Record<ShiftBidKey, string> = {
  sixHour: "bg-indigo-500",
  eightHour: "bg-emerald-500",
  tenHour: "bg-amber-500",
  twelveHour: "bg-rose-500",
  splitShift: "bg-sky-500",
};

type ShiftBidInput = Pick<
  ShiftCatalogEntry,
  "shift_id" | "shift_class" | "gross_minutes"
>;

export function getShiftBidCategory(
  shift: ShiftBidInput,
): ShiftBidKey | "unknown" {
  const shiftId = shift.shift_id.toUpperCase();
  if (shiftId.includes("SPLIT")) return "splitShift";
  if (shiftId.includes("SUPER12")) return "twelveHour";

  const sc = shift.shift_class.toUpperCase();
  if (sc === "SPLIT") return "splitShift";
  if (sc === "SUPER12") return "twelveHour";
  if (sc === "TWILIGHT" || sc === "MID6" || sc === "ON6") return "sixHour";
  if (
    sc === "EARLY" ||
    sc === "AM_CORE" ||
    sc === "MID" ||
    sc === "PM_PEAK" ||
    sc === "LATE" ||
    sc === "OVERNIGHT" ||
    sc === "FT8"
  ) {
    return "eightHour";
  }
  if (sc === "WKND_AM" || sc === "WKND_PM" || sc === "LT10") return "tenHour";

  const gross = shift.gross_minutes;
  if (gross >= 300 && gross <= 420) return "sixHour";
  if (gross >= 450 && gross <= 540) return "eightHour";
  if (gross >= 570 && gross <= 690) return "tenHour";
  if (gross >= 700 && gross <= 780) return "twelveHour";
  return "unknown";
}

export interface ShiftBidSummaryRow {
  key: ShiftBidKey;
  label: string;
  templateCount: number;
  agentCount: number;
}

export function summarizeShiftBids(
  catalog: ShiftCatalogEntry[],
  assignedByShift: Record<string, unknown[]>,
): ShiftBidSummaryRow[] {
  const tallies = new Map<
    ShiftBidKey,
    { templateCount: number; agentCount: number }
  >();

  for (const shift of catalog) {
    const agents = assignedByShift[shift.shift_id] ?? [];
    if (agents.length === 0) continue;

    const bid = getShiftBidCategory(shift);
    if (bid === "unknown") continue;

    const row = tallies.get(bid) ?? { templateCount: 0, agentCount: 0 };
    row.templateCount += 1;
    row.agentCount += agents.length;
    tallies.set(bid, row);
  }

  return SHIFT_BID_ORDER.filter((key) => tallies.has(key)).map((key) => ({
    key,
    label: SHIFT_BID_LABELS[key],
    templateCount: tallies.get(key)!.templateCount,
    agentCount: tallies.get(key)!.agentCount,
  }));
}
