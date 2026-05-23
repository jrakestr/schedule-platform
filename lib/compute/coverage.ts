// Within-cap distribution metric: how well the scheduled staff distribution
// matches the call volume distribution. For each (day, interval) we compute
// the share of the week's call volume in that bucket and the share of the
// week's scheduled staff in that bucket. The volume-matched share is
// sum(min(volumeShare, staffShare)). 1.0 means perfect alignment, 0.5 means
// half of the call volume hits hours where the staff isn't.

import { DOW_LIST, type DOW, type Snapshot } from "@/lib/data/types";
import { csaSupply } from "@/lib/compute/supply";

export function volumeMatchedShare(snapshot: Snapshot, leadPct: number): number {
  const offered: Record<string, number[]> = {};
  const staffed: Record<string, number[]> = {};
  let totalVol = 0;
  let totalStaff = 0;
  for (const d of DOW_LIST) {
    offered[d] = snapshot.volume.offered_per_interval.Combined[d];
    staffed[d] = csaSupply(snapshot.agents, d as DOW, leadPct);
    for (let i = 0; i < 48; i++) {
      totalVol += offered[d][i] ?? 0;
      totalStaff += staffed[d][i] ?? 0;
    }
  }
  if (totalVol === 0 || totalStaff === 0) return 0;
  let matched = 0;
  for (const d of DOW_LIST) {
    for (let i = 0; i < 48; i++) {
      matched += Math.min(
        (offered[d][i] ?? 0) / totalVol,
        (staffed[d][i] ?? 0) / totalStaff,
      );
    }
  }
  return matched;
}

export function coverageRatio(
  snapshot: Snapshot,
  leadPct: number,
  fn: "Combined" | "Reservations" | "ETA" | "Cancellations" = "Combined",
): number {
  let req = 0;
  let cov = 0;
  for (const d of DOW_LIST) {
    const r = snapshot.volume.required_on_phones[fn][d];
    const supAll = csaSupply(snapshot.agents, d as DOW, leadPct);
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
