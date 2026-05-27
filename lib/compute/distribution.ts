import { balanceTone, type BalanceTone } from "@/lib/compute/colors";
import { getLegacyCsaSupply } from "@/lib/compute/legacy-supply";
import { csaSupply, manualRosterSupply } from "@/lib/compute/supply";
import type { DOW, FunctionName, Snapshot } from "@/lib/data/types";
import { sum } from "@/lib/utils";

export type DistributionViewMode = "proposed" | "legacy" | "compare";

export const UNDER_SERVED_RATIO = 0.6;
export const CAPACITY_GAP_THRESHOLD = 0.5;

export interface IntervalSeries {
  offered: number[];
  abandoned: number[];
  required: number[];
  ahtSeconds: number[];
  proposed: number[];
  legacy: number[];
  manual: number[];
}

export interface HourDistributionRow {
  hour: string;
  hourIndex: number;
  calls: number;
  abandoned: number;
  abandonRate: number;
  ahtSeconds: number | null;
  requiredStaff: number;
  proposedStaff: number;
  legacyStaff: number;
  /** Manual roster (SDS + Next Day + Supervisor) on-shift headcount for the hour. */
  manualStaff: number;
  /** Proposed CSA headcount minus Erlang-required agents (negative = understaffed). */
  staffGap: number;
  /** Legacy CSA headcount minus Erlang-required agents. */
  legacyStaffGap: number;
  volShare: number;
  proposedShare: number;
  legacyShare: number;
  proposedRatio: number;
  legacyRatio: number;
}

export interface DayDistributionStats {
  offered: number[];
  abandoned: number[];
  required: number[];
  ahtSeconds: number[];
  proposed: number[];
  legacy: number[];
  manual: number[];
  dayCalls: number;
  dayAbandoned: number;
  dayAbandonRate: number;
  avgAhtSeconds: number | null;
  proposedHours: number;
  legacyHours: number;
  requiredHours: number;
  gapHoursProposed: number;
  gapHoursLegacy: number;
  matchedShareProposed: number;
  matchedShareLegacy: number;
  underServedProposed: number;
  underServedLegacy: number;
  rows: HourDistributionRow[];
  worstCapacity: HourDistributionRow[];
  overCapacity: HourDistributionRow[];
  worstProposed: HourDistributionRow[];
  worstLegacy: HourDistributionRow[];
  overProposed: HourDistributionRow[];
  overLegacy: HourDistributionRow[];
}

function scaleSupplyByFunction(
  supCombined: number[],
  offCombined: number[],
  offFn: number[],
): number[] {
  return supCombined.map((v, i) =>
    offCombined[i] ? v * (offFn[i] / offCombined[i]) : 0,
  );
}

function scaleRequiredByFunction(
  reqCombined: number[],
  offCombined: number[],
  offFn: number[],
): number[] {
  return reqCombined.map((v, i) =>
    offCombined[i] ? v * (offFn[i] / offCombined[i]) : 0,
  );
}

function getVolumeSeries(
  snapshot: Snapshot,
  day: DOW,
  fn: FunctionName,
): Pick<IntervalSeries, "offered" | "abandoned" | "required" | "ahtSeconds"> {
  const offCombined = snapshot.volume.offered_per_interval.Combined[day];
  const abCombined = snapshot.volume.abandoned_per_interval?.Combined?.[day] ?? [];
  const reqCombined = snapshot.volume.required_on_phones.Combined[day];
  const ahtCombined = snapshot.volume.aht_seconds.Combined[day];

  if (fn === "Combined") {
    return {
      offered: offCombined,
      abandoned: abCombined.length ? abCombined : offCombined.map(() => 0),
      required: reqCombined,
      ahtSeconds: ahtCombined,
    };
  }

  const offFn = snapshot.volume.offered_per_interval[fn][day];
  const abFn = snapshot.volume.abandoned_per_interval?.[fn]?.[day] ?? [];
  const reqFn = snapshot.volume.required_on_phones[fn][day];
  const ahtFn = snapshot.volume.aht_seconds[fn][day];

  return {
    offered: offFn,
    abandoned: abFn.length ? abFn : offFn.map(() => 0),
    required: scaleRequiredByFunction(reqCombined, offCombined, offFn),
    ahtSeconds: ahtFn,
  };
}

