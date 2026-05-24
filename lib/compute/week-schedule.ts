import type { Agent, DOW, SupervisorSchedule } from "@/lib/data/types";
import { DOW_LIST } from "@/lib/data/types";

const DOW_TO_IDX: Record<DOW, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

export interface DayShiftCell {
  kind: "off" | "shift";
  agentId: string;
  startClock?: string;
  endClock?: string;
  shiftId?: string;
  shiftClass?: string;
  /** Supervisor DAY/NIGHT label when applicable. */
  shiftLabel?: string;
}

function parseAssignmentHours(hours: string): { startClock: string; endClock: string } {
  const [startClock, endClock] = (hours || "06:00-18:00").split("-");
  return { startClock, endClock };
}

/** Per-day schedule from agent.assignments (supervisors) or fixed shift template. */
export function resolveAgentDayCell(agent: Agent, day: DOW): DayShiftCell {
  const dayIdx = DOW_TO_IDX[day];
  const assignment = agent.assignments?.find((a) => a.weekday_idx === dayIdx);

  if (assignment) {
    const { startClock, endClock } = parseAssignmentHours(assignment.hours);
    return {
      kind: "shift",
      agentId: agent.id,
      startClock,
      endClock,
      shiftId: assignment.shift_type,
      shiftClass: agent.shift_class,
      shiftLabel: assignment.shift_type,
    };
  }

  if (agent.assignments?.length) {
    return { kind: "off", agentId: agent.id };
  }

  if (!agent.works_days?.includes(day)) {
    return { kind: "off", agentId: agent.id };
  }

  return {
    kind: "shift",
    agentId: agent.id,
    startClock: agent.start_clock,
    endClock: agent.end_clock,
    shiftId: agent.shift_id,
    shiftClass: agent.shift_class,
    shiftLabel: agent.shift_class,
  };
}

export function weekStripHeaderClock(agent: Agent): string {
  if (agent.assignments?.length) {
    return "Rotation";
  }
  if (agent.start_clock === "varies" || agent.end_clock === "varies") {
    return "Rotation";
  }
  return `${agent.start_clock}–${agent.end_clock}`;
}

export function resolveDayCell(
  agent: Agent,
  day: DOW,
  schedule: SupervisorSchedule,
): DayShiftCell {
  if (agent.role === "Supervisor") {
    const sup = schedule.supervisors.find((s) => s.id === agent.id);
    const dayIdx = DOW_TO_IDX[day];
    const assignment = sup?.assignments?.find((a) => a.weekday_idx === dayIdx);
    if (!assignment) {
      return { kind: "off", agentId: agent.id };
    }
    const { startClock, endClock } = parseAssignmentHours(assignment.hours);
    return {
      kind: "shift",
      agentId: agent.id,
      startClock,
      endClock,
      shiftId: assignment.shift_type,
      shiftClass: "SUPERVISOR",
      shiftLabel: assignment.shift_type,
    };
  }

  return resolveAgentDayCell(agent, day);
}

export function agentsWorkingOnDay(agents: Agent[], day: DOW): Agent[] {
  return agents.filter((a) => {
    if (a.role === "Supervisor") return false;
    return a.works_days?.includes(day) ?? false;
  });
}

export function podNamesOrdered(pods: Record<string, unknown>): string[] {
  return Object.keys(pods).sort((a, b) => {
    const na = Number(a.replace(/\D/g, "")) || 0;
    const nb = Number(b.replace(/\D/g, "")) || 0;
    return na - nb || a.localeCompare(b);
  });
}

export type WeekSortKey = "name" | "start" | "shift" | "hours";
export type WeekGroupMode = "flat" | "team";

function agentStartSortKey(agent: Agent): string {
  if (agent.start_clock && agent.start_clock !== "varies") {
    return agent.start_clock;
  }
  return agent.shift_id;
}

export function sortScheduleAgents<T extends Agent>(
  agents: T[],
  sortKey: WeekSortKey,
  desc: boolean,
): T[] {
  const mul = desc ? -1 : 1;
  return [...agents].sort((a, b) => {
    if (sortKey === "name") {
      const la = (a.name?.trim() || a.id).toLowerCase();
      const lb = (b.name?.trim() || b.id).toLowerCase();
      return la.localeCompare(lb) * mul;
    }
    if (sortKey === "start") {
      return agentStartSortKey(a).localeCompare(agentStartSortKey(b)) * mul;
    }
    if (sortKey === "hours") {
      const ha = a.effective_hours_per_week ?? 0;
      const hb = b.effective_hours_per_week ?? 0;
      return (ha - hb) * mul;
    }
    return a.shift_id.localeCompare(b.shift_id) * mul;
  });
}

/** @deprecated Use sortScheduleAgents */
export function sortAgentsInPod<T extends Agent>(
  agents: T[],
  sortKey: WeekSortKey,
  desc: boolean,
): T[] {
  return sortScheduleAgents(agents, sortKey, desc);
}

export function agentMatchesScheduleFilters(
  agent: Agent,
  roleFilter: string,
  positionFilter: string,
): boolean {
  const matchesRole = roleFilter === "All" || agent.role === roleFilter;
  const matchesPosition =
    positionFilter === "All" || agent.position === positionFilter;
  return matchesRole && matchesPosition;
}

export function collectFlatScheduleAgents(
  snapshot: { agents: Agent[] },
  roleFilter: string,
  positionFilter: string,
  sortKey: WeekSortKey,
  sortDesc: boolean,
): Agent[] {
  return sortScheduleAgents(
    snapshot.agents.filter((agent) =>
      agentMatchesScheduleFilters(agent, roleFilter, positionFilter),
    ),
    sortKey,
    sortDesc,
  );
}

/** Supervisors in Team 1→6 pod order (Sup_01 … Sup_06) for top-of-chart cascade. */
export function collectSupervisorsOrdered(
  snapshot: {
    agents: Agent[];
    pods: Record<string, { supervisor_id: string }>;
  },
  roleFilter: string,
  positionFilter: string,
  sortKey: WeekSortKey = "name",
  sortDesc = false,
): Agent[] {
  if (roleFilter !== "All" && roleFilter !== "Supervisor") {
    return [];
  }

  const agentById = new Map(snapshot.agents.map((a) => [a.id, a]));
  const fromPods = podNamesOrdered(snapshot.pods)
    .map((name) => snapshot.pods[name]?.supervisor_id)
    .map((id) => (id ? agentById.get(id) : undefined))
    .filter((a): a is Agent => !!a)
    .filter((a) => agentMatchesScheduleFilters(a, roleFilter, positionFilter));

  const sups =
    fromPods.length > 0
      ? fromPods
      : snapshot.agents
          .filter((a) => a.role === "Supervisor")
          .filter((a) => agentMatchesScheduleFilters(a, roleFilter, positionFilter))
          .sort((a, b) => a.id.localeCompare(b.id));

  if (sortKey === "name" && !sortDesc) {
    return sups;
  }
  return sortScheduleAgents(sups, sortKey, sortDesc);
}

export function collectFlatScheduleAgentsBelowSupervisors(
  snapshot: { agents: Agent[] },
  roleFilter: string,
  positionFilter: string,
  sortKey: WeekSortKey,
  sortDesc: boolean,
): Agent[] {
  return sortScheduleAgents(
    snapshot.agents.filter(
      (agent) =>
        agent.role !== "Supervisor" &&
        agentMatchesScheduleFilters(agent, roleFilter, positionFilter),
    ),
    sortKey,
    sortDesc,
  );
}

export { DOW_LIST, DOW_TO_IDX };
