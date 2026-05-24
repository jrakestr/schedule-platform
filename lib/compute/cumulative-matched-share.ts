import { csaSupply } from "@/lib/compute/supply";
import type { Agent, DOW, Snapshot } from "@/lib/data/types";

/** Sun-first week order for cumulative day windows. */
export const DOW_LIST_SUN_FIRST: readonly DOW[] = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

export interface CumulativeMatchedWindow {
  throughDay: DOW;
  /** e.g. "Sun", "Sun–Mon", "Sun–Sat" */
  label: string;
  days: readonly DOW[];
  matchedShare: number | null;
}

function formatWindowLabel(days: readonly DOW[]): string {
  if (days.length === 1) return days[0];
  return `${days[0]}–${days[days.length - 1]}`;
}

/**
 * Volume-matched share restricted to a set of calendar days and optional agent
 * subset. Same interval-level formula as weekly coverage: for each (day,
 * 30-min) bucket, sum min(volumeShare, staffShare) where shares are relative
 * to totals across the included days only.
 */
export function volumeMatchedShareForDays(
  snapshot: Snapshot,
  days: readonly DOW[],
  leadPct: number,
  agents?: Agent[],
): number | null {
  const agentPool = agents ?? snapshot.agents;
  let totalVol = 0;
  let totalStaff = 0;
  const buckets: Array<{ off: number; sup: number }> = [];

  for (const d of days) {
    const off = snapshot.volume.offered_per_interval.Combined[d];
    const sup = csaSupply(agentPool, d, leadPct);
    for (let i = 0; i < 48; i++) {
      const o = off[i] ?? 0;
      const s = sup[i] ?? 0;
      totalVol += o;
      totalStaff += s;
      buckets.push({ off: o, sup: s });
    }
  }

  if (totalVol === 0 || totalStaff === 0) return null;

  let matched = 0;
  for (const b of buckets) {
    matched += Math.min(b.off / totalVol, b.sup / totalStaff);
  }
  return matched;
}

export function cumulativeMatchedWindows(
  snapshot: Snapshot,
  leadPct: number,
  agents?: Agent[],
): CumulativeMatchedWindow[] {
  const days: DOW[] = [];
  return DOW_LIST_SUN_FIRST.map((throughDay) => {
    days.push(throughDay);
    const windowDays = [...days] as readonly DOW[];
    return {
      throughDay,
      label: formatWindowLabel(windowDays),
      days: windowDays,
      matchedShare: volumeMatchedShareForDays(
        snapshot,
        windowDays,
        leadPct,
        agents,
      ),
    };
  });
}

export interface ShiftCumulativeMatchedRow {
  shiftId: string;
  startClock: string;
  endClock: string;
  csaCount: number;
  windows: CumulativeMatchedWindow[];
}

export function cumulativeMatchedShareByShift(
  snapshot: Snapshot,
  leadPct: number,
  shiftIds?: string[],
): ShiftCumulativeMatchedRow[] {
  const ids =
    shiftIds ??
    snapshot.shift_catalog
      .map((s) => s.shift_id)
      .filter((id) =>
        snapshot.agents.some(
          (a) =>
            a.role === "CSA" &&
            (a.shift_id === id || a.shift_class === id),
        ),
      );

  const catalogById = new Map(
    snapshot.shift_catalog.map((s) => [s.shift_id, s]),
  );

  return ids
    .map((shiftId) => {
      const shiftAgents = snapshot.agents.filter(
        (a) =>
          a.role === "CSA" &&
          (a.shift_id === shiftId || a.shift_class === shiftId),
      );
      const catalog = catalogById.get(shiftId);
      return {
        shiftId,
        startClock: catalog?.start_clock ?? "—",
        endClock: catalog?.end_clock ?? "—",
        csaCount: shiftAgents.length,
        windows: cumulativeMatchedWindows(snapshot, leadPct, shiftAgents),
      };
    })
    .sort((a, b) => {
      const aCat = catalogById.get(a.shiftId);
      const bCat = catalogById.get(b.shiftId);
      const aStart = aCat?.start_minute ?? 0;
      const bStart = bCat?.start_minute ?? 0;
      if (aStart !== bStart) return aStart - bStart;
      return a.shiftId.localeCompare(b.shiftId);
    });
}