export function getIntervalSeries(
  snapshot: Snapshot,
  day: DOW,
  fn: FunctionName,
  leadPct: number,
): IntervalSeries {
  const volume = getVolumeSeries(snapshot, day, fn);
  const offCombined = snapshot.volume.offered_per_interval.Combined[day];
  const offFn =
    fn === "Combined"
      ? offCombined
      : snapshot.volume.offered_per_interval[fn][day];
  const proposedCombined = csaSupply(snapshot.agents, day, leadPct);
  const legacyCombined = getLegacyCsaSupply(day);
  const manualCombined = manualRosterSupply(snapshot.agents, day);
  const proposed =
    fn === "Combined"
      ? proposedCombined
      : scaleSupplyByFunction(proposedCombined, offCombined, offFn);
  const legacy =
    fn === "Combined"
      ? legacyCombined
      : scaleSupplyByFunction(legacyCombined, offCombined, offFn);
  const manual =
    fn === "Combined"
      ? manualCombined
      : scaleSupplyByFunction(manualCombined, offCombined, offFn);

  return { ...volume, proposed, legacy, manual };
}

function matchedShareAtIntervalLevel(
  offered: number[],
  supplied: number[],
): number {
  const offTotal = sum(offered) || 1;
  const supTotal = sum(supplied) || 1;
  let matched = 0;
  for (let i = 0; i < offered.length; i++) {
    matched += Math.min(offered[i] / offTotal, supplied[i] / supTotal);
  }
  return matched;
}

function hourlyAhtFromIntervals(
  aht: number[],
  offered: number[],
  abandoned: number[],
): number | null {
  const handled0 = Math.max(0, offered[0] - abandoned[0]);
  const handled1 = Math.max(0, offered[1] - abandoned[1]);
  const handledTotal = handled0 + handled1;
  if (handledTotal <= 0) return null;
  return (handled0 * aht[0] + handled1 * aht[1]) / handledTotal;
}

function buildHourlyRows(
  hours: string[],
  hourlyOff: number[],
  hourlyAb: number[],
  hourlyReq: number[],
  hourlyAht: Array<number | null>,
  hourlyProposed: number[],
  hourlyLegacy: number[],
  hourlyManual: number[],
): HourDistributionRow[] {
  const dayCalls = sum(hourlyOff) || 1;
  const dayProposed = sum(hourlyProposed) || 1;
  const dayLegacy = sum(hourlyLegacy) || 1;

  return hours.map((hour, idx) => {
    const calls = hourlyOff[idx];
    const abandoned = hourlyAb[idx];
    const requiredStaff = hourlyReq[idx];
    const proposedStaff = hourlyProposed[idx];
    const legacyStaff = hourlyLegacy[idx];
    const manualStaff = hourlyManual[idx];
    const staffGap = proposedStaff - requiredStaff;
    const legacyStaffGap = legacyStaff - requiredStaff;
    const volShare = calls / dayCalls;
    const proposedShare = proposedStaff / dayProposed;
    const legacyShare = legacyStaff / dayLegacy;
    const proposedRatio = volShare
      ? proposedShare / volShare
      : proposedStaff > 0
        ? 99
        : 1;
    const legacyRatio = volShare
      ? legacyShare / volShare
      : legacyStaff > 0
        ? 99
        : 1;
    return {
      hour,
      hourIndex: idx,
      calls,
      abandoned,
      abandonRate: calls ? abandoned / calls : 0,
      ahtSeconds: hourlyAht[idx],
      requiredStaff,
      proposedStaff,
      legacyStaff,
      manualStaff,
      staffGap,
      legacyStaffGap,
      volShare,
      proposedShare,
      legacyShare,
      proposedRatio,
      legacyRatio,
    };
  });
}

export function capacityGapStatus(gap: number) {
  if (Math.abs(gap) < CAPACITY_GAP_THRESHOLD) {
    return {
      label: "OK" as const,
      cls: "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950",
    };
  }
  if (gap < 0) {
    return {
      label: "Under" as const,
      cls: "text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-950",
    };
  }
  return {
    label: "Over" as const,
    cls: "text-indigo-700 bg-indigo-50 dark:text-indigo-300 dark:bg-indigo-950",
  };
}

