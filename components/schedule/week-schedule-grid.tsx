"use client";

import { useMemo } from "react";
import { useQueryState, parseAsString } from "nuqs";
import {
  agentDisplayName,
  agentInitials,
} from "@/lib/compute/agent-context";
import {
  agentOperationalRole,
  podAccentColor,
  roleColor,
  shiftColor,
} from "@/lib/compute/colors";
import { formatClock24 } from "@/lib/compute/day-structure";
import {
  DOW_LIST,
  resolveDayCell,
  podNamesOrdered,
  sortScheduleAgents,
  collectFlatScheduleAgentsBelowSupervisors,
  collectSupervisorsOrdered,
  agentMatchesScheduleFilters,
  type DayShiftCell,
  type WeekSortKey,
  type WeekGroupMode,
} from "@/lib/compute/week-schedule";
import { cn } from "@/lib/utils";
import type { Agent, DOW, Snapshot } from "@/lib/data/types";

interface WeekScheduleGridProps {
  snapshot: Snapshot;
  roleFilter?: string;
  positionFilter?: string;
  selectedDay?: DOW | null;
  onDaySelect?: (day: DOW) => void;
  groupMode?: WeekGroupMode;
  sortKey?: WeekSortKey;
  sortDesc?: boolean;
  className?: string;
}

function agentMatchesFilters(
  agent: Agent,
  roleFilter: string,
  positionFilter: string,
): boolean {
  return agentMatchesScheduleFilters(agent, roleFilter, positionFilter);
}

function formatShiftRange(start?: string, end?: string): string {
  if (!start || !end) return "—";
  return `${formatClock24(start)} – ${formatClock24(end)}`;
}

function DayStaffingBar({ values }: { values: number[] }) {
  const hourly = useMemo(
    () =>
      Array.from(
        { length: 24 },
        (_, h) => ((values[h * 2] ?? 0) + (values[h * 2 + 1] ?? 0)) / 2,
      ),
    [values],
  );
  const peak = Math.max(...hourly, 1);

  return (
    <div
      className="mx-auto flex h-6 max-w-[88px] items-end gap-px"
      title="Hourly CSA staffing (proposed)"
    >
      {hourly.map((v, i) => (
        <div
          key={i}
          className="flex-1 min-w-0 rounded-sm bg-indigo-500/70 dark:bg-indigo-400/60"
          style={{ height: `${Math.max(6, (v / peak) * 100)}%` }}
        />
      ))}
    </div>
  );
}

function ShiftCellCard({
  cell,
  agent,
  onOpen,
}: {
  cell: DayShiftCell;
  agent: Agent;
  onOpen: (id: string) => void;
}) {
  if (cell.kind === "off") {
    return (
      <div className="h-full min-h-[56px] rounded-md bg-muted/25" aria-hidden />
    );
  }

  const opRole = agentOperationalRole(agent);
  const accent = opRole ? roleColor(opRole) : shiftColor(cell.shiftId);
  const barColor = shiftColor(cell.shiftId);

  return (
    <button
      type="button"
      onClick={() => onOpen(agent.id)}
      className="group flex h-full min-h-[56px] w-full flex-col rounded-md border border-border/60 bg-card text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/30"
      title={`${agent.id} · ${cell.startClock}–${cell.endClock} · ${cell.shiftId}`}
    >
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-md">
        <span
          className="w-1 shrink-0"
          style={{ backgroundColor: accent }}
          aria-hidden
        />
        <div className="min-w-0 flex-1 px-1.5 py-1">
          <div className="num truncate text-[10px] font-semibold tabular-nums leading-tight">
            {formatShiftRange(cell.startClock, cell.endClock)}
          </div>
          <div className="mt-0.5 truncate font-mono text-[9px] text-muted-foreground">
            {cell.shiftId}
          </div>
          {cell.shiftLabel && cell.shiftLabel !== cell.shiftId && (
            <div className="truncate text-[8px] uppercase tracking-wide text-muted-foreground/80">
              {cell.shiftLabel}
            </div>
          )}
        </div>
      </div>
      <span
        className="mx-1 mb-1 h-1 rounded-full"
        style={{ backgroundColor: barColor }}
        aria-hidden
      />
    </button>
  );
}

