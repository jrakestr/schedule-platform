import { getLegacyCsaSupply } from "@/lib/compute/legacy-supply";
import { csaSupply } from "@/lib/compute/supply";
import { DOW_LIST, type DOW, type Snapshot } from "@/lib/data/types";
import {
  DOW_LIST_SUN_FIRST,
  type CumulativeMatchedWindow,
} from "@/lib/compute/cumulative-matched-share";

export type DaySupplyFn = (day: DOW) => number[];

export function snapshotSupplyFn(
  snapshot: Snapshot,
  leadPct: number,
): DaySupplyFn {
  return (day) => csaSupply(snapshot.agents, day, leadPct);
}

export function legacySupplyFn(): DaySupplyFn {
  return (day) => getLegacyCsaSupply(day);
}

function formatWindowLabel(days: readonly DOW[]): string {
  if (days.length === 1) return days[0];
  return `${days[0]}–${days[days.length - 1]}`;
}

export function volumeMatchedShareFromSupply(
  snapshot: Snapshot,
  supplyFn: DaySupplyFn,
  days: readonly DOW[],
): number | null {
  let totalVol = 0;
  let totalStaff = 0;
  const buckets: Array<{ off: number; sup: number }> = [];

  for (const d of days) {
    const off = snapshot.volume.offered_per_interval.Combined[d];
    const sup = supplyFn(d);
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

export function cumulativeMatchedWindowsFromSupply(
  snapshot: Snapshot,
  supplyFn: DaySupplyFn,
): CumulativeMatchedWindow[] {
  const days: DOW[] = [];
  return DOW_LIST_SUN_FIRST.map((throughDay) => {
    days.push(throughDay);
    const windowDays = [...days] as readonly DOW[];
    return {
      throughDay,
      label: formatWindowLabel(windowDays),
      days: windowDays,
      matchedShare: volumeMatchedShareFromSupply(snapshot, supplyFn, windowDays),
    };
  });
}

export function coverageRatioFromSupply(
  snapshot: Snapshot,
  supplyFn: DaySupplyFn,
  fn: "Combined" | "Reservations" | "ETA" | "Cancellations" = "Combined",
): number {
  let req = 0;
  let cov = 0;
  for (const d of DOW_LIST) {
    const r = snapshot.volume.required_on_phones[fn][d];
    const supAll = supplyFn(d);
    for (let i = 0; i < 48; i++) {
      let sup = supAll[i] ?? 0;
      if (fn !== "Combined") {
        const comb = snapshot.volume.required_on_phones.Combined[d][i] || 0;
        sup = comb ? sup * ((r[i] ?? 0) / comb) : 0;
      }
      req += r[i] ?? 0;
      cov += Math.min(r[i] ?? 0, sup);
    }
  }
  return req ? cov / req : 1;
}

export function totalCsaHoursFromSupply(supplyFn: DaySupplyFn): number {
  let intervals = 0;
  for (const d of DOW_LIST) {
    intervals += supplyFn(d).reduce((sum, value) => sum + value, 0);
  }
  return intervals / 2;
}

export interface RosterComparisonMetrics {
  volumeMatchedShare: number | null;
  weightedCoveragePct: number;
  totalCsaHours: number;
  cumulativeWindows: CumulativeMatchedWindow[];
  dailyMatched: Record<DOW, number | null>;
}

export function computeRosterMetrics(
  volumeSnapshot: Snapshot,
  supplyFn: DaySupplyFn,
): RosterComparisonMetrics {
  const dailyMatched = Object.fromEntries(
    DOW_LIST.map((d) => [
      d,
      volumeMatchedShareFromSupply(volumeSnapshot, supplyFn, [d]),
    ]),
  ) as Record<DOW, number | null>;

  return {
    volumeMatchedShare: volumeMatchedShareFromSupply(
      volumeSnapshot,
      supplyFn,
      DOW_LIST_SUN_FIRST,
    ),
    weightedCoveragePct: coverageRatioFromSupply(volumeSnapshot, supplyFn) * 100,
    totalCsaHours: totalCsaHoursFromSupply(supplyFn),
    cumulativeWindows: cumulativeMatchedWindowsFromSupply(volumeSnapshot, supplyFn),
    dailyMatched,
  };
}

export function computeSnapshotRosterMetrics(
  snapshot: Snapshot,
  leadPct: number,
): RosterComparisonMetrics {
  return computeRosterMetrics(snapshot, snapshotSupplyFn(snapshot, leadPct));
}

export function computeLegacyRosterMetrics(
  volumeSnapshot: Snapshot,
): RosterComparisonMetrics {
  return computeRosterMetrics(volumeSnapshot, legacySupplyFn());
}