export function computeDayDistribution(
  snapshot: Snapshot,
  day: DOW,
  fn: FunctionName,
  leadPct: number,
): DayDistributionStats {
  const { offered, abandoned, required, ahtSeconds, proposed, legacy, manual } =
    getIntervalSeries(snapshot, day, fn, leadPct);

  const hourlyOff = Array.from(
    { length: 24 },
    (_, h) => offered[h * 2] + offered[h * 2 + 1],
  );
  const hourlyAb = Array.from(
    { length: 24 },
    (_, h) => abandoned[h * 2] + abandoned[h * 2 + 1],
  );
  const hourlyReq = Array.from(
    { length: 24 },
    (_, h) => (required[h * 2] + required[h * 2 + 1]) / 2,
  );
  const hourlyAht = Array.from({ length: 24 }, (_, h) =>
    hourlyAhtFromIntervals(
      [ahtSeconds[h * 2], ahtSeconds[h * 2 + 1]],
      [offered[h * 2], offered[h * 2 + 1]],
      [abandoned[h * 2], abandoned[h * 2 + 1]],
    ),
  );
  const hourlyProposed = Array.from(
    { length: 24 },
    (_, h) => (proposed[h * 2] + proposed[h * 2 + 1]) / 2,
  );
  const hourlyLegacy = Array.from(
    { length: 24 },
    (_, h) => (legacy[h * 2] + legacy[h * 2 + 1]) / 2,
  );
  const hourlyManual = Array.from(
    { length: 24 },
    (_, h) => (manual[h * 2] + manual[h * 2 + 1]) / 2,
  );

  const rows = buildHourlyRows(
    snapshot.meta.hours,
    hourlyOff,
    hourlyAb,
    hourlyReq,
    hourlyAht,
    hourlyProposed,
    hourlyLegacy,
    hourlyManual,
  );

  const dayAbandoned = sum(abandoned);
  const dayCalls = sum(offered);
  const handledWeight = offered.map((v, i) => Math.max(0, v - abandoned[i]));
  const handledTotal = sum(handledWeight);
  const avgAhtSeconds = handledTotal
    ? sum(ahtSeconds.map((v, i) => v * handledWeight[i])) / handledTotal
    : null;

  const gapHoursProposed = rows.filter(
    (r) => r.calls > 0 && r.staffGap < -CAPACITY_GAP_THRESHOLD,
  ).length;
  const gapHoursLegacy = rows.filter(
    (r) => r.calls > 0 && r.legacyStaffGap < -CAPACITY_GAP_THRESHOLD,
  ).length;

  const underServedProposed = rows.filter(
    (r) => r.volShare > 0 && r.proposedRatio < UNDER_SERVED_RATIO,
  ).length;
  const underServedLegacy = rows.filter(
    (r) => r.volShare > 0 && r.legacyRatio < UNDER_SERVED_RATIO,
  ).length;

  const withVolume = rows.filter((r) => r.calls > 0);
  const worstCapacity = [...withVolume]
    .sort((a, b) => a.staffGap - b.staffGap)
    .slice(0, 3);
  const overCapacity = [...withVolume]
    .sort((a, b) => b.staffGap - a.staffGap)
    .slice(0, 3);
  const worstProposed = [...withVolume]
    .sort((a, b) => a.proposedRatio - b.proposedRatio)
    .slice(0, 3);
  const worstLegacy = [...withVolume]
    .sort((a, b) => a.legacyRatio - b.legacyRatio)
    .slice(0, 3);
  const overProposed = [...withVolume]
    .sort((a, b) => b.proposedRatio - a.proposedRatio)
    .slice(0, 3);
  const overLegacy = [...withVolume]
    .sort((a, b) => b.legacyRatio - a.legacyRatio)
    .slice(0, 3);

  return {
    offered,
    abandoned,
    required,
    ahtSeconds,
    proposed,
    legacy,
    manual,
    dayCalls,
    dayAbandoned,
    dayAbandonRate: dayCalls ? dayAbandoned / dayCalls : 0,
    avgAhtSeconds,
    proposedHours: sum(proposed) / 2,
    legacyHours: sum(legacy) / 2,
    requiredHours: sum(required) / 2,
    gapHoursProposed,
    gapHoursLegacy,
    matchedShareProposed: matchedShareAtIntervalLevel(offered, proposed),
    matchedShareLegacy: matchedShareAtIntervalLevel(offered, legacy),
    underServedProposed,
    underServedLegacy,
    rows,
    worstCapacity,
    overCapacity,
    worstProposed,
    worstLegacy,
    overProposed,
    overLegacy,
  };
}

export function rowBalanceTone(
  volShare: number,
  staffShare: number,
  ratio: number,
): BalanceTone | { label: string; cls: string } {
  if (volShare === 0 && staffShare === 0) {
    return {
      label: "No volume",
      cls: "text-slate-400 bg-slate-50 dark:text-slate-500 dark:bg-slate-900",
    };
  }
  if (volShare === 0) {
    return {
      label: "Buffer",
      cls: "text-muted-foreground bg-muted/50",
    };
  }
  return balanceTone(ratio);
}
