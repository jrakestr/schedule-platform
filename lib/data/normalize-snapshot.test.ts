import { describe, expect, it } from "vitest";
import { normalizeSnapshotPods } from "@/lib/data/normalize-snapshot";
import type { Snapshot } from "@/lib/data/types";

function pod(supervisorId: string) {
  return {
    type: "Operations",
    supervisor_id: supervisorId,
    lead_id: "CSA_Lead_001",
    members: [],
    description: "",
    coverage_start: "06:00",
    coverage_end: "18:00",
    coverage_window: "06:00-18:00",
  };
}

function snapshotWithPods(pods: Snapshot["pods"]): Snapshot {
  return {
    meta: {} as Snapshot["meta"],
    pods,
    agents: [],
    shift_catalog: [],
    volume: {} as Snapshot["volume"],
    cubicles: {} as Snapshot["cubicles"],
    roles: {} as Snapshot["roles"],
    supply: {} as Snapshot["supply"],
    coverage_hourly: {} as Snapshot["coverage_hourly"],
    supervisor_schedule: {} as Snapshot["supervisor_schedule"],
  };
}

describe("normalizeSnapshotPods", () => {
  it("leaves Team 1–6 snapshots unchanged", () => {
    const input = snapshotWithPods({
      "Team 1": pod("Sup_01"),
      "Team 2": pod("Sup_02"),
    });
    expect(normalizeSnapshotPods(input)).toBe(input);
  });

  it("renames legacy themed pod keys via supervisor_id", () => {
    const input = snapshotWithPods({
      "Camelback Coyotes": pod("Sup_03"),
      "Desert Roadrunners": pod("Sup_02"),
      "Night Owls": pod("Sup_06"),
    });

    const out = normalizeSnapshotPods(input);
    expect(Object.keys(out.pods).sort()).toEqual(["Team 2", "Team 3", "Team 6"]);
  });
});
