import { describe, expect, it } from "vitest";
import { getShiftBidCategory, summarizeShiftBids } from "./shift-bid";
import type { ShiftCatalogEntry } from "@/lib/data/types";

function entry(
  overrides: Partial<ShiftCatalogEntry> & Pick<ShiftCatalogEntry, "shift_id">,
): ShiftCatalogEntry {
  return {
    label: overrides.shift_id,
    shift_class: "FT8",
    start_minute: 0,
    start_clock: "08:00",
    end_clock: "16:30",
    gross_minutes: 530,
    productive_minutes: 480,
    days: "Mon–Fri",
    rationale: "",
    segments: [],
    coverage_mask: [],
    ...overrides,
  };
}

describe("getShiftBidCategory", () => {
  it("maps template shift_class names to optimizer bid keys", () => {
    expect(getShiftBidCategory(entry({ shift_id: "FT8_00", shift_class: "FT8" }))).toBe(
      "eightHour",
    );
    expect(
      getShiftBidCategory(entry({ shift_id: "MID6_38", shift_class: "MID6", gross_minutes: 380 })),
    ).toBe("sixHour");
    expect(
      getShiftBidCategory(entry({ shift_id: "LT10_00", shift_class: "LT10", gross_minutes: 650 })),
    ).toBe("tenHour");
    expect(
      getShiftBidCategory(entry({ shift_id: "TWILIGHT", shift_class: "TWILIGHT", gross_minutes: 380 })),
    ).toBe("sixHour");
    expect(
      getShiftBidCategory(entry({ shift_id: "AM_CORE", shift_class: "AM_CORE", gross_minutes: 530 })),
    ).toBe("eightHour");
    expect(
      getShiftBidCategory(entry({ shift_id: "WKND_AM", shift_class: "WKND_AM", gross_minutes: 650 })),
    ).toBe("tenHour");
  });

  it("maps explicit split and 12-hour classes", () => {
    expect(
      getShiftBidCategory(entry({ shift_id: "SPLIT_01", shift_class: "SPLIT", gross_minutes: 530 })),
    ).toBe("splitShift");
    expect(
      getShiftBidCategory(entry({ shift_id: "SUPER12_01", shift_class: "SUPER12", gross_minutes: 770 })),
    ).toBe("twelveHour");
  });

  it("falls back to gross_minutes when shift_class is unknown", () => {
    expect(
      getShiftBidCategory(entry({ shift_id: "X1", shift_class: "CUSTOM", gross_minutes: 380 })),
    ).toBe("sixHour");
    expect(
      getShiftBidCategory(entry({ shift_id: "X2", shift_class: "CUSTOM", gross_minutes: 530 })),
    ).toBe("eightHour");
  });
});

describe("summarizeShiftBids", () => {
  it("counts only assigned templates and hides empty bid types", () => {
    const catalog = [
      entry({ shift_id: "AM_CORE", shift_class: "AM_CORE" }),
      entry({ shift_id: "TWILIGHT", shift_class: "TWILIGHT", gross_minutes: 380 }),
      entry({ shift_id: "WKND_AM", shift_class: "WKND_AM", gross_minutes: 650 }),
      entry({ shift_id: "EMPTY", shift_class: "MID", gross_minutes: 530 }),
    ];
    const assigned = {
      AM_CORE: [{}, {}, {}],
      TWILIGHT: [{}],
      WKND_AM: [{}, {}],
      EMPTY: [],
    };

    expect(summarizeShiftBids(catalog, assigned)).toEqual([
      { key: "eightHour", label: "8-hour", templateCount: 1, agentCount: 3 },
      { key: "sixHour", label: "6-hour", templateCount: 1, agentCount: 1 },
      { key: "tenHour", label: "10-hour", templateCount: 1, agentCount: 2 },
    ]);
  });
});
