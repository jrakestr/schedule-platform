import { describe, expect, it } from "vitest";
import {
  cumulativeMatchedWindows,
  DOW_LIST_SUN_FIRST,
  volumeMatchedShareForDays,
} from "./cumulative-matched-share";
import { volumeMatchedShare } from "./coverage";
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
  // Concentrate volume on Mon 08:00–09:00 (intervals 16–17)
  offered.Mon[16] = 100;
  offered.Mon[17] = 100;
  offered.Tue[16] = 50;
  offered.Tue[17] = 50;

  const agent: Agent = {
    id: "CSA_001",
    role: "CSA",
    position: "Line",
    shift_id: "AM",
    shift_class: "AM",
    start_clock: "08:00",
    end_clock: "16:30",
    works_days: ["Mon", "Tue"],
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
      weekly: { Combined: { offered: 300, abandoned: 0 } },
    },
    agents: agents.length ? agents : [agent],
    shift_catalog: [],
    pods: {},
    cubicles: { cap: 34, occupancy_by_day_hour: offered },
    coverage_hourly: {},
  } as unknown as Snapshot;
}

describe("volumeMatchedShareForDays", () => {
  it("returns null when no staff in window", () => {
    const snap = makeSnapshot([]);
    expect(
      volumeMatchedShareForDays(snap, ["Wed"], 1, []),
    ).toBeNull();
  });

  it("matches full-week volumeMatchedShare when all days included", () => {
    const snap = makeSnapshot([]);
    const full = volumeMatchedShareForDays(
      snap,
      DOW_LIST_SUN_FIRST,
      1,
    );
    const weekly = volumeMatchedShare(snap, 1);
    expect(full).toBeCloseTo(weekly, 6);
  });

  it("builds Sun-first cumulative windows", () => {
    const snap = makeSnapshot([]);
    const windows = cumulativeMatchedWindows(snap, 1);
    expect(windows).toHaveLength(7);
    expect(windows[0].label).toBe("Sun");
    expect(windows[1].label).toBe("Sun–Mon");
    expect(windows[6].label).toBe("Sun–Sat");
  });
});
