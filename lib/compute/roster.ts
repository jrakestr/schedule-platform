// Port of rosterRowsFor() from the HTML platform. Supervisors expand to one
// row per scheduled assignment (DAY/NIGHT with concrete hours); all others
// collapse to one row.

import type { Agent, Pod, SupervisorSchedule } from "@/lib/data/types";
import { supervisorPodMap } from "@/lib/compute/supervisors";

export interface RosterRow {
  key: string;
  id: string;
  role: string;
  position: string;
  shift: string;
  start: string;
  end: string;
  day_label: string;
  pod: string;
  reports_to: string;
  hours: number | string;
  isContinuation?: boolean;
  supervisorId?: string;
}

export function rosterRowsFor(
  agent: Agent,
  pods: Record<string, Pod>,
  schedule: SupervisorSchedule,
): RosterRow[] {
  if (agent.role !== "Supervisor") {
    const podEntry = Object.entries(pods).find(([, p]) =>
      p.members.includes(agent.id),
    );
    return [
      {
        key: agent.id,
        id: agent.id,
        role: agent.role,
        position: agent.position,
        shift: agent.shift_id,
        start: agent.start_clock,
        end: agent.end_clock,
        day_label: (agent.works_days || []).join(", "),
        pod: podEntry ? podEntry[0] : "—",
        reports_to: podEntry ? pods[podEntry[0]].supervisor_id : "—",
        hours: agent.effective_hours_per_week ?? "",
      },
    ];
  }

  const supToPod = supervisorPodMap(pods);
  const sched = schedule.supervisors.find((s) => s.id === agent.id);
  if (!sched || !sched.assignments || !sched.assignments.length) {
    return [
      {
        key: agent.id,
        id: agent.id,
        role: agent.role,
        position: agent.position,
        shift: agent.shift_id,
        start: "—",
        end: "—",
        day_label: "—",
        pod: supToPod[agent.id] ?? "—",
        reports_to: "Operations",
        hours: agent.effective_hours_per_week ?? "",
      },
    ];
  }
  return sched.assignments.map((a, i) => {
    const [start, end] = (a.hours || "06:00-18:00").split("-");
    return {
      key: `${agent.id}-${a.weekday_idx}-${a.shift_type}`,
      id: i === 0 ? agent.id : "",
      role: i === 0 ? "Supervisor" : "",
      position: i === 0 ? "Supervisor" : "",
      shift: a.shift_type,
      start,
      end,
      day_label: a.weekday.slice(0, 3),
      pod: supToPod[agent.id] ?? "—",
      reports_to: "Operations",
      hours: i === 0 ? agent.effective_hours_per_week ?? "" : "",
      isContinuation: i > 0,
      supervisorId: agent.id,
    };
  });
}
