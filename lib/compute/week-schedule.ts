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

export type WeekSortKey = "name" | "hours" | "shift";

export function sortAgentsInPod(
  agents: Agent[],
  sortKey: WeekSortKey,
  desc: boolean,
): Agent[] {
  const mul = desc ? -1 : 1;
  return [...agents].sort((a, b) => {
    if (sortKey === "name") {
      const la = (a.name?.trim() || a.id).toLowerCase();
      const lb = (b.name?.trim() || b.id).toLowerCase();
      return la.localeCompare(lb) * mul;
    }
    if (sortKey === "hours") {
      const ha = a.effective_hours_per_week ?? 0;
      const hb = b.effective_hours_per_week ?? 0;
      return (ha - hb) * mul;
    }
    return a.shift_id.localeCompare(b.shift_id) * mul;
  });
}

export { DOW_LIST, DOW_TO_IDX };
