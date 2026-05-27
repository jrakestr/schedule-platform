import { describe, expect, it } from "vitest";
import {
  computeLegacyRosterMetrics,
  computeSnapshotRosterMetrics,
  volumeMatchedShareFromSupply,
} from "./roster-comparison";
import { DOW_LIST_SUN_FIRST } from "./cumulative-matched-share";
import type { Agent, DOW, Snapshot } from "@/lib/data/types";

function makeSnapshot(agents: Agent[]): Snapshot {
  const emptyDay = () => Array(48).fill(0);
  const offered: Record<DOW, number[]> = {
    Mon: emptyDay(),
    Tue: emptyDay(),
    Wed: emptyDay(),
    Thu: emptyDay(),
    Fri: emptyDay(),
    Sat: emptyDay(),
    Sun: emptyDay(),
  };
  offered.Mon[16] = 100;
  offered.Mon[17] = 100;

  const agent: Agent = {
    id: "CSA_001",
    role: "CSA",
    position: "Line",
    shift_id: "AM",
    shift_class: "AM",
    start_clock: "08:00",
    end_clock: "16:30",
    works_days: ["Mon"],
    structure: "08:00-16:30 Voice",
  };

  return {
    meta: {
      source: "test",
      source_rows: 0,
      forecast_weeks: [],
      dow: [...DOW_LIST_SUN_FIRST],
      intervals: [],
      hours: [],
      lead_on_work_default: 1,
      total_bodies: 1,
      role_counts: { CSA: 1, NDS: 0, SDS: 0, Supervisor: 0 },
      phones_open: "24/7",
      cubicle_cap: 34,
    },
    volume: {
      offered_per_interval: { Combined: offered },
      required_on_phones: { Combined: offered },
      aht_seconds: { Combined: offered },
      weekly: { Combined: { offered: 200, abandoned: 0 } },
    },
    agents: agents.length ? agents : [agent],
    shift_catalog: [],
    pods: {},
    cubicles: { cap: 34, occupancy_by_day_hour: offered },
    coverage_hourly: {},
  } as unknown as Snapshot;
}

describe("roster comparison metrics", () => {
  it("computes snapshot roster metrics with cumulative windows", () => {
    const snap = makeSnapshot([]);
    const metrics = computeSnapshotRosterMetrics(snap, 1);
    expect(metrics.cumulativeWindows).toHaveLength(7);
    expect(metrics.totalCsaHours).toBeGreaterThan(0);
    expect(metrics.volumeMatchedShare).not.toBeNull();
  });

  it("computes legacy roster metrics from legacy supply", () => {
    const snap = makeSnapshot([]);
    const metrics = computeLegacyRosterMetrics(snap);
    expect(metrics.cumulativeWindows).toHaveLength(7);
    expect(metrics.totalCsaHours).toBeGreaterThan(0);
  });

  it("returns null when supply is empty for a day window", () => {
    const snap = makeSnapshot([]);
    const emptySupply = () => Array(48).fill(0);
    expect(
      volumeMatchedShareFromSupply(snap, emptySupply, ["Mon"]),
    ).toBeNull();
  });
});
