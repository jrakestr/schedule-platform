"use client";

import { useMemo } from "react";
import { AgentLink } from "@/components/agent/agent-link";
import {
  formatClock24,
  formatSegmentLabel,
  parseClock,
  structureToTimeline,
  type TimelineSegment,
} from "@/lib/compute/day-structure";
import {
  DOW_TO_IDX,
  podNamesOrdered,
  resolveDayCell,
  sortScheduleAgents,
  collectSupervisorsOrdered,
  agentMatchesScheduleFilters,
  type DayShiftCell,
  type WeekSortKey,
  type WeekGroupMode,
} from "@/lib/compute/week-schedule";
import { segmentKindColor } from "@/lib/navigation/panel-params";
import { cn } from "@/lib/utils";
import type { Agent, Assignment, DOW, Snapshot } from "@/lib/data/types";

export const TIMELINE_START_MIN = 4 * 60;
export const TIMELINE_END_MIN = 24 * 60;
export const TIMELINE_SPAN_MIN = TIMELINE_END_MIN - TIMELINE_START_MIN;

const LABEL_W = 168;
const HOUR_W = 48;
const ROW_H = 48;
const POD_HEAD_H = 32;
const MIN_VIEWPORT_H = 480;

const SUP_SHIFT_COLOR: Record<string, string> = {
  DAY: "#0891b2",
  NIGHT: "#475569",
};

interface IntradayGanttProps {
  snapshot: Snapshot;
  day: DOW;
  roleFilter?: string;
  positionFilter?: string;
  groupMode?: WeekGroupMode;
  sortKey?: WeekSortKey;
  sortDesc?: boolean;
  className?: string;
}

interface GanttLane {
  name: string;
  supervisorId?: string;
  agents: Agent[];
  kind: "pod" | "supervisors";
}

function agentMatchesFilters(
  agent: Agent,
  roleFilter: string,
  positionFilter: string,
): boolean {
  return agentMatchesScheduleFilters(agent, roleFilter, positionFilter);
}

function agentOnDay(
  agent: Agent,
  day: DOW,
  schedule: Snapshot["supervisor_schedule"],
): boolean {
  const cell = resolveDayCell(agent, day, schedule);
  return cell.kind === "shift";
}

function assignmentBars(assignment: Assignment): Array<{ start: number; end: number; kind: string }> {
  const [startStr, endStr] = (assignment.hours || "06:00-18:00").split("-");
  const start = parseClock(startStr) ?? 0;
  const endRaw = parseClock(endStr) ?? start;
  const kind = assignment.shift_type;

  if (endRaw <= start) {
    return [
      { start, end: 24 * 60, kind },
      { start: 0, end: endRaw, kind },
    ];
  }
  return [{ start, end: endRaw, kind }];
}

function clockBars(
  startClock: string,
  endClock: string,
  kind = "On duty",
): Array<{ start: number; end: number; kind: string }> {
  const start = parseClock(startClock) ?? 0;
  const endRaw = parseClock(endClock) ?? start;

  if (endRaw <= start) {
    return [
      { start, end: 24 * 60, kind },
      { start: 0, end: endRaw, kind },
    ];
  }
  return [{ start, end: endRaw, kind }];
}

function agentTimelineSegments(
  agent: Agent,
  day: DOW,
  schedule: Snapshot["supervisor_schedule"],
): TimelineSegment[] {
  if (agent.role === "Supervisor") {
    const dayIdx = DOW_TO_IDX[day];
    const sup = schedule.supervisors.find((s) => s.id === agent.id);
    const assignment = sup?.assignments?.find((a) => a.weekday_idx === dayIdx);
    if (!assignment) return [];
    return assignmentBars(assignment).map((b) => ({
      startMin: b.start,
      endMin: b.end,
      kind: b.kind,
    }));
  }

  const fromStructure = structureToTimeline(agent.structure);
  if (fromStructure.length) return fromStructure;

  const cell: DayShiftCell = resolveDayCell(agent, day, schedule);
  if (cell.kind === "shift" && cell.startClock && cell.endClock) {
    return clockBars(cell.startClock, cell.endClock, "On duty").map((b) => ({
      startMin: b.start,
      endMin: b.end,
      kind: b.kind,
    }));
  }

  return [];
}

/** Split overnight segments and clip to the 04:00–24:00 window. */
function visiblePieces(
  segments: TimelineSegment[],
): Array<{ start: number; end: number; kind: string }> {
  const out: Array<{ start: number; end: number; kind: string }> = [];

  for (const seg of segments) {
    const start = seg.startMin;
    const end = seg.endMin;

    if (end > 1440) {
      out.push(
        ...visiblePieces([{ startMin: start, endMin: 1440, kind: seg.kind }]),
      );
      out.push(
        ...visiblePieces([
          {
            startMin: 0,
            endMin: end - 1440,
            kind: seg.kind,
          },
        ]),
      );
      continue;
    }

    if (end <= TIMELINE_START_MIN || start >= TIMELINE_END_MIN) continue;

    const clipStart = Math.max(start, TIMELINE_START_MIN);
    const clipEnd = Math.min(end, TIMELINE_END_MIN);
    if (clipEnd > clipStart) {
      out.push({ start: clipStart, end: clipEnd, kind: seg.kind });
    }
  }

  return out;
}

