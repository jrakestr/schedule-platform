import { describe, expect, it } from "vitest";
import {
  classifyScheduleShiftType,
  weeklyPatternFromOffPair,
} from "./schedule-shift-types";
import {
  buildShiftScheduleSummary,
  diffShiftScheduleSummaries,
} from "./shift-schedule-summary";
import type { Agent, DOW, ShiftCatalogEntry, Snapshot } from "@/lib/data/types";

function catalogEntry(
  overrides: Partial<ShiftCatalogEntry> & Pick<ShiftCatalogEntry, "shift_id">,
): ShiftCatalogEntry {
  return {
    label: overrides.shift_id,
    shift_class: "FT8",
    start_minute: 0,
    start_clock: "08:00",
    end_clock: "16:30",
    gross_minutes: 510,
    productive_minutes: 480,
    days: "Mon–Fri",
    rationale: "",
    segments: [],
    coverage_mask: [],
    ...overrides,
  };
}

function agent(overrides: Partial<Agent> & Pick<Agent, "id">): Agent {
  return {
    role: "CSA",
    position: "Line",
    shift_id: "AM_CORE",
    shift_class: "AM_CORE",
    start_clock: "07:00",
    end_clock: "15:30",
    gross_hours: 8.5,
    works_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    structure: "",
    ...overrides,
  };
}

function minimalSnapshot(
  agents: Agent[],
  catalog: ShiftCatalogEntry[],
  occupancy?: Partial<Record<DOW, number[]>>,
): Snapshot {
  const defaultOcc: Record<DOW, number[]> = {
    Mon: [10, 12, 14],
    Tue: [11, 13, 15],
    Wed: [9, 11, 13],
    Thu: [10, 12, 14],
    Fri: [11, 13, 15],
    Sat: [5, 6, 7],
    Sun: [4, 5, 6],
  };
  const merged = { ...defaultOcc, ...occupancy };

  return {
    meta: {
      source: "test",
      source_rows: 0,
      forecast_weeks: [],
      dow: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      intervals: [],
      hours: [],
      lead_on_work_default: 0.2,
      total_bodies: agents.length,
      role_counts: { CSA: agents.length, NDS: 0, SDS: 0, Supervisor: 0 },
      phones_open: "24/7",
      cubicle_cap: 34,
    },
    shift_catalog: catalog,
    agents,
    cubicles: {
      cap: 34,
      occupancy_by_day_hour: merged,
    },
    pods: {},
    roles: {},
    volume: {} as Snapshot["volume"],
    supply: {} as Snapshot["supply"],
    coverage_hourly: {} as Snapshot["coverage_hourly"],
    supervisor_schedule: {} as Snapshot["supervisor_schedule"],
  };
}

describe("classifyScheduleShiftType", () => {
  const catalog = [
    catalogEntry({ shift_id: "AM_CORE", shift_class: "AM_CORE", gross_minutes: 510 }),
    catalogEntry({ shift_id: "SPLIT", shift_class: "SPLIT", gross_minutes: 720 }),
    catalogEntry({ shift_id: "SPLIT11", shift_class: "SPLIT", gross_minutes: 660 }),
    catalogEntry({ shift_id: "SUPER12", shift_class: "SUPER12", gross_minutes: 720 }),
    catalogEntry({ shift_id: "TWILIGHT", shift_class: "TWILIGHT", gross_minutes: 360 }),
    catalogEntry({ shift_id: "WKND_AM", shift_class: "WKND_AM", gross_minutes: 630 }),
  ];

  it("maps SPLIT by gross spread minutes", () => {
    expect(
      classifyScheduleShiftType(
        agent({ id: "a1", shift_id: "SPLIT", shift_class: "SPLIT" }),
        catalog.find((c) => c.shift_id === "SPLIT"),
      ),
    ).toBe("eightHourSplit12");
    expect(
      classifyScheduleShiftType(
        agent({ id: "a2", shift_id: "SPLIT11", shift_class: "SPLIT" }),
        catalog.find((c) => c.shift_id === "SPLIT11"),
      ),
    ).toBe("eightHourSplit11");
  });

  it("maps SUPER12 and TWILIGHT", () => {
    expect(
      classifyScheduleShiftType(
        agent({ id: "a3", shift_id: "SUPER12", shift_class: "SUPER12" }),
        catalog.find((c) => c.shift_id === "SUPER12"),
      ),
    ).toBe("twelveHour");
    expect(
      classifyScheduleShiftType(
        agent({ id: "a4", shift_id: "TWILIGHT", shift_class: "TWILIGHT" }),
        catalog.find((c) => c.shift_id === "TWILIGHT"),
      ),
    ).toBe("sixHourRegular");
  });

  it("maps 8-hour regular classes", () => {
    expect(
      classifyScheduleShiftType(
        agent({ id: "a5", shift_id: "AM_CORE", shift_class: "AM_CORE" }),
        catalog.find((c) => c.shift_id === "AM_CORE"),
      ),
    ).toBe("eightHourRegular");
  });

  it("maps 10-hour regular classes", () => {
    expect(
      classifyScheduleShiftType(
        agent({ id: "a6", shift_id: "WKND_AM", shift_class: "WKND_AM" }),
        catalog.find((c) => c.shift_id === "WKND_AM"),
      ),
    ).toBe("tenHourRegular");
  });
});

