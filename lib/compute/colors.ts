/** Desert-themed pod palette — shared across charts and pod cards. */
export const POD_PALETTE = [
  "#f97316",
  "#d97706",
  "#ca8a04",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#16a34a",
  "#ea580c",
] as const;

export function podAccentColor(index: number): string {
  return POD_PALETTE[index % POD_PALETTE.length];
}

// Shift colors and tonal helpers. The HTML platform had a known emerald-vs-indigo
// legend/data mismatch on the Supervisor matrix; this Next.js port standardizes
// on a single indigo gradient for all heatmaps (Supervisor + Cubicles) with an
// explicit legend in the UI. cellTone is the canonical "share of peak" ramp.

import type { Agent } from "@/lib/data/types";

/** Canonical operational roles — single vocabulary across tabs, charts, and badges. */
export const OPERATIONAL_ROLES = [
  "Supervisor",
  "CSA Lead",
  "CSA",
  "NDS",
  "SDS Lead",
  "SDS",
] as const;

export type OperationalRole = (typeof OPERATIONAL_ROLES)[number];

/** Pod × Role matrix columns (Lead/Line split for CSA and SDS). */
export const POD_ROLE_KEYS = [
  "CSA Lead",
  "CSA Line",
  "NDS",
  "SDS Lead",
  "SDS Line",
] as const;

export type PodRoleKey = (typeof POD_ROLE_KEYS)[number];

export const ROLE_COLOR: Record<string, string> = {
  Supervisor: "#111827",
  "CSA Lead": "#d97706",
  CSA: "#16a34a",
  "CSA Line": "#16a34a",
  NDS: "#0284c7",
  "SDS Lead": "#db2777",
  SDS: "#7c3aed",
  "SDS Line": "#7c3aed",
};

/** Tailwind classes for role badges (light + dark). */
export const ROLE_BADGE_CLASS: Record<string, string> = {
  Supervisor:
    "bg-slate-500/10 text-slate-800 border-slate-200 dark:text-slate-200 dark:border-slate-700",
  "CSA Lead":
    "bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-300 dark:border-amber-800",
  CSA:
    "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-800",
  "CSA Line":
    "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-800",
  NDS:
    "bg-sky-500/10 text-sky-700 border-sky-200 dark:text-sky-300 dark:border-sky-800",
  "SDS Lead":
    "bg-rose-500/10 text-rose-700 border-rose-200 dark:text-rose-300 dark:border-rose-800",
  SDS:
    "bg-violet-500/10 text-violet-700 border-violet-200 dark:text-violet-300 dark:border-violet-800",
  "SDS Line":
    "bg-violet-500/10 text-violet-700 border-violet-200 dark:text-violet-300 dark:border-violet-800",
};

export function roleColor(role: string): string {
  return ROLE_COLOR[role] ?? "#64748b";
}

export function roleBadgeClass(role: string): string {
  return ROLE_BADGE_CLASS[role] ?? ROLE_BADGE_CLASS.CSA;
}

/** Display label for roster badges: CSA Lead, CSA, NDS, SDS Lead, SDS, Supervisor. */
export function agentOperationalRole(agent: Agent): OperationalRole | null {
  if (agent.role === "Supervisor") return "Supervisor";
  if (agent.role === "CSA") return agent.position === "Lead" ? "CSA Lead" : "CSA";
  if (agent.role === "SDS") return agent.position === "Lead" ? "SDS Lead" : "SDS";
  if (agent.role === "NDS") return "NDS";
  return null;
}

export function agentPodRoleKey(agent: Agent): PodRoleKey | null {
  if (agent.role === "CSA") return agent.position === "Lead" ? "CSA Lead" : "CSA Line";
  if (agent.role === "SDS") return agent.position === "Lead" ? "SDS Lead" : "SDS Line";
  if (agent.role === "NDS") return "NDS";
  return null;
}

export const SHIFT_COLOR: Record<string, string> = {
  OVERNIGHT: "#475569",
  EARLY: "#0891b2",
  AM_CORE: "#4f46e5",
  MID: "#7c3aed",
  PM_PEAK: "#c026d3",
  LATE: "#ea580c",
  TWILIGHT: "#dc2626",
  SUPER12: "#e11d48",
  SPLIT: "#0ea5e9",
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

/** Share of physical cubicle cap (34 seats) at which cells turn red. */
export const CUBICLE_NEAR_CAP_THRESHOLD = 0.85;

export function cubicleOccupancyRatio(value: number, cap: number): number {
  if (!value || !cap) return 0;
  return value / cap;
}

/** Heatmap cell classes — green (low) → amber (mid) → red (near cap). */
export function cubicleColor(value: number, cap: number): string {
  if (!value) {
    return "bg-slate-50 text-slate-300 dark:bg-slate-900 dark:text-slate-700";
  }
  const ratio = cubicleOccupancyRatio(value, cap);
  if (ratio >= CUBICLE_NEAR_CAP_THRESHOLD) {
    return "bg-red-600 text-white font-semibold";
  }
  if (ratio >= 0.75) {
    return "bg-amber-500 text-white font-semibold";
  }
  if (ratio >= 0.5) {
    return "bg-amber-200 text-amber-950 dark:bg-amber-900 dark:text-amber-100";
  }
  if (ratio >= 0.25) {
    return "bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100";
  }
  return "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";
}

/** Background-only ramp for mini occupancy bars. */
export function cubicleBarColor(value: number, cap: number): string {
  if (!value) return "bg-slate-200 dark:bg-slate-800";
  const ratio = cubicleOccupancyRatio(value, cap);
  if (ratio >= CUBICLE_NEAR_CAP_THRESHOLD) return "bg-red-600";
  if (ratio >= 0.75) return "bg-amber-500";
  if (ratio >= 0.5) return "bg-amber-300 dark:bg-amber-600";
  if (ratio >= 0.25) return "bg-emerald-400 dark:bg-emerald-600";
  return "bg-emerald-200 dark:bg-emerald-800";
}

/** Stat tile value tone keyed to occupancy vs cap. */
export function cubicleStatTone(value: number, cap: number): string {
  const ratio = cubicleOccupancyRatio(value, cap);
  if (ratio >= CUBICLE_NEAR_CAP_THRESHOLD) {
    return "text-red-700 dark:text-red-400";
  }
  if (ratio >= 0.75) {
    return "text-amber-700 dark:text-amber-400";
  }
  return "text-emerald-700 dark:text-emerald-400";
}

export const CUBICLE_LEGEND_STEPS = [
  { className: "bg-slate-50 border border-border dark:bg-slate-900", label: "0 (Empty)" },
  { className: "bg-emerald-50 dark:bg-emerald-950", label: "< 25% (Light)" },
  { className: "bg-emerald-200 dark:bg-emerald-900", label: "25% – 50%" },
  { className: "bg-amber-200 dark:bg-amber-900", label: "50% – 75%" },
  { className: "bg-amber-500", label: "75% – 85%" },
  { className: "bg-red-600", label: "≥ 85% (Near Cap)" },
] as const;