function timeX(min: number): number {
  return (
    ((min - TIMELINE_START_MIN) / TIMELINE_SPAN_MIN) *
    (TIMELINE_SPAN_MIN / 60) *
    HOUR_W
  );
}

function pieceColor(agent: Agent, kind: string): string {
  if (agent.role === "Supervisor") {
    return SUP_SHIFT_COLOR[kind] ?? "#64748b";
  }
  return segmentKindColor(kind);
}

function SegmentBar({
  segments,
  agent,
}: {
  segments: TimelineSegment[];
  agent: Agent;
}) {
  const pieces = visiblePieces(segments);
  const trackW = (TIMELINE_SPAN_MIN / 60) * HOUR_W;

  if (!pieces.length) {
    return (
      <div
        className="relative h-full bg-muted/15"
        style={{ width: trackW }}
        title={`${agent.id} · no segments in window`}
      />
    );
  }

  return (
    <div className="relative h-full bg-muted/15" style={{ width: trackW }}>
      {pieces.map((piece, idx) => {
        const left = timeX(piece.start);
        const width = Math.max(3, timeX(piece.end) - left);
        const color = pieceColor(agent, piece.kind);
        const tooltip =
          agent.role === "Supervisor"
            ? `${piece.kind} · ${agent.id}`
            : formatSegmentLabel(piece.start, piece.end, piece.kind);
        return (
          <div
            key={`${piece.start}-${piece.kind}-${idx}`}
            className="absolute top-1 bottom-1 rounded-sm"
            style={{
              left,
              width,
              backgroundColor: color,
              opacity: piece.kind === "Voice" ? 0.95 : 0.88,
            }}
            title={tooltip}
          />
        );
      })}
    </div>
  );
}

function buildLanes(
  snapshot: Snapshot,
  day: DOW,
  roleFilter: string,
  positionFilter: string,
  groupMode: WeekGroupMode,
  sortKey: WeekSortKey,
  sortDesc: boolean,
): GanttLane[] {
  const agentById = new Map(snapshot.agents.map((a) => [a.id, a]));
  const schedule = snapshot.supervisor_schedule;
  const lanes: GanttLane[] = [];

  const showPods = roleFilter === "All" || roleFilter !== "Supervisor";
  const showSupervisors = roleFilter === "All" || roleFilter === "Supervisor";

  if (showSupervisors) {
    const supervisors = collectSupervisorsOrdered(
      snapshot,
      roleFilter,
      positionFilter,
      sortKey,
      sortDesc,
    );
    if (supervisors.length > 0) {
      lanes.push({
        name: "Supervisors",
        agents: supervisors,
        kind: "supervisors",
      });
    }
  }

  if (groupMode === "flat" && showPods) {
    const agents = sortScheduleAgents(
      snapshot.agents
        .filter((a) => a.role !== "Supervisor")
        .filter((a) => agentMatchesFilters(a, roleFilter, positionFilter))
        .filter((a) => agentOnDay(a, day, schedule)),
      sortKey,
      sortDesc,
    );
    if (agents.length > 0) {
      lanes.push({ name: "On duty", agents, kind: "pod" });
    }
    return lanes;
  }

  if (showPods) {
    for (const name of podNamesOrdered(snapshot.pods)) {
      const pod = snapshot.pods[name];
      if (!pod) continue;
      const agents = sortScheduleAgents(
        (pod.members ?? [])
          .map((id) => agentById.get(id))
          .filter((a): a is Agent => !!a)
          .filter((a) => a.role !== "Supervisor")
          .filter((a) => agentMatchesFilters(a, roleFilter, positionFilter))
          .filter((a) => agentOnDay(a, day, schedule)),
        sortKey,
        sortDesc,
      );
      if (agents.length > 0) {
        lanes.push({
          name,
          supervisorId: pod.supervisor_id,
          agents,
          kind: "pod",
        });
      }
    }
  }

  return lanes;
}

function emptyMessage(
  roleFilter: string,
  positionFilter: string,
  day: DOW,
): string {
  if (roleFilter === "Supervisor") {
    return `No supervisors scheduled on ${day}. Supervisor duty comes from DAY/NIGHT rotation assignments, not voice shift templates.`;
  }
  if (roleFilter !== "All" || positionFilter !== "All") {
    return `No ${roleFilter === "All" ? "" : `${roleFilter} `}resources on duty for ${day} with the current Role${positionFilter !== "All" ? " and Position" : ""} filters. Try Role = All or a different day.`;
  }
  return `No resources on duty for ${day}.`;
}

