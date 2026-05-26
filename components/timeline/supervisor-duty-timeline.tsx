"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { AgentLink } from "@/components/agent/agent-link";
import { TeamLink } from "@/components/team/team-link";
import { podAccentColor, shiftColorForAgent } from "@/lib/compute/colors";
import { supervisorsOnDuty } from "@/lib/compute/supervisors";
import { DOW_TO_IDX, resolveDayCell } from "@/lib/compute/week-schedule";
import { cn } from "@/lib/utils";
import type { Agent, Assignment, DOW, Snapshot } from "@/lib/data/types";

const LABEL_W = 168;
const HOUR_W = 44;
const ROW_H = 30;
const MEMBER_ROW_H = 20;

const SUP_SHIFT_COLOR: Record<string, string> = {
  DAY: "#0891b2",
  EARLY: "#0d9488",
  LATE: "#6366f1",
  NIGHT: "#475569",
};

interface DutyBar {
  start: number;
  end: number;
  shiftType: string;
  hours: string;
}

interface SupervisorDutyTimelineProps {
  snapshot: Snapshot;
  day: DOW;
  className?: string;
}

function parseClock(clock: string): number {
  const [h, m] = clock.split(":").map(Number);
  return h * 60 + (m || 0);
}

function assignmentBars(assignment: Assignment): DutyBar[] {
  const [startStr, endStr] = (assignment.hours || "06:00-18:00").split("-");
  const start = parseClock(startStr);
  const endRaw = parseClock(endStr);
  const hours = assignment.hours;
  const shiftType = assignment.shift_type;

  if (endRaw <= start) {
    return [
      { start, end: 24 * 60, shiftType, hours },
      { start: 0, end: endRaw, shiftType, hours },
    ];
  }
  return [{ start, end: endRaw, shiftType, hours }];
}

function clockBars(startClock: string, endClock: string): Array<{ start: number; end: number }> {
  const start = parseClock(startClock);
  const endRaw = parseClock(endClock);
  if (endRaw <= start) {
    return [
      { start, end: 24 * 60 },
      { start: 0, end: endRaw },
    ];
  }
  return [{ start, end: endRaw }];
}

