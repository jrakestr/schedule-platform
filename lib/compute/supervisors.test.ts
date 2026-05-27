import { describe, expect, it } from "vitest";
import { supervisorsOnDuty } from "@/lib/compute/supervisors";
import type { SupervisorSchedule } from "@/lib/data/types";

function sched(assignments: SupervisorSchedule["supervisors"][0]["assignments"]): SupervisorSchedule {
  return {
    status: "TEMPLATE",
    supervisors: [{ id: "Sup_01", assignments }],
    hourly_coverage: [],
    min_coverage: 1,
    single_cover_hours: 0,
    overlap_hours: 0,
    total_scheduled_hours: 0,
    required_hours: 168,
  };
}

describe("supervisorsOnDuty", () => {
  it("uses actual assignment hours, not rigid 06:00-18:00 blocks", () => {
    const schedule = sched([
      {
        weekday_idx: 0,
        weekday: "Monday",
        shift_type: "DAY",
        hours: "07:00-16:00",
      },
    ]);

    expect(supervisorsOnDuty(schedule, 0, 6)).toEqual([]);
    expect(supervisorsOnDuty(schedule, 0, 7)).toEqual(["Sup_01"]);
    expect(supervisorsOnDuty(schedule, 0, 15)).toEqual(["Sup_01"]);
    expect(supervisorsOnDuty(schedule, 0, 16)).toEqual([]);
  });

  it("covers overnight spill into the next calendar day", () => {
    const schedule = sched([
      {
        weekday_idx: 0,
        weekday: "Monday",
        shift_type: "NIGHT",
        hours: "18:00-04:00",
      },
    ]);

    expect(supervisorsOnDuty(schedule, 0, 20)).toEqual(["Sup_01"]);
    expect(supervisorsOnDuty(schedule, 1, 2)).toEqual(["Sup_01"]);
    expect(supervisorsOnDuty(schedule, 1, 5)).toEqual([]);
  });
});