/** Optibus-style intraday Gantt with Voice / Break / Lunch segments. */
export function IntradayGantt({
  snapshot,
  day,
  roleFilter = "All",
  positionFilter = "All",
  groupMode = "flat",
  sortKey = "name",
  sortDesc = false,
  className,
}: IntradayGanttProps) {
  const schedule = snapshot.supervisor_schedule;

  const lanes = useMemo(
    () =>
      buildLanes(
        snapshot,
        day,
        roleFilter,
        positionFilter,
        groupMode,
        sortKey,
        sortDesc,
      ),
    [snapshot, day, roleFilter, positionFilter, groupMode, sortKey, sortDesc],
  );

  const hourLabels = Array.from(
    { length: TIMELINE_END_MIN / 60 - TIMELINE_START_MIN / 60 },
    (_, i) => TIMELINE_START_MIN / 60 + i,
  );
  const trackW = hourLabels.length * HOUR_W;
  const totalW = LABEL_W + trackW;

  const rowCount = lanes.reduce((n, l) => n + l.agents.length, 0);
  const showSupervisorLegend = roleFilter === "Supervisor" || roleFilter === "All";

  return (
    <div
      className={cn(
        "flex min-h-[480px] flex-col overflow-hidden rounded-md border bg-card",
        className,
      )}
    >
      <div
        className="min-h-0 flex-1 overflow-auto"
        style={{ minHeight: MIN_VIEWPORT_H }}
      >
        <div className="w-full min-w-full" style={{ minWidth: totalW }}>
          <div className="sticky top-0 z-20 flex border-b bg-card">
            <div
              className="sticky left-0 z-30 shrink-0 border-r bg-card px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"
              style={{ width: LABEL_W }}
            >
              {day} · {rowCount} on duty
            </div>
            <div
              className="relative shrink-0"
              style={{ width: trackW, height: 36 }}
            >
              {hourLabels.map((h) => {
                const x = (h - TIMELINE_START_MIN / 60) * HOUR_W;
                return (
                  <span
                    key={h}
                    className="absolute top-1.5 num text-xs tabular-nums text-muted-foreground"
                    style={{ left: x + 4 }}
                  >
                    {formatClock24(h * 60)}
                  </span>
                );
              })}
              {hourLabels.map((h) => {
                const x = (h - TIMELINE_START_MIN / 60) * HOUR_W;
                return (
                  <span
                    key={`grid-${h}`}
                    className="absolute bottom-0 top-0 border-l border-border/40"
                    style={{ left: x }}
                    aria-hidden
                  />
                );
              })}
            </div>
          </div>

          {lanes.length === 0 ? (
            <p className="px-6 py-16 text-center text-sm leading-relaxed text-muted-foreground">
              {emptyMessage(roleFilter, positionFilter, day)}
            </p>
          ) : (
            lanes.map((lane) => (
              <div key={lane.name}>
                {groupMode === "team" || lane.kind === "supervisors" ? (
                  <div
                    className="flex items-center border-b border-border/50 bg-muted/35"
                    style={{ height: POD_HEAD_H }}
                  >
                    <div
                      className="sticky left-0 z-10 shrink-0 border-r bg-muted/35 px-3 text-sm font-semibold"
                      style={{ width: LABEL_W }}
                    >
                      {lane.name}
                      {lane.supervisorId ? (
                        <span className="ml-1.5 font-normal text-muted-foreground">
                          · {lane.supervisorId}
                        </span>
                      ) : null}
                    </div>
                    <div
                      className="shrink-0 bg-muted/20"
                      style={{ width: trackW, height: 1 }}
                    />
                  </div>
                ) : null}

                {lane.agents.map((agent) => {
                  const segments = agentTimelineSegments(agent, day, schedule);
                  return (
                    <div
                      key={agent.id}
                      className="flex items-stretch border-b border-border/30 hover:bg-accent/20"
                      style={{ height: ROW_H }}
                    >
                      <div
                        className="sticky left-0 z-10 flex shrink-0 items-center border-r bg-card px-3"
                        style={{ width: LABEL_W }}
                      >
                        <AgentLink
                          agentId={agent.id}
                          className="block truncate text-left text-xs font-medium leading-tight"
                        >
                          {agent.name?.trim() || agent.id}
                        </AgentLink>
                      </div>
                      <SegmentBar segments={segments} agent={agent} />
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1.5 border-t px-4 py-2.5">
        {showSupervisorLegend ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: SUP_SHIFT_COLOR.DAY }}
              />
              DAY
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: SUP_SHIFT_COLOR.NIGHT }}
              />
              NIGHT
            </span>
          </>
        ) : null}
        {roleFilter !== "Supervisor"
          ? (["Voice", "Break", "Lunch"] as const).map((kind) => (
              <span
                key={kind}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: segmentKindColor(kind) }}
                />
                {kind}
              </span>
            ))
          : null}
      </div>
    </div>
  );
}
