"use client";

import { useMemo, useState } from "react";
import { useQueryState, parseAsString } from "nuqs";
import { ArrowLeft, Clock, Users } from "lucide-react";
import { AgentLink } from "@/components/agent/agent-link";
import { DayStructureBar } from "@/components/agent/day-structure-bar";
import { IntradayGantt } from "@/components/schedule/intraday-gantt";
import { ScheduleViewControls } from "@/components/schedule/schedule-view-controls";
import { StaffingStrip } from "@/components/schedule/staffing-strip";
import { WeekScheduleGrid } from "@/components/schedule/week-schedule-grid";
import { DayTabs } from "@/components/shared/day-tabs";
import { SectionCard } from "@/components/shared/section-card";
import { TeamLink } from "@/components/team/team-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { agentDisplayName, agentInitials } from "@/lib/compute/agent-context";
import {
  agentOperationalRole,
  roleBadgeClass,
  roleColor,
  shiftColor,
} from "@/lib/compute/colors";
import {
  sortScheduleAgents,
  type WeekGroupMode,
  type WeekSortKey,
} from "@/lib/compute/week-schedule";
import { cn, f1 } from "@/lib/utils";
import type { Agent, DOW, ShiftCatalogEntry, Snapshot } from "@/lib/data/types";

interface ShiftsTabProps {
  snapshot: Snapshot;
  leadPct?: number;
}

type ShiftView = "week" | "day" | "by-shift";

const ROLES = ["All", "Supervisor", "CSA", "NDS", "SDS"] as const;
const POSITIONS = ["All", "Lead", "Line"] as const;
type RoleFilter = (typeof ROLES)[number];
type PositionFilter = (typeof POSITIONS)[number];

interface AssignedAgent extends Agent {
  pod: string;
  supervisor_id: string;
}

function roleCounts(agents: AssignedAgent[]) {
  return {
    csa: agents.filter((a) => a.role === "CSA").length,
    nds: agents.filter((a) => a.role === "NDS").length,
    sds: agents.filter((a) => a.role === "SDS").length,
    total: agents.length,
  };
}

function resolveAssignedAgents(snapshot: Snapshot): Record<string, AssignedAgent[]> {
  const out: Record<string, AssignedAgent[]> = {};
  const catalogKeys = new Set(snapshot.shift_catalog.map((s) => s.shift_id));
  for (const s of snapshot.shift_catalog) out[s.shift_id] = [];
  for (const agent of snapshot.agents) {
    const catalogKey = catalogKeys.has(agent.shift_id)
      ? agent.shift_id
      : catalogKeys.has(agent.shift_class)
        ? agent.shift_class
        : null;
    if (!catalogKey || !out[catalogKey]) continue;
    const podEntry = Object.entries(snapshot.pods).find(([, p]) =>
      p.members.includes(agent.id),
    );
    out[catalogKey].push({
      ...agent,
      pod: podEntry ? podEntry[0] : "—",
      supervisor_id: podEntry ? podEntry[1].supervisor_id : "—",
    });
  }
  for (const sid of Object.keys(out)) {
    out[sid].sort((a, b) => {
      if (a.start_clock !== b.start_clock)
        return a.start_clock.localeCompare(b.start_clock);
      const aLead = a.position === "Lead" ? 0 : 1;
      const bLead = b.position === "Lead" ? 0 : 1;
      if (aLead !== bLead) return aLead - bLead;
      return a.id.localeCompare(b.id);
    });
  }
  return out;
}