function formatMin(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timeX(min: number): number {
  return (min / 60) * HOUR_W;
}

function DutyBarTrack({
  bars,
  rowHeight = ROW_H,
}: {
  bars: Array<{
    start: number;
    end: number;
    color: string;
    tooltip: string;
  }>;
  rowHeight?: number;
}) {
  const trackW = 24 * HOUR_W;

  return (
    <div
      className="relative shrink-0 bg-muted/15"
      style={{ width: trackW, height: rowHeight }}
    >
      {bars.map((bar, idx) => {
        const left = timeX(bar.start);
        const width = Math.max(2, timeX(bar.end) - left);
        return (
          <div
            key={`${bar.start}-${bar.end}-${idx}`}
            className="absolute top-1 bottom-1 rounded-sm"
            style={{
              left,
              width,
              backgroundColor: bar.color,
              opacity: 0.92,
            }}
            title={bar.tooltip}
          />
        );
      })}
    </div>
  );
}

/** Intraday Gantt for supervisor on-duty windows (Sup_01–Sup_06). */
export function SupervisorDutyTimeline({
  snapshot,
  day,
  className,
}: SupervisorDutyTimelineProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const dayIdx = DOW_TO_IDX[day];
  const sched = snapshot.supervisor_schedule;
  const trackW = 24 * HOUR_W;
  const totalW = LABEL_W + trackW;

  const podsBySupervisor = useMemo(() => {
    const acc: Record<string, string[]> = {};
    for (const [podName, pod] of Object.entries(snapshot.pods)) {
      acc[pod.supervisor_id] = acc[pod.supervisor_id] ?? [];
      acc[pod.supervisor_id].push(podName);
    }
    for (const ids of Object.values(acc)) {
      ids.sort((a, b) => a.localeCompare(b));
    }
    return acc;
  }, [snapshot.pods]);

  const agentById = useMemo(
    () => new Map(snapshot.agents.map((a) => [a.id, a])),
    [snapshot.agents],
  );

  const supervisors = useMemo(
    () =>
      [...sched.supervisors].sort((a, b) => a.id.localeCompare(b.id)),
    [sched.supervisors],
  );

  const onDutyByHour = useMemo(
    () =>
      Array.from({ length: 24 }, (_, h) => supervisorsOnDuty(sched, dayIdx, h).length),
    [sched, dayIdx],
  );

  const toggleExpanded = (supId: string) => {
    setExpanded((prev) => ({ ...prev, [supId]: !prev[supId] }));
  };

  return (
    <div className={cn("overflow-hidden rounded-md border bg-card", className)}>
      <div className="overflow-x-auto">
        <div style={{ minWidth: totalW }}>
          <div className="sticky top-0 z-20 flex border-b bg-card">
            <div
              className="sticky left-0 z-30 shrink-0 border-r bg-card px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
              style={{ width: LABEL_W }}
            >
              {day} · {supervisors.length} supervisors
            </div>
            <div className="relative shrink-0" style={{ width: trackW, height: 28 }}>
              {Array.from({ length: 24 }, (_, h) => (
                <span
                  key={h}
                  className="absolute top-1 num text-[10px] tabular-nums text-muted-foreground"
                  style={{ left: h * HOUR_W + 2 }}
                >
                  {String(h).padStart(2, "0")}
                </span>
              ))}
              {Array.from({ length: 25 }, (_, h) => (
                <span
                  key={`grid-${h}`}
                  className="absolute bottom-0 top-0 border-l border-border/40"
                  style={{ left: h * HOUR_W }}
                  aria-hidden
                />
              ))}
            </div>
          </div>

          {supervisors.map((sup, supIndex) => {
            const podNames = podsBySupervisor[sup.id] ?? [];
            const assignment = sup.assignments.find((a) => a.weekday_idx === dayIdx);
            const dutyBars = assignment ? assignmentBars(assignment) : [];
            const isOpen = expanded[sup.id] ?? false;
            const teamColor = podAccentColor(supIndex);

            const members: Agent[] = [];
            if (isOpen) {
              for (const podName of podNames) {
                const pod = snapshot.pods[podName];
                for (const memberId of pod.members) {
                  const agent = agentById.get(memberId);
                  if (!agent) continue;
                  const cell = resolveDayCell(agent, day, sched);
                  if (cell.kind === "shift") members.push(agent);
                }
              }
              members.sort((a, b) =>
                (a.name?.trim() || a.id).localeCompare(b.name?.trim() || b.id),
              );
            }

            return (
              <div key={sup.id}>
                <div
                  className="flex items-stretch border-b border-border/40 hover:bg-accent/15"
                  style={{ minHeight: ROW_H }}
                >
                  <div
                    className="sticky left-0 z-10 flex shrink-0 items-center gap-1 border-r bg-card px-2"
                    style={{ width: LABEL_W }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleExpanded(sup.id)}
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-muted"
                      aria-expanded={isOpen}
                      aria-label={`${isOpen ? "Collapse" : "Expand"} team for ${sup.id}`}
                    >
                      {isOpen ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <AgentLink
                        agentId={sup.id}
                        className="block truncate text-left text-xs font-semibold"
                      />
                      <div className="truncate text-[10px] text-muted-foreground">
                        {podNames.map((p, i) => (
                          <span key={p}>
                            {i > 0 ? ", " : ""}
                            <TeamLink teamName={p} className="inline text-[10px]" />
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {dutyBars.length > 0 ? (
                    <DutyBarTrack
                      bars={dutyBars.map((b) => ({
                        start: b.start,
                        end: b.end,
                        color: SUP_SHIFT_COLOR[b.shiftType] ?? teamColor,
                        tooltip: `${formatMin(b.start)} · ${sup.id} on duty`,
                      }))}
                    />
                  ) : (
                    <div
                      className="relative shrink-0 bg-muted/10"
                      style={{ width: trackW, height: ROW_H }}
                      title={`${sup.id} · off ${day}`}
                    >
                      <span className="absolute inset-0 flex items-center px-2 text-[10px] text-muted-foreground">
                        Off
                      </span>
                    </div>
                  )}
                </div>

                {isOpen &&
                  members.map((agent) => {
                    const cell = resolveDayCell(agent, day, sched);
                    const bars =
                      cell.kind === "shift" && cell.startClock && cell.endClock
                        ? clockBars(cell.startClock, cell.endClock)
                        : [];
                    return (
                      <div
                        key={agent.id}
                        className="flex items-stretch border-b border-border/25 bg-muted/10"
                        style={{ minHeight: MEMBER_ROW_H }}
                      >
                        <div
                          className="sticky left-0 z-10 shrink-0 border-r bg-muted/10 pl-8 pr-2"
                          style={{ width: LABEL_W }}
                        >
                          <AgentLink
                            agentId={agent.id}
                            className="block truncate text-left font-mono text-[9px] leading-[20px]"
                          >
                            {agent.name?.trim() || agent.id}
                          </AgentLink>
                        </div>
                        <DutyBarTrack
                          bars={bars.map((b) => ({
                            ...b,
                            color: shiftColorForAgent(agent),
                            tooltip: `${formatMin(b.start)} · ${agent.id} on duty`,
                          }))}
                          rowHeight={MEMBER_ROW_H}
                        />
                      </div>
                    );
                  })}
              </div>
            );
          })}

          <div
            className="flex items-stretch border-t bg-muted/25"
            style={{ minHeight: ROW_H }}
          >
            <div
              className="sticky left-0 z-10 shrink-0 border-r bg-muted/25 px-2 py-1 text-[10px] font-medium text-muted-foreground"
              style={{ width: LABEL_W }}
            >
              Supervisors on duty
            </div>
            <div className="relative shrink-0" style={{ width: trackW, height: ROW_H }}>
              {onDutyByHour.map((count, h) => {
                const intensity =
                  count >= 2
                    ? "bg-emerald-500/70"
                    : count === 1
                      ? "bg-emerald-400/50"
                      : "bg-rose-400/40";
                return (
                  <div
                    key={h}
                    className={cn(
                      "absolute top-1 bottom-1 rounded-sm",
                      intensity,
                    )}
                    style={{
                      left: h * HOUR_W + 2,
                      width: HOUR_W - 4,
                    }}
                    title={`${String(h).padStart(2, "0")}:00 · ${count} supervisor${count === 1 ? "" : "s"} on duty`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t px-3 py-2 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-sm"
            style={{ backgroundColor: SUP_SHIFT_COLOR.EARLY }}
          />
          Early · before 06:00
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-sm"
            style={{ backgroundColor: SUP_SHIFT_COLOR.DAY }}
          />
          Day · 06:00–18:00
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-sm"
            style={{ backgroundColor: SUP_SHIFT_COLOR.LATE }}
          />
          Late · from 18:00
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-sm"
            style={{ backgroundColor: SUP_SHIFT_COLOR.NIGHT }}
          />
          Overnight
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-sm bg-emerald-400/60" />
          Coverage count / hour
        </span>
      </div>
    </div>
  );
}
