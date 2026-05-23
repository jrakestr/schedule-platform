// 1. Define the labels first. This acts as your single source of truth.
export const TAB_LABELS = {
  raci: "RACI Matrix",
  coverage: "Coverage",
  validation: "Validation",
  supervisor: "Supervisor",
  pods: "Pods",
  shifts: "Shifts",
  cubicles: "Cubicles",
  roster: "Roster",
  optimizer: "Simple Optimizer",
} as const;

// 2. Derive the TabId type directly from the keys of TAB_LABELS.
// This guarantees that any key added to TAB_LABELS is automatically a valid TabId.
export type TabId = keyof typeof TAB_LABELS;

// 3. Explicit tab order — RACI leads the narrative (roles → coverage).
export const TAB_IDS = [
  "raci",
  "coverage",
  "validation",
  "supervisor",
  "pods",
  "shifts",
  "cubicles",
  "roster",
  "optimizer",
] as const satisfies readonly TabId[];

/**
 * Type guard to check if a value is a valid TabId.
 * Performs an O(1) lookup against the TAB_LABELS map.
 */
export function isTabId(value: unknown): value is TabId {
  if (typeof value !== "string") {
    return false;
  }
  // O(1) property check is faster than Array.prototype.includes()
  return Object.prototype.hasOwnProperty.call(TAB_LABELS, value);
}
