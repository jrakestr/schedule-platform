import { coverageRatio } from "@/lib/compute/coverage";
import { DOW_LIST, type Agent, type DOW, type ShiftCatalogEntry, type Snapshot } from "@/lib/data/types";

export interface ScenarioMetrics {
  totalCost: number;
  totalHours: number;
  weightedCoveragePct: number;
  totalBodies: number;
  twelveHourCount: number;
  splitShiftCount: number;
  peakCubicles: number;
}

export interface AgentAssignmentChange {
  agentId: string;
  agentName: string;
  role: Agent["role"];
  baselineShiftId: string;
  proposedShiftId: string;
  baselineShiftLabel: string;
  proposedShiftLabel: string;
  baselineWorksDays: DOW[];
  proposedWorksDays: DOW[];
  shiftChanged: boolean;
  daysChanged: boolean;
}

export interface OptimizationComparison {
  baseline: ScenarioMetrics;
  proposed: ScenarioMetrics;
  agentChanges: AgentAssignmentChange[];
}

function agentWeeklyCost(agent: Agent): number {
  let rate = 18;
  if (agent.role === "Supervisor") rate = 28;
  else if (agent.role === "CSA" && agent.position === "Lead") rate = 22;
  else if (agent.role === "SDS") {
    rate = agent.position === "Lead" ? 24 : 20;
  } else if (agent.role === "NDS") {
    rate = 20;
  }

  const hoursPerWeek = Number(
    agent.effective_hours_per_week ??
      (agent.gross_hours ? (agent.gross_hours || 8) * 5 : 40),
  );

  let weeklyCost = hoursPerWeek * rate;
  return weeklyCost;
}

function agentWeeklyHours(agent: Agent): number {
  return Number(
    agent.effective_hours_per_week ??
      (agent.gross_hours ? (agent.gross_hours || 8) * 5 : 40),
  );
}

function worksDaysKey(days: DOW[]): string {
  return [...days].sort().join(",");
}

function shiftLabel(
  shiftId: string,
  catalog: ShiftCatalogEntry[],
  agent?: Agent,
): string {
  const entry = catalog.find((s) => s.shift_id === shiftId);
  if (entry?.label) return entry.label;
  if (agent?.shift_name) return agent.shift_name;
  return shiftId || "—";
}

export function computeScenarioMetrics(
  snapshot: Snapshot,
  leadPct: number,
): ScenarioMetrics {
  const agents = snapshot.agents ?? [];
  let totalCost = 0;
  let totalHours = 0;
  let twelveHourCount = 0;
  let splitShiftCount = 0;
  let peakCubicles = 0;

  for (const agent of agents) {
    totalCost += agentWeeklyCost(agent);
    totalHours += agentWeeklyHours(agent);

    const shiftId = agent.shift_id || "";
    if (shiftId.startsWith("SUPER12") || shiftId.includes("SUPER12")) {
      twelveHourCount++;
    }
    if (shiftId.startsWith("SPLIT") || shiftId.includes("SPLIT")) {
      splitShiftCount++;
    }
  }

  const occ = snapshot.cubicles?.occupancy_by_day_hour ?? {};
  for (const d of DOW_LIST) {
    for (const hVal of occ[d] ?? []) {
      if (hVal > peakCubicles) peakCubicles = hVal;
    }
  }

  return {
    totalCost,
    totalHours,
    weightedCoveragePct: (coverageRatio(snapshot, leadPct) ?? 0) * 100,
    totalBodies: snapshot.meta?.total_bodies ?? agents.length,
    twelveHourCount,
    splitShiftCount,
    peakCubicles,
  };
}

export function diffAgentAssignments(
  baselineAgents: Agent[],
  proposedAgents: Agent[],
  catalog: ShiftCatalogEntry[],
): AgentAssignmentChange[] {
  const proposedById = new Map(proposedAgents.map((a) => [a.id, a]));
  const changes: AgentAssignmentChange[] = [];

  for (const baseline of baselineAgents) {
    const proposed = proposedById.get(baseline.id);
    if (!proposed) continue;

    const baselineDays = baseline.works_days ?? [];
    const proposedDays = proposed.works_days ?? [];
    const shiftChanged = (baseline.shift_id || "") !== (proposed.shift_id || "");
    const daysChanged = worksDaysKey(baselineDays) !== worksDaysKey(proposedDays);

    if (!shiftChanged && !daysChanged) continue;

    changes.push({
      agentId: baseline.id,
      agentName: proposed.name ?? baseline.name ?? baseline.id,
      role: baseline.role,
      baselineShiftId: baseline.shift_id || "—",
      proposedShiftId: proposed.shift_id || "—",
      baselineShiftLabel: shiftLabel(baseline.shift_id, catalog, baseline),
      proposedShiftLabel: shiftLabel(proposed.shift_id, catalog, proposed),
      baselineWorksDays: baselineDays,
      proposedWorksDays: proposedDays,
      shiftChanged,
      daysChanged,
    });
  }

  return changes.sort((a, b) => a.agentName.localeCompare(b.agentName));
}

export function compareOptimizations(
  baseline: Snapshot,
  proposed: Snapshot,
  leadPct: number,
): OptimizationComparison {
  return {
    baseline: computeScenarioMetrics(baseline, leadPct),
    proposed: computeScenarioMetrics(proposed, leadPct),
    agentChanges: diffAgentAssignments(
      baseline.agents ?? [],
      proposed.agents ?? [],
      baseline.shift_catalog ?? proposed.shift_catalog ?? [],
    ),
  };
}
