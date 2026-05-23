"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Clock, Users } from "lucide-react";
import { SectionCard } from "@/components/shared/section-card";
import { Badge } from "@/components/ui/badge";
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
import { f1 } from "@/lib/utils";
import type {
  Agent,
  ShiftCatalogEntry,
  Snapshot,
} from "@/lib/data/types";

interface ShiftsTabProps {
  snapshot: Snapshot;
}

interface AssignedAgent extends Agent {
  pod: string;
  supervisor_id: string;
}

export function ShiftsTab({ snapshot }: ShiftsTabProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const assignedByShift = useMemo<Record<string, AssignedAgent[]>>(() => {
    const out: Record<string, AssignedAgent[]> = {};
    for (const s of snapshot.shift_catalog) out[s.shift_id] = [];
    for (const agent of snapshot.agents) {
      const baseId = agent.shift_class;
      if (!out[baseId]) continue;
      const podEntry = Object.entries(snapshot.pods).find(([, p]) =>
        p.members.includes(agent.id),
      );
      out[baseId].push({
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

  const selectedShift = selected
    ? snapshot.shift_catalog.find((s) => s.shift_id === selected) ?? null
    : null;
  const selectedAgents = selected ? assignedByShift[selected] : [];

  return (
    <div className="space-y-5">
      <SectionCard
        title="Shift catalog"
        description="Click any shift template to see the people currently assigned to it."
        bgImage="/28.jpg"
        bgImageOpacity={0.06}
      >
        <div className="bg-amber-100/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-md p-3 text-xs text-amber-950 dark:text-amber-200 mb-4 font-medium">
          <span className="font-semibold text-amber-950 dark:text-amber-100">Reading the count.</span>{" "}
          &ldquo;Assigned&rdquo; totals everyone scheduled on that time block —
          CSAs answer calls, Schedulers (NDS/SDS) do back-office work on the
          same hours. The breakdown is shown on each card. CSA total across all
          shifts is fixed at 36.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {snapshot.shift_catalog.map((s) => {
            const agentsHere = assignedByShift[s.shift_id];
            const csaN = agentsHere.filter((a) => a.role === "CSA").length;
            const ndsN = agentsHere.filter((a) => a.role === "NDS").length;
            const sdsN = agentsHere.filter((a) => a.role === "SDS").length;
            const dot = shiftColor(s.shift_id);
            return (
              <button
                key={s.shift_id}
                type="button"
                onClick={() => setSelected(s.shift_id)}
                className="text-left bg-card border rounded-lg p-4 transition hover:shadow-md hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-semibold flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-sm"
                      style={{ background: dot }}
                    />
                    {s.shift_id}
                  </h3>
                  <span className="text-sm font-semibold num">
                    {agentsHere.length} on shift
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {s.label} · {s.start_clock}-{s.end_clock} · {s.days}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  {csaN ? (
                    <Badge variant="success">{csaN} CSA</Badge>
                  ) : null}
                  {ndsN ? (
                    <Badge variant="info">{ndsN} NDS</Badge>
                  ) : null}
                  {sdsN ? (
                    <Badge
                      variant="outline"
                      className="text-violet-700 border-violet-200 dark:text-violet-300 dark:border-violet-800"
                    >
                      {sdsN} SDS
                    </Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  {s.rationale}
                </p>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {f1(s.productive_minutes / 60)} h productive
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-primary">
                    View detail
                    <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="Alternative scheduling strategy"
        description="Compressed workweeks and split shifts designed to combat peak intervals under the 36-FTE headcount cap."
        bgImage="/28.jpg"
        bgImageOpacity={0.03}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border rounded-lg p-5 bg-card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500" />
                Compressed Workweeks (LT10 Model)
              </h3>
              <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200">
                4 Days × 10 Hours
              </Badge>
            </div>
            
            <p className="text-sm text-muted-foreground leading-relaxed">
              Transitioning a portion of the rostered workforce to 10-hour shifts (LT10) concentrates capacity on high-demand days (Mondays, Tuesdays, Fridays, and Saturdays).
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
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">+2.0 productive hours per agent</span>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-5 bg-card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
                In-Office Split Shifts (Transit/Hospitality)
              </h3>
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                Double Peak Overlay
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              A voluntary, biddable in-office split shift covers the early-morning booking ramp and afternoon return wave with a 4-hour unpaid off-the-clock block.
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
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">4.0 h unpaid gap (08:30–12:30)</span>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <Dialog
        open={selectedShift !== null}
        onOpenChange={(o) => !o && setSelected(null)}
      >
        <DialogContent>
          {selectedShift && (
            <ShiftDetail shift={selectedShift} agents={selectedAgents} />
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
  const csaN = agents.filter((a) => a.role === "CSA").length;
  const ndsN = agents.filter((a) => a.role === "NDS").length;
  const sdsN = agents.filter((a) => a.role === "SDS").length;
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ background: shiftColor(shift.shift_id) }}
          />
          {shift.label}{" "}
          <span className="text-muted-foreground font-mono text-base">
            ({shift.shift_id})
          </span>
        </DialogTitle>
        <DialogDescription>{shift.rationale}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          {shift.start_clock}–{shift.end_clock}
        </Badge>
        <Badge variant="secondary">{shift.days}</Badge>
        <Badge variant="secondary">
          {f1(shift.gross_minutes / 60)} h gross · {f1(shift.productive_minutes / 60)} h productive
        </Badge>
        <Badge variant="outline">
          <Users className="h-3 w-3 mr-1" />
          {agents.length} on shift
        </Badge>
        {csaN > 0 && <Badge variant="success">{csaN} CSA</Badge>}
        {ndsN > 0 && <Badge variant="info">{ndsN} NDS</Badge>}
        {sdsN > 0 && (
          <Badge
            variant="outline"
            className="text-violet-700 border-violet-200 dark:text-violet-300 dark:border-violet-800"
          >
            {sdsN} SDS
          </Badge>
        )}
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
              <TableCell className="font-mono text-xs">{a.id}</TableCell>
              <TableCell className="text-sm">
                {a.role} {a.position}
              </TableCell>
              <TableCell className="text-sm">{a.pod}</TableCell>
              <TableCell className="font-mono text-xs">
                {a.supervisor_id}
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
              <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                No agents currently assigned to this shift template.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
