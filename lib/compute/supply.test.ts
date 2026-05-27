import { describe, expect, it } from "vitest";
import { parseSegs, agentSupply } from "./supply";
import type { Agent } from "@/lib/data/types";

describe("parseSegs", () => {
  it("returns empty for falsy structure", () => {
    expect(parseSegs("")).toEqual([]);
    expect(parseSegs(null)).toEqual([]);
    expect(parseSegs(undefined)).toEqual([]);
  });

  it("parses a simple day shift", () => {
    const out = parseSegs(
      "08:00-10:00 Voice | 10:00-10:10 Break | 10:10-12:00 Voice",
    );
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({ start: 480, end: 600, kind: "Voice" });
    expect(out[1]).toEqual({ start: 600, end: 610, kind: "Break" });
    expect(out[2]).toEqual({ start: 610, end: 720, kind: "Voice" });
  });

  it("rolls overnight wrap-past-midnight forward by 24h", () => {
    const out = parseSegs("22:00-24:00 Voice | 00:00-02:00 Voice");
    expect(out[0]).toEqual({ start: 22 * 60, end: 24 * 60, kind: "Voice" });
    expect(out[1].start).toBe(24 * 60);
    expect(out[1].end).toBe(26 * 60);
  });

  it("handles a full overnight shift", () => {
    const out = parseSegs(
      "22:00-00:00 Voice | 00:00-02:00 Voice | 02:00-06:00 Voice",
    );
    expect(out.map((s) => [s.start, s.end])).toEqual([
      [1320, 1440],
      [1440, 1560],
      [1560, 1800],
    ]);
  });
});

describe("agentSupply", () => {
  const baseAgent: Agent = {
    id: "CSA_001",
    role: "CSA",
    position: "Line",
    shift_id: "AM_CORE_0800",
    shift_class: "AM_CORE",
    start_clock: "08:00",
    end_clock: "16:30",
    works_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    structure:
      "08:00-10:00 Voice | 10:00-10:10 Break | 10:10-12:00 Voice | 12:00-12:30 Lunch | 12:30-16:30 Voice",
  };

  it("counts voice intervals on a working day", () => {
    const supply = agentSupply([baseAgent], "Mon", 1);
    expect(supply).toHaveLength(48);
    // 08:00-10:00 = intervals 16,17,18,19 (each gets at least 15 voice minutes)
    expect(supply[16]).toBe(1);
    expect(supply[17]).toBe(1);
    // Break 10:00-10:10 means interval 20 only has voice 10:10-10:30 = 20 mins -> counts
    expect(supply[20]).toBe(1);
    // Lunch 12:00-12:30 means interval 24 has 0 voice -> stays at 0
    expect(supply[24]).toBe(0);
  });

  it("returns zero supply on off days", () => {
    const supply = agentSupply([baseAgent], "Sat", 1);
    expect(supply.every((v) => v === 0)).toBe(true);
  });

  it("weights Lead agents by leadPct", () => {
    const lead: Agent = { ...baseAgent, id: "CSA_Lead_001", position: "Lead" };
    const supply = agentSupply([lead], "Mon", 0.6);
    expect(supply[16]).toBeCloseTo(0.6, 5);
  });

  it("attributes overnight post-midnight minutes to the next calendar day", () => {
    // Mon-starting agent with a 22:00-02:00 Voice shift. The 00:00–02:00
    // portion belongs to Tuesday, NOT Monday — sibling getAgentsOnDuty has
    // always rotated this correctly, agentSupply was the outlier.
    const overnight: Agent = {
      ...baseAgent,
      id: "CSA_Overnight_001",
      shift_id: "PM_OVERNIGHT_2200",
      shift_class: "PM_OVERNIGHT",
      start_clock: "22:00",
      end_clock: "02:00",
      works_days: ["Mon"],
      structure: "22:00-02:00 Voice",
    };

    const monSupply = agentSupply([overnight], "Mon", 1);
    const tueSupply = agentSupply([overnight], "Tue", 1);

    // Mon evening 22:00–24:00 = intervals 44..47 should each register 1
    expect(monSupply[44]).toBe(1);
    expect(monSupply[47]).toBe(1);
    // Mon early-morning 00:00–02:00 = intervals 0..3 should be ZERO — the
    // agent isn't on duty Mon early-morning, they're on duty TUE early-morning.
    expect(monSupply[0]).toBe(0);
    expect(monSupply[3]).toBe(0);
    // Tue intervals 0..3 should each register 1 (rotated from the Mon start)
    expect(tueSupply[0]).toBe(1);
    expect(tueSupply[3]).toBe(1);
  });
});

describe("parseSegs regressions", () => {
  it("parses a single-segment structure regardless of kind label", () => {
    // Prior bug: a substring guard returned [] for any single-segment
    // structure that didn't literally contain the word 'Voice', silently
    // dropping otherwise-valid shifts.
    expect(parseSegs("08:00-16:00 phones")).toEqual([
      { start: 480, end: 960, kind: "phones" },
    ]);
    expect(parseSegs("08:00-16:00 Break")).toEqual([
      { start: 480, end: 960, kind: "Break" },
    ]);
  });
});
