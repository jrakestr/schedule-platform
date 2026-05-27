// supervisorsOnDuty uses assignment clock hours (not rigid 06:00-18:00 blocks).

import type {
  Agent,
  Assignment,
  SupervisorSchedule,
  Pod,
} from "@/lib/data/types";

function parseClockMinutes(clock: string): number {
  const [h, m] = clock.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** True when an assignment starting on weekday_idx covers target (day, hour). */
function assignmentCoversHour(
  assignment: Assignment,
  targetDayIdx: number,
  targetHour: number,
): boolean {
  const [startStr, endStr] = (assignment.hours || "06:00-18:00").split("-");
  const startMin = parseClockMinutes(startStr);
  const endMin = parseClockMinutes(endStr);
  const start = assignment.weekday_idx * 24 + startMin / 60;
  let end = assignment.weekday_idx * 24 + endMin / 60;
  if (endMin <= startMin) {
    end += 24;
  }
  const target = targetDayIdx * 24 + targetHour;
  return (
    (start <= target && target < end) ||
    (start <= target + 7 * 24 && target + 7 * 24 < end)
  );
}

export function supervisorsOnDuty(
  schedule: SupervisorSchedule,
  dayIdx: number,
  hour: number,
): string[] {
  const onDuty: string[] = [];
  for (const sup of schedule.supervisors) {
    for (const a of sup.assignments) {
      if (assignmentCoversHour(a, dayIdx, hour)) {
        onDuty.push(sup.id);
        break;
      }
    }
  }
  return onDuty;
}

const DOWS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const DOW_IDX: Record<string, number> = Object.fromEntries(
  DOWS.map((d, i) => [d, i]),
);

interface ContSegment {
  sm: number;
  em: number;
  kind: string;
}

function parseStructureContinuous(structure: string): ContSegment[] {
  const out: ContSegment[] = [];
  let prevEnd: number | null = null;
  for (const part of structure.split("|")) {
    const p = part.trim();
    if (!p) continue;
    const i = p.lastIndexOf(" ");
    if (i === -1) continue;
    const times = p.slice(0, i).trim();
    const kind = p.slice(i + 1).trim();
    const [a, b] = times.split("-");
    if (!a || !b) continue;
    const [ah, am] = a.split(":").map(Number);
    const [bh, bm] = b.split(":").map(Number);
    let sm = ah * 60 + am;
    let em = bh * 60 + bm;
    if (prevEnd !== null) {
      while (sm < prevEnd) {
        sm += 1440;
        em += 1440;
      }
    }
    if (em <= sm) em += 24 * 60;
    out.push({ sm, em, kind });
    prevEnd = em;
  }
  return out;
}

// Returns a 7 x 24 grid of CSA voice-minute totals per (dayIdx, hour). Sums
// minutes across all CSA agents and their works_days. Overnight wraps onto
// the calendar day where the minute actually lands.
export function csaVoiceMinutesGrid(agents: Agent[]): number[][] {
  const grid: number[][] = Array.from({ length: 7 }, () =>
    new Array(24).fill(0),
  );
  for (const agent of agents) {
    if (agent.role !== "CSA") continue;
    for (const day of agent.works_days || []) {
      const di = DOW_IDX[day];
      if (di === undefined) continue;
      for (const seg of parseStructureContinuous(agent.structure)) {
        if (seg.kind !== "Voice") continue;
        for (let minute = seg.sm; minute < seg.em; minute++) {
          const rotatedDay = (di + Math.floor(minute / 1440)) % 7;
          const hour = Math.floor((minute % 1440) / 60);
          grid[rotatedDay][hour] += 1;
        }
      }
    }
  }
  return grid;
}

export function supervisorPodMap(pods: Record<string, Pod>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, pod] of Object.entries(pods)) {
    out[pod.supervisor_id] = name;
  }
  return out;
}
