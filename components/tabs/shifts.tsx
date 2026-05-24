"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Clock, Users } from "lucide-react";
import { AgentLink } from "@/components/agent/agent-link";
import { DayStructureBar } from "@/components/agent/day-structure-bar";
import { SectionCard } from "@/components/shared/section-card";
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
import { shiftColor } from "@/lib/compute/colors";
import { segmentKindColor } from "@/lib/navigation/panel-params";
import { cn, f1 } from "@/lib/utils";
import type { Agent, ShiftCatalogEntry, Snapshot } from "@/lib/data/types";

interface ShiftsTabProps {
  snapshot: Snapshot;
}

interface AssignedAgent extends Agent {
  pod: string;
  supervisor_id: string;
}

function parseClock(t: string): number | null {
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Where the shift sits on a 24-hour clock (handles overnight wrap). */
function ShiftClockStrip({
  startClock,
  endClock,
  color,
}: {
  startClock: string;
  endClock: string;
  color: string;
}) {
  const start = parseClock(startClock);
  let end = parseClock(endClock);
  if (start === null || end === null) return null;
  if (end <= start) end += 24 * 60;

  const leftPct = (start / (24 * 60)) * 100;
  const widthPct = Math.min(((end - start) / (24 * 60)) * 100, 100 - leftPct);

  return (
    <div
      className="relative h-2 w-full min-w-[72px] rounded-full bg-muted/40 border border-border/60"
      role="img"
      aria-label={`24-hour day position ${startClock} to ${endClock}`}
      title={`${startClock}–${endClock}`}
    >
      <div
        className="absolute inset-y-0 rounded-full"
        style={{
          left: `${leftPct}%`,
          width: `${widthPct}%`,
          backgroundColor: color,
          opacity: 0.85,
        }}
      />
    </div>
  );
}

function roleCounts(agents: AssignedAgent[]) {
  return {
    csa: agents.filter((a) => a.role === "CSA").length,
    nds: agents.filter((a) => a.role === "NDS").length,
    sds: agents.filter((a) => a.role === "SDS").length,
    total: agents.length,
  };
}

export function ShiftsTab({ snapshot }: ShiftsTabProps) {
  const [shiftFilter, setShiftFilter] = useState<string | null>(null);
  const [dialogShiftId, setDialogShiftId] = useState<string | null>(null);

  const assignedByShift = useMemo<Record<string, AssignedAgent[]>>(() => {
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
  }, [snapshot]);

  /** Catalog rows with at least one roster assignment — UI-only filter; snapshot data unchanged. */
  const assignedShiftCatalog = useMemo(
    () =>
      snapshot.shift_catalog.filter(
        (s) => (assignedByShift[s.shift_id]?.length ?? 0) > 0,
      ),
    [snapshot.shift_catalog, assignedByShift],
  );

  const assignedShiftIds = useMemo(
    () => new Set(assignedShiftCatalog.map((s) => s.shift_id)),
    [assignedShiftCatalog],
  );

  const effectiveShiftFilter =
    shiftFilter && assignedShiftIds.has(shiftFilter) ? shiftFilter : null;

  const rosterRows = useMemo(() => {
    const rows: (AssignedAgent & { catalog_shift_id: string })[] = [];
    for (const shift of assignedShiftCatalog) {
      for (const agent of assignedByShift[shift.shift_id] ?? []) {
        rows.push({
          ...agent,
          catalog_shift_id: shift.shift_id,
        });
      }
    }
    rows.sort((a, b) => {
      const si = assignedShiftCatalog.findIndex((s) => s.shift_id === a.catalog_shift_id);
      const sj = assignedShiftCatalog.findIndex((s) => s.shift_id === b.catalog_shift_id);
      if (si !== sj) return si - sj;
      if (a.start_clock !== b.start_clock)
        return a.start_clock.localeCompare(b.start_clock);
      return a.id.localeCompare(b.id);
    });
    return rows;
  }, [assignedShiftCatalog, assignedByShift]);

  const filteredRoster = useMemo(
    () =>
      effectiveShiftFilter
        ? rosterRows.filter((r) => r.catalog_shift_id === effectiveShiftFilter)
        : rosterRows,
    [rosterRows, effectiveShiftFilter],
  );

  const dialogShift = dialogShiftId
    ? assignedShiftCatalog.find((s) => s.shift_id === dialogShiftId) ?? null
    : null;
  const dialogAgents = dialogShiftId ? assignedByShift[dialogShiftId] ?? [] : [];

  const totalAssigned = rosterRows.length;
  const hasAssignedShifts = assignedShiftCatalog.length > 0;

  return (
    <div className="space-y-5">
      <SectionCard
        accentColor="#d97706"
        title="Shift template catalog"
        description="Operational time blocks that define when voice and back-office work occurs. Only templates with roster assignments appear below."
      >
        <div className="mb-4 rounded-md border border-amber-200/80 bg-amber-100/50 p-3 text-xs font-medium text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
          <span className="font-semibold text-amber-950 dark:text-amber-100">
            Assigned counts.
          </span>{" "}
          Totals include everyone scheduled on each time block — CSAs on phones plus
          NDS/SDS schedulers on the same hours. CSA headcount across all shifts remains
          fixed at 36.
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mr-1">
            Segment key
          </span>
          {(["Voice", "Break", "Lunch"] as const).map((kind) => (
            <span
              key={kind}
              className="inline-flex items-center gap-1 rounded-full border bg-background/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: segmentKindColor(kind) }}
              />
              {kind}
            </span>
          ))}
        </div>

        {!hasAssignedShifts ? (
          <div className="rounded-md border border-dashed bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
            No shift templates currently have roster assignments.
          </div>
        ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[140px]">Shift</TableHead>
                <TableHead className="w-[108px]">Clock window</TableHead>
                <TableHead className="w-[72px] hidden lg:table-cell">Class</TableHead>
                <TableHead className="w-[72px]">Days</TableHead>
                <TableHead className="min-w-[80px] hidden md:table-cell">On 24h clock</TableHead>
                <TableHead className="min-w-[120px]">Day structure</TableHead>
                <TableHead className="w-[88px] text-right hidden sm:table-cell">Hours</TableHead>
                <TableHead className="w-[120px] text-right">Assigned</TableHead>
                <TableHead className="w-[40px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignedShiftCatalog.map((s) => {
                const agentsHere = assignedByShift[s.shift_id] ?? [];
                const counts = roleCounts(agentsHere);
                const dot = shiftColor(s.shift_id);
                const active = effectiveShiftFilter === s.shift_id;
                return (
                  <TableRow
                    key={s.shift_id}
                    className={cn(
                      "cursor-pointer transition-colors",
                      active && "bg-amber-50/80 dark:bg-amber-950/25",
                    )}
                    onClick={() =>
                      setShiftFilter((prev) =>
                        prev === s.shift_id ? null : s.shift_id,
                      )
                    }
                  >
                    <TableCell className="py-2.5">
                      <div className="flex items-start gap-2 min-w-0">
                        <span
                          className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{ background: dot }}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-sm leading-tight truncate">
                            {s.shift_id}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 font-mono text-xs whitespace-nowrap">
                      {s.start_clock}–{s.end_clock}
                    </TableCell>
                    <TableCell className="py-2.5 hidden lg:table-cell">
                      <Badge variant="secondary" className="text-[10px] font-mono px-1.5">
                        {s.shift_class}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {s.days}
                    </TableCell>
                    <TableCell className="py-2.5 hidden md:table-cell">
                      <ShiftClockStrip
                        startClock={s.start_clock}
                        endClock={s.end_clock}
                        color={dot}
                      />
                    </TableCell>
                    <TableCell className="py-2.5 min-w-[120px]">
                      <DayStructureBar
                        segments={s.segments}
                        startClock={s.start_clock}
                        endClock={s.end_clock}
                        variant="compact"
                      />
                    </TableCell>
                    <TableCell className="py-2.5 text-right hidden sm:table-cell">
                      <span className="text-xs num block">{f1(s.productive_minutes / 60)}h</span>
                      <span className="text-[10px] text-muted-foreground num">
                        {f1(s.gross_minutes / 60)}g
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Badge variant="outline" className="text-[10px] num px-1.5">
                          {counts.total}
                        </Badge>
                        {counts.csa > 0 && (
                          <Badge variant="success" className="text-[10px] px-1.5">
                            {counts.csa} CSA
                          </Badge>
                        )}
                        {counts.nds > 0 && (
                          <Badge variant="info" className="text-[10px] px-1.5">
                            {counts.nds} NDS
                          </Badge>
                        )}
                        {counts.sds > 0 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 text-violet-700 border-violet-200 dark:text-violet-300 dark:border-violet-800"
                          >
                            {counts.sds} SDS
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 pr-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        aria-label={`View ${s.shift_id} roster detail`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDialogShiftId(s.shift_id);
                        }}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        )}

        {hasAssignedShifts && (
        <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
          Select a row to filter the roster below. The chevron opens the full assignment
          table for that template.
        </p>
        )}
      </SectionCard>

      <SectionCard
        title="Roster by shift"
        description={`${totalAssigned} people mapped to catalog templates. Filter by shift to inspect pod and supervisor placement.`}
        toolbar={
          hasAssignedShifts ? (
          <div className="flex flex-wrap gap-1.5 max-w-full">
            <Button
              type="button"
              variant={effectiveShiftFilter === null ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs rounded-full shrink-0"
              onClick={() => setShiftFilter(null)}
            >
              All shifts
            </Button>
            {assignedShiftCatalog.map((s) => {
              const dot = shiftColor(s.shift_id);
              const active = effectiveShiftFilter === s.shift_id;
              return (
                <Button
                  key={s.shift_id}
                  type="button"
                  variant={active ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs rounded-full shrink-0 gap-1.5"
                  onClick={() =>
                    setShiftFilter((prev) =>
                      prev === s.shift_id ? null : s.shift_id,
                    )
                  }
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full shrink-0"
                    style={{ background: active ? "currentColor" : dot }}
                  />
                  {s.shift_id}
                </Button>
              );
            })}
          </div>
          ) : undefined
        }
      >
        {!hasAssignedShifts ? (
          <div className="rounded-md border border-dashed bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
            No agents are mapped to shift templates in this snapshot.
          </div>
        ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Agent</TableHead>
                <TableHead>Shift template</TableHead>
                <TableHead className="hidden md:table-cell">Clock</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden sm:table-cell">Pod</TableHead>
                <TableHead className="hidden lg:table-cell">Supervisor</TableHead>
                <TableHead className="hidden xl:table-cell">Off pair</TableHead>
                <TableHead className="hidden xl:table-cell">Works days</TableHead>
                <TableHead className="text-right hidden md:table-cell">Eff. h/wk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRoster.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <AgentLink agentId={a.id} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-sm"
                        style={{ background: shiftColor(a.catalog_shift_id) }}
                      />
                      <span className="text-sm font-medium font-mono truncate">
                        {a.catalog_shift_id}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell font-mono text-xs whitespace-nowrap">
                    {a.start_clock}–{a.end_clock}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {a.role} {a.position}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">{a.pod}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">
                    {a.supervisor_id && a.supervisor_id !== "—" ? (
                      <AgentLink agentId={a.supervisor_id} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                    {a.off_pair ?? "—"}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-xs text-muted-foreground max-w-[140px] truncate">
                    {(a.works_days ?? []).join(", ")}
                  </TableCell>
                  <TableCell className="text-right num hidden md:table-cell">
                    {a.effective_hours_per_week
                      ? f1(a.effective_hours_per_week)
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {filteredRoster.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-muted-foreground py-8"
                  >
                    No agents match the selected shift filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        )}
      </SectionCard>

      <SectionCard
        title="Alternative scheduling strategy"
        description="LT10 compressed workweeks and in-office split shifts under the 36-FTE headcount cap."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border rounded-lg p-5 bg-card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500" />
                Compressed Workweeks (LT10 Model)
              </h3>
              <Badge
                variant="secondary"
                className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200"
              >
                4 Days × 10 Hours
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              LT10: 4 days × 10 hours per agent. Weekly total 40.0 h with no overtime.
              Scheduled off days: Wed, Thu, Sun.
            </p>

            <div className="text-xs space-y-2 border-t pt-3 font-medium text-muted-foreground">
              <div className="flex justify-between">
                <span>Weekly Hours per Agent:</span>
                <span className="font-mono text-foreground">40.0 h (No Overtime)</span>
              </div>
              <div className="flex justify-between">
                <span>Rostered Days Off:</span>
                <span className="font-mono text-foreground">Wed, Thu, Sun</span>
              </div>
              <div className="flex justify-between">
                <span>Monday Capacity Gain:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                  +2.0 productive hours per agent
                </span>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-5 bg-card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
                In-Office Split Shifts (Transit/Hospitality)
              </h3>
              <Badge
                variant="secondary"
                className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200"
              >
                Double Peak Overlay
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              In-office split: Leg 1 04:30–08:30, Leg 2 12:30–16:30. Unpaid off-clock gap
              08:30–12:30 (4.0 h).
            </p>

            <div className="text-xs space-y-2 border-t pt-3 font-medium text-muted-foreground">
              <div className="flex justify-between">
                <span>Shift Leg 1 (Morning):</span>
                <span className="font-mono text-foreground">04:30 – 08:30 (4.0 h)</span>
              </div>
              <div className="flex justify-between">
                <span>Shift Leg 2 (Afternoon):</span>
                <span className="font-mono text-foreground">12:30 – 16:30 (4.0 h)</span>
              </div>
              <div className="flex justify-between">
                <span>Midday Idle Savings:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                  4.0 h unpaid gap (08:30–12:30)
                </span>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <Dialog
        open={dialogShift !== null}
        onOpenChange={(o) => !o && setDialogShiftId(null)}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          {dialogShift && (
            <ShiftDetail shift={dialogShift} agents={dialogAgents} />
          )}
        </DialogContent>
      </Dialog>
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
            className="inline-block w-3 h-3 rounded-sm"
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
            <Clock className="h-3 w-3 mr-1" />
            {shift.start_clock}–{shift.end_clock}
          </Badge>
          <Badge variant="secondary">{shift.days}</Badge>
          <Badge variant="secondary">{shift.shift_class}</Badge>
          <Badge variant="secondary">
            {f1(shift.gross_minutes / 60)} h gross ·{" "}
            {f1(shift.productive_minutes / 60)} h productive
          </Badge>
          <Badge variant="outline">
            <Users className="h-3 w-3 mr-1" />
            {counts.total} on shift
          </Badge>
          {counts.csa > 0 && <Badge variant="success">{counts.csa} CSA</Badge>}
          {counts.nds > 0 && <Badge variant="info">{counts.nds} NDS</Badge>}
          {counts.sds > 0 && (
            <Badge
              variant="outline"
              className="text-violet-700 border-violet-200 dark:text-violet-300 dark:border-violet-800"
            >
              {counts.sds} SDS
            </Badge>
          )}
        </div>

        <div className="rounded-lg border bg-muted/15 p-4 space-y-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Day structure
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              Voice, break, and lunch blocks for this shift template. Every agent
              assigned to {shift.shift_id} follows the same segment pattern.
            </p>
          </div>
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
            <TableHead>Pod</TableHead>
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
              <TableCell className="text-sm">{a.pod}</TableCell>
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
                className="text-center text-muted-foreground py-6"
              >
                No agents currently assigned to this shift template.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
