// Shift colors and tonal helpers. The HTML platform had a known emerald-vs-indigo
// legend/data mismatch on the Supervisor matrix; this Next.js port standardizes
// on a single indigo gradient for all heatmaps (Supervisor + Cubicles) with an
// explicit legend in the UI. cellTone is the canonical "share of peak" ramp.

import type { Agent } from "@/lib/data/types";

export const SHIFT_COLOR: Record<string, string> = {
  OVERNIGHT: "#475569",
  EARLY: "#0891b2",
  AM_CORE: "#4f46e5",
  MID: "#7c3aed",
  PM_PEAK: "#c026d3",
  LATE: "#ea580c",
  TWILIGHT: "#dc2626",
  WKND_AM: "#16a34a",
  WKND_PM: "#65a30d",
  SUPERVISOR: "#111827",
};

export function shiftColor(id: string | undefined | null): string {
  if (!id) return "#64748b";
  if (SHIFT_COLOR[id]) return SHIFT_COLOR[id];
  for (const base of Object.keys(SHIFT_COLOR)) {
    if (id.startsWith(base + "_")) return SHIFT_COLOR[base];
  }
  return "#64748b";
}

export function shiftColorForAgent(agent: Agent): string {
  return SHIFT_COLOR[agent.shift_class] ?? shiftColor(agent.shift_id);
}

export function toneClass(v: number): string {
  if (v >= 0.8) return "text-emerald-700 dark:text-emerald-400";
  if (v >= 0.6) return "text-amber-700 dark:text-amber-400";
  return "text-rose-700 dark:text-rose-400";
}

export interface BalanceTone {
  label: "Balanced" | "Acceptable" | "Over-served" | "Under-served";
  cls: string;
}

export function balanceTone(ratio: number): BalanceTone {
  if (ratio >= 0.85 && ratio <= 1.15) {
    return {
      label: "Balanced",
      cls: "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950",
    };
  }
  if (ratio >= 0.6 && ratio <= 1.4) {
    return {
      label: "Acceptable",
      cls: "text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950",
    };
  }
  if (ratio > 1.4) {
    return {
      label: "Over-served",
      cls: "text-indigo-700 bg-indigo-50 dark:text-indigo-300 dark:bg-indigo-950",
    };
  }
  return {
    label: "Under-served",
    cls: "text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-950",
  };
}

// Single indigo gradient cell tone for heatmaps. Replaces the prior mix of
// indigo (data) + emerald (legend) which AGENTS.md flagged as misleading.
export function cellTone(value: number, max: number): string {
  if (!value) return "bg-slate-50 text-slate-300 dark:bg-slate-900 dark:text-slate-700";
  const ratio = max ? value / max : 0;
  if (ratio >= 0.75)
    return "bg-indigo-600 text-white font-semibold";
  if (ratio >= 0.5)
    return "bg-indigo-400 text-white font-semibold";
  if (ratio >= 0.25)
    return "bg-indigo-200 text-indigo-900 dark:bg-indigo-900 dark:text-indigo-100";
  return "bg-indigo-50 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200";
}

// Cubicle occupancy color ramp (0-100% of cap). Single hue family, three
// thresholds so people know when they're approaching capacity.
export function cubicleColor(pct: number): string {
  if (pct >= 0.95) return "bg-rose-200 text-rose-900 dark:bg-rose-950 dark:text-rose-100";
  if (pct >= 0.8) return "bg-amber-200 text-amber-900 dark:bg-amber-950 dark:text-amber-100";
  if (pct > 0) return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100";
  return "bg-slate-50 text-slate-400 dark:bg-slate-900 dark:text-slate-600";
}