function AgentRow({
  agent,
  snapshot,
  onOpen,
}: {
  agent: Agent;
  snapshot: Snapshot;
  onOpen: (id: string) => void;
}) {
  const opRole = agentOperationalRole(agent);
  const rowAccent = opRole ? roleColor(opRole) : "#64748b";
  const hours =
    typeof agent.effective_hours_per_week === "number"
      ? agent.effective_hours_per_week.toFixed(0)
      : null;

  return (
    <tr className="border-b border-border/40 hover:bg-muted/10">
      <td className="sticky left-0 z-10 min-w-[160px] max-w-[160px] border-r bg-card px-2 py-2">
        <button
          type="button"
          onClick={() => onOpen(agent.id)}
          className="flex w-full items-center gap-2 text-left hover:opacity-90"
        >
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[9px] font-semibold"
            style={{ borderColor: rowAccent, color: rowAccent }}
          >
            {agentInitials(agent)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-medium">
              {agentDisplayName(agent)}
            </div>
            <div className="truncate font-mono text-[9px] text-muted-foreground">
              {agent.id}
            </div>
            {hours && (
              <div className="num text-[9px] tabular-nums text-muted-foreground">
                {hours}h
              </div>
            )}
          </div>
        </button>
      </td>
      {DOW_LIST.map((day) => {
        const cell = resolveDayCell(agent, day, snapshot.supervisor_schedule);
        return (
          <td key={day} className="p-0.5 align-top">
            <ShiftCellCard cell={cell} agent={agent} onOpen={onOpen} />
          </td>
        );
      })}
    </tr>
  );
}

function SupervisorSection({
  supervisors,
  snapshot,
  onOpen,
}: {
  supervisors: Agent[];
  snapshot: Snapshot;
  onOpen: (id: string) => void;
}) {
  if (!supervisors.length) return null;

  return (
    <>
      <tr className="bg-muted/30">
        <td
          colSpan={DOW_LIST.length + 1}
          className="sticky left-0 z-10 border-l-[3px] border-l-cyan-600 px-2 py-1.5 text-xs font-semibold tracking-tight"
        >
          Supervisors
          <span className="ml-2 font-normal text-muted-foreground">
            {supervisors.length} · Team 1–6
          </span>
        </td>
      </tr>
      {supervisors.map((agent) => (
        <AgentRow
          key={agent.id}
          agent={agent}
          snapshot={snapshot}
          onOpen={onOpen}
        />
      ))}
    </>
  );
}

function TeamSection({
  teamName,
  podIdx,
  supervisorId,
  agents,
  snapshot,
  onOpen,
}: {
  teamName: string;
  podIdx?: number;
  supervisorId?: string;
  agents: Agent[];
  snapshot: Snapshot;
  onOpen: (id: string) => void;
}) {
  if (!agents.length) return null;

  const accent =
    podIdx !== undefined ? podAccentColor(podIdx) : "#334155";

  return (
    <>
      <tr className="bg-muted/30">
        <td
          colSpan={DOW_LIST.length + 1}
          className="sticky left-0 z-10 border-l-[3px] px-2 py-1.5 text-xs font-semibold tracking-tight"
          style={{ borderLeftColor: accent }}
        >
          {teamName}
          <span className="ml-2 font-normal text-muted-foreground">
            {supervisorId ? `${supervisorId} · ` : ""}
            {agents.length} members
          </span>
        </td>
      </tr>
      {agents.map((agent) => (
        <AgentRow
          key={agent.id}
          agent={agent}
          snapshot={snapshot}
          onOpen={onOpen}
        />
      ))}
    </>
  );
}

/** Dialpad-style week grid: supervisors cascade at top, then flat or by team. */
export function WeekScheduleGrid({
  snapshot,
  roleFilter = "All",
  positionFilter = "All",
  selectedDay,
  onDaySelect,
  groupMode = "flat",
  sortKey = "name",
  sortDesc = false,
  className,
}: WeekScheduleGridProps) {
  const [, setAgentId] = useQueryState("agent_id", parseAsString);
  const [, setTeam] = useQueryState("team", parseAsString);
  const [, setTeamRole] = useQueryState("team_role", parseAsString);

  const openAgent = (id: string) => {
    void setTeam(null);
    void setTeamRole(null);
    void setAgentId(id);
  };

  const supervisors = useMemo(
    () =>
      collectSupervisorsOrdered(
        snapshot,
        roleFilter,
        positionFilter,
        sortKey,
        sortDesc,
      ),
    [snapshot, roleFilter, positionFilter, sortKey, sortDesc],
  );

  const flatAgents = useMemo(
    () =>
      collectFlatScheduleAgentsBelowSupervisors(
        snapshot,
        roleFilter,
        positionFilter,
        sortKey,
        sortDesc,
      ),
    [snapshot, roleFilter, positionFilter, sortKey, sortDesc],
  );

  const podLanes = useMemo(() => {
    const agentById = new Map(snapshot.agents.map((a) => [a.id, a]));
    return podNamesOrdered(snapshot.pods).map((name, podIdx) => ({
      name,
      podIdx,
      pod: snapshot.pods[name]!,
      agents: sortScheduleAgents(
        (snapshot.pods[name]?.members ?? [])
          .map((id) => agentById.get(id))
          .filter((a): a is Agent => !!a)
          .filter((a) => a.role !== "Supervisor")
          .filter((a) => agentMatchesFilters(a, roleFilter, positionFilter)),
        sortKey,
        sortDesc,
      ),
    }));
  }, [snapshot, roleFilter, positionFilter, sortKey, sortDesc]);

  const totalRows =
    supervisors.length +
    (groupMode === "flat"
      ? flatAgents.length
      : podLanes.reduce((n, p) => n + p.agents.length, 0));

  return (
    <div className={cn("overflow-hidden rounded-xl border border-border/70", className)}>
      <div className="flex items-center justify-end gap-3 border-b border-border/60 bg-muted/20 px-3 py-2">
        <span className="text-[10px] text-muted-foreground num tabular-nums">
          {totalRows} people
        </span>
      </div>

      <div className="max-h-[min(72vh,900px)] overflow-auto">
        <table className="w-full min-w-[880px] border-collapse text-sm">
          <thead className="sticky top-0 z-20 bg-card shadow-[0_1px_0_hsl(var(--border))]">
            <tr>
              <th className="sticky left-0 z-30 min-w-[160px] border-r bg-card px-2 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Employee
              </th>
              {DOW_LIST.map((day) => {
                const csaDay = snapshot.supply.csa_effective[day] ?? [];
                const workingCount = snapshot.agents.filter(
                  (a) => a.role === "CSA" && a.works_days?.includes(day),
                ).length;
                const isSelected = selectedDay === day;
                const HeaderTag = onDaySelect ? "button" : "div";
                return (
                  <th
                    key={day}
                    className={cn(
                      "min-w-[96px] px-1 py-2 text-center align-bottom",
                      isSelected && "bg-primary/5 ring-1 ring-inset ring-primary/30",
                    )}
                  >
                    <HeaderTag
                      type={onDaySelect ? "button" : undefined}
                      onClick={onDaySelect ? () => onDaySelect(day) : undefined}
                      className={cn(
                        "w-full",
                        onDaySelect && "cursor-pointer rounded-md hover:bg-accent/40",
                      )}
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-wider">
                        {day}
                      </div>
                      <div className="num mt-0.5 text-[9px] tabular-nums text-muted-foreground">
                        {workingCount} CSA
                      </div>
                      <div className="mt-1">
                        <DayStaffingBar values={csaDay} />
                      </div>
                    </HeaderTag>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {totalRows === 0 ? (
              <tr>
                <td
                  colSpan={DOW_LIST.length + 1}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  No matching resources.
                </td>
              </tr>
            ) : (
              <>
                <SupervisorSection
                  supervisors={supervisors}
                  snapshot={snapshot}
                  onOpen={openAgent}
                />
                {groupMode === "flat"
                  ? flatAgents.map((agent) => (
                      <AgentRow
                        key={agent.id}
                        agent={agent}
                        snapshot={snapshot}
                        onOpen={openAgent}
                      />
                    ))
                  : podLanes.map((lane) => (
                      <TeamSection
                        key={lane.name}
                        teamName={lane.name}
                        podIdx={lane.podIdx}
                        supervisorId={lane.pod.supervisor_id}
                        agents={lane.agents}
                        snapshot={snapshot}
                        onOpen={openAgent}
                      />
                    ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
