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
  if (!structure.includes("|") && !structure.includes("Voice")) return [];
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

export function agentSupply(agents: Agent[], day: DOW, leadPct: number): number[] {
  const out = new Array(48).fill(0);
  for (const a of agents) {
    if (!a.works_days?.includes(day)) continue;
    const weight = a.position === "Lead" ? leadPct : 1;
    const mins = new Array(48).fill(0);
    for (const seg of parseSegs(a.structure)) {
      if (seg.kind !== "Voice") continue;
      for (let m = seg.start; m < seg.end; m++) {
        mins[Math.floor((m % 1440) / 30)]++;
      }
    }
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