describe("weeklyPatternFromOffPair", () => {
  it("maps standard off pairs to pattern keys", () => {
    expect(weeklyPatternFromOffPair("Sat+Sun")).toBe("monFri");
    expect(weeklyPatternFromOffPair("Mon+Tue")).toBe("wedSun");
    expect(weeklyPatternFromOffPair("Sun+Mon")).toBe("tuesSat");
  });

  it("returns null for rotation", () => {
    expect(weeklyPatternFromOffPair("rotation")).toBeNull();
    expect(weeklyPatternFromOffPair(undefined)).toBeNull();
  });
});

describe("buildShiftScheduleSummary", () => {
  const catalog = [
    catalogEntry({ shift_id: "AM_CORE", shift_class: "AM_CORE" }),
    catalogEntry({ shift_id: "SPLIT", shift_class: "SPLIT", gross_minutes: 720 }),
    catalogEntry({ shift_id: "TWILIGHT", shift_class: "TWILIGHT", gross_minutes: 360 }),
  ];

  it("counts daily shifts per DOW and derives summary rows", () => {
    const agents = [
      agent({
        id: "c1",
        shift_id: "AM_CORE",
        shift_class: "AM_CORE",
        works_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        off_pair: "Sat+Sun",
      }),
      agent({
        id: "c2",
        shift_id: "SPLIT",
        shift_class: "SPLIT",
        works_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        off_pair: "Sat+Sun",
      }),
      agent({
        id: "c3",
        shift_id: "TWILIGHT",
        shift_class: "TWILIGHT",
        gross_hours: 6,
        works_days: ["Sat", "Sun"],
        off_pair: "Mon+Tue",
      }),
    ];

    const summary = buildShiftScheduleSummary(minimalSnapshot(agents, catalog));

    expect(summary.daily.byShiftType.eightHourRegular.Mon).toBe(1);
    expect(summary.daily.byShiftType.eightHourSplit12.Mon).toBe(1);
    expect(summary.daily.byShiftType.sixHourRegular.Sat).toBe(1);
    expect(summary.daily.summary.totalShifts.Mon).toBe(2);
    expect(summary.daily.summary.totalCubiclesRequired.Mon).toBe(14);
    expect(summary.daily.weekTotals.eightHourRegular).toBe(5);
    expect(summary.daily.activeShiftTypes).toEqual([
      "eightHourRegular",
      "eightHourSplit12",
      "sixHourRegular",
    ]);
  });

  it("groups weekly patterns and computes zero-safe percentages", () => {
    const agents = [
      agent({
        id: "c1",
        shift_id: "AM_CORE",
        shift_class: "AM_CORE",
        off_pair: "Sat+Sun",
      }),
      agent({
        id: "c2",
        shift_id: "AM_CORE",
        shift_class: "AM_CORE",
        off_pair: "Sat+Sun",
      }),
      agent({
        id: "c3",
        shift_id: "TWILIGHT",
        shift_class: "TWILIGHT",
        gross_hours: 6,
        off_pair: "Mon+Tue",
      }),
    ];

    const summary = buildShiftScheduleSummary(minimalSnapshot(agents, catalog));

    expect(summary.weeklyPatterns.byPattern.monFri.eightHourRegular).toBe(2);
    expect(summary.weeklyPatterns.byPattern.wedSun.sixHourRegular).toBe(1);
    expect(summary.weeklyPatterns.rowTotals.monFri).toBe(2);
    expect(summary.weeklyPatterns.activePatternRows.map((row) => row.key)).toEqual([
      "monFri",
      "wedSun",
    ]);
    expect(summary.weeklyPatterns.activeShiftTypes).toEqual(["eightHourRegular", "sixHourRegular"]);
  });

  it("excludes rotation off_pair from weekly pattern counts", () => {
    const agents = [
      agent({
        id: "sup1",
        role: "Supervisor",
        position: "Supervisor",
        shift_id: "SUP_DAY",
        shift_class: "SUPER12",
        off_pair: "rotation",
      }),
    ];
    const summary = buildShiftScheduleSummary(minimalSnapshot(agents, catalog));
    expect(summary.weeklyPatterns.grandTotal).toBe(0);
  });
});

describe("diffShiftScheduleSummaries", () => {
  const catalog = [catalogEntry({ shift_id: "AM_CORE", shift_class: "AM_CORE" })];

  it("computes per-cell deltas between baseline and proposed", () => {
    const baseline = buildShiftScheduleSummary(
      minimalSnapshot(
        [agent({ id: "c1", shift_id: "AM_CORE", shift_class: "AM_CORE", off_pair: "Sat+Sun" })],
        catalog,
      ),
    );
    const proposed = buildShiftScheduleSummary(
      minimalSnapshot(
        [
          agent({ id: "c1", shift_id: "AM_CORE", shift_class: "AM_CORE", off_pair: "Sat+Sun" }),
          agent({ id: "c2", shift_id: "AM_CORE", shift_class: "AM_CORE", off_pair: "Sat+Sun" }),
        ],
        catalog,
      ),
    );

    const diff = diffShiftScheduleSummaries(baseline, proposed);
    expect(diff.daily.byShiftType.eightHourRegular.Mon).toBe(1);
    expect(diff.daily.weekTotals.eightHourRegular).toBe(5);
    expect(diff.weeklyPatterns.byPattern.monFri.eightHourRegular).toBe(1);
  });
});
