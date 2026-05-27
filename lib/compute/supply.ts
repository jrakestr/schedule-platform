// Ports of parseSegs / agentSupply / csaSupply from
// output/schedule-review-platform/index.html (lines 48-89). The wall-clock
// segment continuity rule (roll wrapped segments forward by 24h) is essential
// for overnight shifts to attribute their post-midnight time to the correct
// calendar day. Do not "simplify" this without preserving that behavior.

import type { Agent, DOW } from "@/lib/data/types";

export interface ParsedSegment {
  start: number;
  end: number;
  kind: string;
}

export function parseSegs(structure: string | null | undefined): ParsedSegment[] {
  if (!structure) return [];
  const toMin = (t: string): number => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const out: ParsedSegment[] = [];
  let prevEnd: number | null = null;
  for (const raw of structure.split("|")) {
    const s = raw.trim();
    if (!s) continue;
    const spaceIdx = s.lastIndexOf(" ");
    if (spaceIdx === -1) continue;
    const range = s.slice(0, spaceIdx).trim();
    const kind = s.slice(spaceIdx + 1).trim();
    const [a, b] = range.split("-");
    if (!a || !b) continue;
    let start = toMin(a);
    let end = toMin(b);
    if (prevEnd !== null) {
      while (start < prevEnd) {
        start += 1440;
        end += 1440;
      }
    }
    if (end <= start) end += 1440;
    out.push({ start, end, kind });
    prevEnd = end;
  }
  return out;
}

const DOW_IDX: Record<DOW, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

function clockToMinutes(clock: string): number {
  const [h, m] = clock.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Split gross legacy shift spans into Voice segments (30-min lunch when ≥ 6.5h). */
function legacyAssignmentVoiceSpans(
  startMin: number,
  endMin: number,
): Array<{ start: number; end: number }> {
  if (endMin <= startMin) endMin += 1440;
  const duration = endMin - startMin;
  if (duration < 390) return [{ start: startMin, end: endMin }];
  const lunchStart = startMin + Math.floor((duration - 30) / 2);
  return [
    { start: startMin, end: lunchStart },
    { start: lunchStart + 30, end: endMin },
  ];
}

function accumulateVoiceMinutes(
  mins: number[],
  targetDayIdx: number,
  startDayIdx: number,
  startMin: number,
  endMin: number,
): void {
  if (endMin <= startMin) endMin += 1440;
  for (let m = startMin; m < endMin; m++) {
    const rotated = (startDayIdx + Math.floor(m / 1440)) % 7;
    if (rotated !== targetDayIdx) continue;
    mins[Math.floor((m % 1440) / 30)]++;
  }
}

/** Voice minutes per 30-min interval for one agent on one calendar day. */
export function agentVoiceMinutesPerInterval(agent: Agent, day: DOW): number[] {
  const mins = new Array(48).fill(0);
  const targetDayIdx = DOW_IDX[day];

  if (agent.assignments?.length && agent.structure === "legacy") {
    for (const assignment of agent.assignments) {
      const [startClock, endClock] = assignment.hours.split("-");
      if (!startClock || !endClock) continue;
      const startMin = clockToMinutes(startClock);
      const endMin = clockToMinutes(endClock);
      for (const span of legacyAssignmentVoiceSpans(startMin, endMin)) {
        accumulateVoiceMinutes(
          mins,
          targetDayIdx,
          assignment.weekday_idx,
          span.start,
          span.end,
        );
      }
    }
    return mins;
  }

  const startDays = agent.works_days ?? [];
  for (const startDay of startDays) {
    const startDayIdx = DOW_IDX[startDay];
    if (startDayIdx === undefined) continue;
    for (const seg of parseSegs(agent.structure)) {
      if (seg.kind !== "Voice") continue;
      accumulateVoiceMinutes(mins, targetDayIdx, startDayIdx, seg.start, seg.end);
    }
  }
  return mins;
}

export function agentSupply(agents: Agent[], day: DOW, leadPct: number): number[] {
  const out = new Array(48).fill(0);
  for (const a of agents) {
    const startDays = a.works_days ?? [];
    const hasLegacyAssignments =
      a.assignments?.length && a.structure === "legacy";
    if (!hasLegacyAssignments && startDays.length === 0) continue;
    const weight = a.position === "Lead" ? leadPct : 1;
    const mins = agentVoiceMinutesPerInterval(a, day);
    mins.forEach((v: number, i: number) => {
      if (v >= 15) out[i] += weight;
    });
  }
  return out;
}

export function getCSA(agents: Agent[]): Agent[] {
  return agents.filter((a) => a.role === "CSA");
}

export function getSched(agents: Agent[]): Agent[] {
  return agents.filter((a) => a.role === "NDS" || a.role === "SDS");
}

export function csaSupply(agents: Agent[], day: DOW, leadPct: number): number[] {
  return agentSupply(getCSA(agents), day, leadPct);
}

export function schedulerSupply(agents: Agent[], day: DOW): number[] {
  return agentSupply(getSched(agents), day, 1);
}

export function getManualRoster(agents: Agent[]): Agent[] {
  return agents.filter(
    (a) => a.role === "NDS" || a.role === "SDS" || a.role === "Supervisor",
  );
}

/** Combined supply for SDS + Next Day + Supervisor — the manually-managed
 * roster. Overlaid on Coverage / Validation charts alongside the CSA
 * optimized curve. */
export function manualRosterSupply(agents: Agent[], day: DOW): number[] {
  return agentSupply(getManualRoster(agents), day, 1);
}

export function hourlyFromHalfHours(a: number[]): number[] {
  return Array.from({ length: 24 }, (_, h) =>
    Number((a[h * 2] + a[h * 2 + 1]).toFixed(2)),
  );
}

export interface AgentOnDutyInfo {
  agent: Agent;
  voiceMinutes: number;
}

export function getAgentsOnDuty(
  agents: Agent[],
  targetDay: DOW,
  targetHour: number,
): AgentOnDutyInfo[] {
  const dowIdx: Record<DOW, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const targetDayIdx = dowIdx[targetDay];
  const out: AgentOnDutyInfo[] = [];

  for (const agent of agents) {
    if (agent.role === "Supervisor") continue;
    let voiceMinutes = 0;
    for (const day of agent.works_days || []) {
      const di = dowIdx[day];
      if (di === undefined) continue;
      for (const seg of parseSegs(agent.structure)) {
        if (seg.kind !== "Voice") continue;
        for (let minute = seg.start; minute < seg.end; minute++) {
          const rotatedDayIdx = (di + Math.floor(minute / 1440)) % 7;
          const hr = Math.floor((minute % 1440) / 60);
          if (rotatedDayIdx === targetDayIdx && hr === targetHour) {
            voiceMinutes++;
          }
        }
      }
    }
    if (voiceMinutes > 0) {
      out.push({ agent, voiceMinutes });
    }
  }

  return out.sort(
    (a, b) =>
      b.voiceMinutes - a.voiceMinutes || a.agent.id.localeCompare(b.agent.id),
  );
}