function PersonShiftCard({
  agent,
  onOpenAgent,
}: {
  agent: AssignedAgent;
  onOpenAgent: (id: string) => void;
}) {
  const opRole = agentOperationalRole(agent);
  const accent = opRole ? roleColor(opRole) : shiftColor(agent.shift_id);

  return (
    <button
      type="button"
      onClick={() => onOpenAgent(agent.id)}
      className="group flex w-[132px] shrink-0 flex-col rounded-lg border border-border/60 bg-card p-2 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/30"
      title={`${agent.id} · ${agent.start_clock}–${agent.end_clock}`}
    >
      <div className="flex items-center gap-2">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold"
          style={{ borderColor: accent, color: accent }}
        >
          {agentInitials(agent)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium leading-tight">
            {agentDisplayName(agent)}
          </div>
          <div className="truncate font-mono text-[9px] text-muted-foreground">
            {agent.id}
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {agent.pod !== "—" ? (
          <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-normal">
            {agent.pod}
          </Badge>
        ) : null}
        {opRole ? (
          <Badge
            variant="outline"
            className={cn("h-4 px-1.5 text-[9px] font-normal", roleBadgeClass(opRole))}
          >
            {opRole}
          </Badge>
        ) : null}
      </div>
    </button>
  );
}

function ByShiftView({
  assignedByShift,
  shiftRows,
  sortKey,
  sortDesc,
  onOpenShift,
  onOpenAgent,
}: {
  assignedByShift: Record<string, AssignedAgent[]>;
  shiftRows: ShiftCatalogEntry[];
  sortKey: WeekSortKey;
  sortDesc: boolean;
  onOpenShift: (shiftId: string) => void;
  onOpenAgent: (id: string) => void;
}) {
  if (!shiftRows.length) {
    return (
      <div className="rounded-md border border-dashed bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
        No assigned shifts in this snapshot.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {shiftRows.map((shift) => {
        const agents = sortScheduleAgents(
          assignedByShift[shift.shift_id] ?? [],
          sortKey,
          sortDesc,
        );
        const color = shiftColor(shift.shift_id);
        return (
          <div
            key={shift.shift_id}
            className="overflow-hidden rounded-xl border border-border/70 bg-card"
          >
            <button
              type="button"
              onClick={() => onOpenShift(shift.shift_id)}
              className="flex w-full items-center gap-3 border-b border-border/60 bg-muted/20 px-3 py-2.5 text-left transition-colors hover:bg-muted/35"
              title={`${shift.shift_id} · ${shift.start_clock}–${shift.end_clock}`}
            >
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-sm"
                style={{ background: color }}
              />
              <div className="min-w-0 flex-1">
                <div className="font-mono text-sm font-semibold">{shift.shift_id}</div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  {shift.start_clock}–{shift.end_clock} · {shift.shift_class}
                </div>
              </div>
              <Badge variant="secondary" className="shrink-0 num tabular-nums">
                {agents.length}
              </Badge>
            </button>
            <div className="overflow-x-auto p-3">
              <div className="flex gap-2">
                {agents.map((agent) => (
                  <PersonShiftCard
                    key={agent.id}
                    agent={agent}
                    onOpenAgent={onOpenAgent}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ShiftDetail({
  shift,
  agents,
}: {
  shift: ShiftCatalogEntry;
  agents: AssignedAgent[];
}) {
  const counts = roleCounts(agents);
  const dot = shiftColor(shift.shift_id);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 font-mono">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: dot }}
          />
          {shift.shift_id}
        </DialogTitle>
        <DialogDescription>
          {shift.start_clock}–{shift.end_clock} · {shift.days} · {shift.shift_class}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            {shift.start_clock}–{shift.end_clock}
          </Badge>
          <Badge variant="secondary">{shift.days}</Badge>
          <Badge variant="secondary">{shift.shift_class}</Badge>
          <Badge variant="secondary">
            {f1(shift.gross_minutes / 60)} h gross ·{" "}
            {f1(shift.productive_minutes / 60)} h productive
          </Badge>
          <Badge variant="outline">
            <Users className="mr-1 h-3 w-3" />
            {counts.total} on shift
          </Badge>
          {counts.csa > 0 && <Badge variant="success">{counts.csa} CSA</Badge>}
          {counts.nds > 0 && <Badge variant="info">{counts.nds} NDS</Badge>}
          {counts.sds > 0 && (
            <Badge
              variant="outline"
              className="border-violet-200 text-violet-700 dark:border-violet-800 dark:text-violet-300"
            >
              {counts.sds} SDS
            </Badge>
          )}
        </div>

        <div className="space-y-2 rounded-lg border bg-muted/15 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Day structure
          </p>
          <DayStructureBar
            segments={shift.segments}
            startClock={shift.start_clock}
            endClock={shift.end_clock}
            variant="full"
          />
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Agent</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Team</TableHead>
            <TableHead>Supervisor</TableHead>
            <TableHead>Off pair</TableHead>
            <TableHead>Works days</TableHead>
            <TableHead className="text-right">Eff. h/wk</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.map((a) => (
            <TableRow key={a.id}>
              <TableCell>
                <AgentLink agentId={a.id} />
              </TableCell>
              <TableCell className="text-sm">
                {a.role} {a.position}
              </TableCell>
              <TableCell className="text-sm">
                {a.pod !== "—" ? (
                  <TeamLink teamName={a.pod} className="text-sm font-normal" />
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="text-sm">
                {a.supervisor_id && a.supervisor_id !== "—" ? (
                  <AgentLink agentId={a.supervisor_id} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {a.off_pair ?? "—"}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {(a.works_days ?? []).join(", ")}
              </TableCell>
              <TableCell className="text-right num">
                {a.effective_hours_per_week
                  ? f1(a.effective_hours_per_week)
                  : "—"}
              </TableCell>
            </TableRow>
          ))}
          {agents.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={7}
                className="py-6 text-center text-muted-foreground"
              >
                No agents assigned to this shift template.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}

export function ShiftsTab({ snapshot, leadPct }: ShiftsTabProps) {
  const effectiveLeadPct = leadPct ?? snapshot.meta.lead_on_work_default;
  const [view, setView] = useState<ShiftView>("week");
  const [selectedDay, setSelectedDay] = useState<DOW>("Mon");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("All");
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("All");
  const [groupMode, setGroupMode] = useState<WeekGroupMode>("flat");
  const [sortKey, setSortKey] = useState<WeekSortKey>("start");
  const [sortDesc, setSortDesc] = useState(false);
  const [dialogShiftId, setDialogShiftId] = useState<string | null>(null);
  const [, setAgentId] = useQueryState("agent_id", parseAsString);

  const assignedByShift = useMemo(
    () => resolveAssignedAgents(snapshot),
    [snapshot],
  );

  const activeShiftRows = useMemo(() => {
    return snapshot.shift_catalog
      .filter((s) => (assignedByShift[s.shift_id]?.length ?? 0) > 0)
      .sort((a, b) => {
        if (a.start_minute !== b.start_minute) return a.start_minute - b.start_minute;
        return a.shift_id.localeCompare(b.shift_id);
      });
  }, [snapshot.shift_catalog, assignedByShift]);

  const totalAssigned = useMemo(
    () =>
      activeShiftRows.reduce(
        (sum, s) => sum + (assignedByShift[s.shift_id]?.length ?? 0),
        0,
      ),
    [activeShiftRows, assignedByShift],
  );

  const dialogShift = dialogShiftId
    ? snapshot.shift_catalog.find((s) => s.shift_id === dialogShiftId) ?? null
    : null;
  const dialogAgents = dialogShiftId ? assignedByShift[dialogShiftId] ?? [] : [];

  const openAgent = (id: string) => {
    void setAgentId(id);
  };

  const switchView = (next: ShiftView) => {
    setView(next);
    if (next !== "by-shift") {
      setDialogShiftId(null);
    }
  };

  const handleSortChange = (key: WeekSortKey) => {
    if (sortKey === key) {
      setSortDesc((d) => !d);
      return;
    }
    setSortKey(key);
    setSortDesc(false);
  };

  const handleDaySelect = (day: DOW) => {
    setSelectedDay(day);
    setView("day");
  };

  const showScheduleControls = view === "week" || view === "day";

  return (
    <div className="space-y-4">
      <div className="num rounded-lg border border-border/60 bg-muted/15 px-4 py-2 text-sm tabular-nums">
        {activeShiftRows.length} shift templates · {totalAssigned} agents scheduled
      </div>

      <SectionCard
        title="Schedule"
        contentClassName={view === "day" ? "p-2 sm:p-3" : undefined}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            {view === "day" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => switchView("week")}
              >
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                Week
              </Button>
            )}
            <div className="flex rounded-md border border-border/60 p-0.5">
              <Button
                type="button"
                variant={view === "week" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => switchView("week")}
              >
                Week
              </Button>
              <Button
                type="button"
                variant={view === "day" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => switchView("day")}
              >
                Day
              </Button>
              <Button
                type="button"
                variant={view === "by-shift" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => switchView("by-shift")}
              >
                By Shift
              </Button>
            </div>
            {view === "day" && (
              <DayTabs day={selectedDay} onChange={setSelectedDay} />
            )}
          </div>
        }
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs uppercase tracking-wider text-muted-foreground">
            Role
          </span>
          {ROLES.map((r) => (
            <Button
              key={r}
              type="button"
              variant={roleFilter === r ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setRoleFilter(r);
                if (r === "Supervisor") setPositionFilter("All");
              }}
            >
              {r}
            </Button>
          ))}
          {roleFilter !== "Supervisor" && (
            <>
              <span className="ml-3 mr-1 text-xs uppercase tracking-wider text-muted-foreground">
                Position
              </span>
              {POSITIONS.map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant={positionFilter === p ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setPositionFilter(p)}
                >
                  {p}
                </Button>
              ))}
            </>
          )}
        </div>

        {showScheduleControls && (
          <div className="mb-3">
            <ScheduleViewControls
              groupMode={groupMode}
              onGroupModeChange={setGroupMode}
              sortKey={sortKey}
              sortDesc={sortDesc}
              onSortChange={handleSortChange}
            />
          </div>
        )}

        {view === "week" && (
          <WeekScheduleGrid
            snapshot={snapshot}
            roleFilter={roleFilter}
            positionFilter={positionFilter}
            selectedDay={selectedDay}
            onDaySelect={handleDaySelect}
            groupMode={groupMode}
            sortKey={sortKey}
            sortDesc={sortDesc}
          />
        )}

        {view === "day" && (
          <div className="flex min-h-[calc(100vh-240px)] flex-col gap-4">
            <StaffingStrip
              snapshot={snapshot}
              day={selectedDay}
              leadPct={effectiveLeadPct}
            />
            <IntradayGantt
              snapshot={snapshot}
              day={selectedDay}
              roleFilter={roleFilter}
              positionFilter={positionFilter}
              groupMode={groupMode}
              sortKey={sortKey}
              sortDesc={sortDesc}
              className="min-h-0 flex-1"
            />
          </div>
        )}

        {view === "by-shift" && (
          <>
            <div className="mb-3">
              <ScheduleViewControls
                groupMode={groupMode}
                onGroupModeChange={setGroupMode}
                sortKey={sortKey}
                sortDesc={sortDesc}
                onSortChange={handleSortChange}
                showGroupToggle={false}
              />
            </div>
            <ByShiftView
              assignedByShift={assignedByShift}
              shiftRows={activeShiftRows}
              sortKey={sortKey}
              sortDesc={sortDesc}
              onOpenShift={setDialogShiftId}
              onOpenAgent={openAgent}
            />
          </>
        )}
      </SectionCard>

      <Dialog
        open={dialogShift !== null}
        onOpenChange={(o) => !o && setDialogShiftId(null)}
      >
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          {dialogShift && (
            <ShiftDetail shift={dialogShift} agents={dialogAgents} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
