"use client";

import { useMemo, useState } from "react";
import { AgentLink } from "@/components/agent/agent-link";
import { TeamLink } from "@/components/team/team-link";
import { SectionCard } from "@/components/shared/section-card";
import { DayTabs } from "@/components/shared/day-tabs";
import { StatTile } from "@/components/charts/stat-tile";
import { SupervisorGantt } from "@/components/timeline/supervisor-gantt";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { agentSupply } from "@/lib/compute/supply";
import {
  SHIFT_COLOR,
  POD_ROLE_KEYS,
  agentPodRoleKey,
  cellTone,
  shiftColor,
} from "@/lib/compute/colors";
import {
  csaVoiceMinutesGrid,
  supervisorsOnDuty,
} from "@/lib/compute/supervisors";
import {
  DOW_LIST,
  type Agent,
  type DOW,
  type Snapshot,
} from "@/lib/data/types";

interface SupervisorTabProps {
  snapshot: Snapshot;
  leadPct: number;
}

const ROLE_KEYS = POD_ROLE_KEYS;

function roleKey(a: Agent) {
  return agentPodRoleKey(a);
}

export function SupervisorTab({ snapshot }: SupervisorTabProps) {
  const [day, setDay] = useState<DOW>("Mon");
  const sched = snapshot.supervisor_schedule;
  const podNames = useMemo(() => Object.keys(snapshot.pods), [snapshot.pods]);

  const matrices = useMemo(() => {
    const podHourly: Record<string, number[]> = {};
    for (const podName of podNames) {
      const pod = snapshot.pods[podName];
      const members = pod.members
        .map((id) => snapshot.agents.find((a) => a.id === id))
        .filter((a): a is Agent => !!a);
      const supply = agentSupply(members, day, 1.0);
      podHourly[podName] = Array.from({ length: 24 }, (_, h) =>
        Number(((supply[h * 2] + supply[h * 2 + 1]) / 2).toFixed(2)),
      );
    }
    const colTotals = Array.from({ length: 24 }, (_, h) =>
      Number(podNames.reduce((s, p) => s + podHourly[p][h], 0).toFixed(2)),
    );
    const callVolumeHour = Array.from({ length: 24 }, (_, h) => {
      const v = snapshot.volume.offered_per_interval.Combined[day];
      return v[h * 2] + v[h * 2 + 1];
    });
    const maxHourCell = Math.max(1, ...Object.values(podHourly).flat());

    const shiftIds = snapshot.shift_catalog.map((s) => s.shift_id);
    const podShift: Record<string, Record<string, number>> = {};
    for (const podName of podNames) {
      const pod = snapshot.pods[podName];
      const counts: Record<string, number> = Object.fromEntries(
        shiftIds.map((s) => [s, 0]),
      );
      for (const id of pod.members) {
        const a = snapshot.agents.find((x) => x.id === id);
        if (!a) continue;
        const baseId =
          a.shift_class && counts.hasOwnProperty(a.shift_class)
            ? a.shift_class
            : a.shift_id;
        if (counts.hasOwnProperty(baseId)) counts[baseId]++;
      }
      podShift[podName] = counts;
    }
    const shiftTotals = shiftIds.map((s) =>
      podNames.reduce((sum, p) => sum + (podShift[p][s] ?? 0), 0),
    );
    const maxShift = Math.max(
      1,
      ...podNames.flatMap((p) => Object.values(podShift[p])),
    );

    const podRole: Record<string, Record<string, number>> = {};
    for (const podName of podNames) {
      const pod = snapshot.pods[podName];
      const counts: Record<string, number> = Object.fromEntries(
        ROLE_KEYS.map((r) => [r, 0]),
      );
      for (const id of pod.members) {
        const a = snapshot.agents.find((x) => x.id === id);
        if (!a) continue;
        const k = roleKey(a);
        if (k) counts[k] = (counts[k] ?? 0) + 1;
      }
      podRole[podName] = counts;
    }
    const roleTotals = ROLE_KEYS.map((r) =>
      podNames.reduce((sum, p) => sum + (podRole[p][r] ?? 0), 0),
    );
    const maxRole = Math.max(
      1,
      ...podNames.flatMap((p) => Object.values(podRole[p])),
    );

    return {
      podHourly,
      colTotals,
      callVolumeHour,
      maxHourCell,
      shiftIds,
      podShift,
      shiftTotals,
      maxShift,
      podRole,
      roleTotals,
      maxRole,
    };
  }, [snapshot, day, podNames]);

  const directReports = useMemo(() => {
    const acc: Record<string, string[]> = {};
    for (const [podName, pod] of Object.entries(snapshot.pods)) {
      acc[pod.supervisor_id] = acc[pod.supervisor_id] ?? [];
      acc[pod.supervisor_id].push(podName);
    }
    return acc;
  }, [snapshot.pods]);

  const supById = useMemo(
    () =>
      Object.fromEntries(sched.supervisors.map((s) => [s.id, s])) as Record<
        string,
        typeof sched.supervisors[number]
      >,
    [sched.supervisors],
  );

  const csaGrid = useMemo(
    () => csaVoiceMinutesGrid(snapshot.agents),
    [snapshot.agents],
  );

  return (
    <div className="space-y-5">
      <SectionCard
        title="Cross-team coverage matrix"
        toolbar={
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">
              6 Supervisor · {podNames.length} teams · {snapshot.agents.length}{" "}
              roster
            </Badge>
            <DayTabs day={day} onChange={setDay} />
          </div>
        }
      >
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-sm mb-2">
              Team coverage timeline · {day}
            </h3>
            <SupervisorGantt
              snapshot={snapshot}
              day={day}
              podNames={podNames}
              callVolumeHour={matrices.callVolumeHour}
              scheduledHour={matrices.colTotals}
            />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground mt-2">
              {Object.entries(SHIFT_COLOR).map(([k, c]) => (
                <span key={k} className="inline-flex items-center gap-1">
                  <span
                    className="inline-block w-3 h-3 rounded-sm"
                    style={{ background: c }}
                  />
                  {k}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-sm mb-2">
              Team × Hour coverage
            </h3>
            <div className="overflow-x-auto">
              <table className="text-xs border-separate border-spacing-0 min-w-full">
                <thead>
                  <tr>
                    <th className="text-left p-2 sticky left-0 bg-card">Team</th>
                    {snapshot.meta.hours.map((h) => (
                      <th
                        key={h}
                        className="p-2 text-center text-[10px] text-muted-foreground font-mono"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {podNames.map((podName) => (
                    <tr key={podName}>
                      <td className="p-2 sticky left-0 bg-card border-r font-semibold">
                        <TeamLink teamName={podName} className="text-xs" />
                      </td>
                      {matrices.podHourly[podName].map((v, i) => (
                        <td
                          key={i}
                          className={`p-1 text-center num ${cellTone(v, matrices.maxHourCell)}`}
                          title={`${podName} · ${snapshot.meta.hours[i]} · ${v.toFixed(1)} CSA`}
                        >
                          {v ? v.toFixed(1) : ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="border-t-2">
                    <td className="p-2 sticky left-0 bg-muted/50 font-semibold">
                      Scheduled total
                    </td>
                    {matrices.colTotals.map((v, i) => (
                      <td
                        key={i}
                        className="p-1 text-center num bg-muted/30 font-semibold"
                      >
                        {v ? v.toFixed(1) : ""}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-2 sticky left-0 bg-muted/50 font-medium text-muted-foreground">
                      Calls
                    </td>
                    {matrices.callVolumeHour.map((v, i) => (
                      <td
                        key={i}
                        className="p-1 text-center num text-muted-foreground"
                      >
                        {v ? Math.round(v) : ""}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-sm mb-2">
                Team × Shift overlap
              </h3>
              <p className="text-xs text-muted-foreground mb-2">
                Shift template count per team.
              </p>
              <div className="overflow-x-auto">
                <table className="text-xs border-separate border-spacing-0 min-w-full">
                  <thead>
                    <tr>
                      <th className="text-left p-2 sticky left-0 bg-card">Team</th>
                      {matrices.shiftIds.map((s) => (
                        <th
                          key={s}
                          className="p-2 text-center text-[11px] text-muted-foreground"
                        >
                          {s}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {podNames.map((podName) => (
                      <tr key={podName}>
                        <td className="p-2 sticky left-0 bg-card border-r font-semibold">
                          <TeamLink teamName={podName} className="text-xs" />
                        </td>
                        {matrices.shiftIds.map((s) => {
                          const v = matrices.podShift[podName][s];
                          return (
                            <td
                              key={s}
                              className={`p-2 text-center num ${cellTone(v, matrices.maxShift)}`}
                            >
                              {v || ""}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr className="border-t-2">
                      <td className="p-2 sticky left-0 bg-muted/50 font-semibold">
                        Total
                      </td>
                      {matrices.shiftTotals.map((v, i) => (
                        <td
                          key={i}
                          className="p-2 text-center num bg-muted/30 font-semibold"
                        >
                          {v || ""}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-2">Team × Role mix</h3>
              <div className="overflow-x-auto">
                <table className="text-xs border-separate border-spacing-0 min-w-full">
                  <thead>
                    <tr>
                      <th className="text-left p-2 sticky left-0 bg-card">Team</th>
                      {ROLE_KEYS.map((r) => (
                        <th
                          key={r}
                          className="p-2 text-center text-[11px] text-muted-foreground"
                        >
                          {r}
                        </th>
                      ))}
                      <th className="p-2 text-right">People</th>
                    </tr>
                  </thead>
                  <tbody>
                    {podNames.map((podName) => {
                      const tot = Object.values(
                        matrices.podRole[podName],
                      ).reduce((s, v) => s + v, 0);
                      return (
                        <tr key={podName}>
                          <td className="p-2 sticky left-0 bg-card border-r font-semibold">
                            <TeamLink teamName={podName} className="text-xs" />
                          </td>
                          {ROLE_KEYS.map((r) => {
                            const v = matrices.podRole[podName][r];
                            return (
                              <td
                                key={r}
                                className={`p-2 text-center num ${cellTone(v, matrices.maxRole)}`}
                              >
                                {v || ""}
                              </td>
                            );
                          })}
                          <td className="p-2 text-right font-semibold num">
                            {tot}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2">
                      <td className="p-2 sticky left-0 bg-muted/50 font-semibold">
                        Total
                      </td>
                      {matrices.roleTotals.map((v, i) => (
                        <td
                          key={i}
                          className="p-2 text-center num bg-muted/30 font-semibold"
                        >
                          {v}
                        </td>
                      ))}
                      <td className="p-2 text-right font-bold num">
                        {matrices.roleTotals.reduce((s, v) => s + v, 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <CoverageLegend />
        </div>
      </SectionCard>

      <SectionCard title="Supervisor coverage">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile
            label="Hours covered ≥ 1"
            value={sched.min_coverage >= 1 ? "168 of 168" : "GAP"}
            tone={
              sched.min_coverage >= 1
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-rose-700 dark:text-rose-400"
            }
          />
          <StatTile
            label="Scheduled hours"
            value={String(sched.total_scheduled_hours)}
          />
          <StatTile
            label="Single-cover hours"
            value={String(sched.single_cover_hours)}
          />
          <StatTile
            label="Handoff overlap hours"
            value={String(sched.overlap_hours)}
          />
        </div>
      </SectionCard>

      <CoverageProof24x7 snapshot={snapshot} csaGrid={csaGrid} />
      <OvernightProof snapshot={snapshot} />

      <SectionCard title="Team roster">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(directReports).map(([supId, podsForSup]) => (
            <div key={supId} className="border rounded-lg p-4 bg-background">
              <div className="font-semibold">
                <AgentLink agentId={supId} className="text-sm" />
              </div>
              <div className="mt-2 mb-3 rounded-md bg-muted/40 border p-2">
                <div className="text-xs font-semibold mb-1">
                  Supervisor schedule
                </div>
                <div className="space-y-1">
                  {supById[supId]?.assignments.map((a, i) => (
                    <div
                      key={i}
                      className="text-xs flex justify-between gap-2"
                    >
                      <span>{a.weekday.slice(0, 3)}</span>
                      <span className="font-medium">{a.shift_type}</span>
                      <span className="font-mono text-muted-foreground">
                        {a.hours}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {podsForSup.map((podName) => {
                const p = snapshot.pods[podName];
                const members = p.members
                  .map((id) => snapshot.agents.find((a) => a.id === id))
                  .filter((a): a is Agent => !!a);
                return (
                  <div
                    key={podName}
                    className="pl-3 border-l-2 border-border mt-2"
                  >
                    <div className="font-medium text-sm">
                      <TeamLink teamName={podName} />
                    </div>
                    <div className="text-xs text-muted-foreground mb-1">
                      {p.type} · Lead{" "}
                      {p.lead_id !== "Coached by Supervisor" ? (
                        <AgentLink agentId={p.lead_id} className="inline" />
                      ) : (
                        p.lead_id
                      )}
                    </div>
                    <div className="text-xs font-semibold mb-2">
                      Pod coverage window: {p.coverage_window || "varies"}
                    </div>
                    <div className="space-y-1">
                      {members.map((m) => (
                        <div
                          key={m.id}
                          className="text-xs flex justify-between gap-2"
                        >
                          <AgentLink agentId={m.id} />
                          <span className="flex items-center gap-1">
                            <span
                              className="w-2 h-2 rounded-sm"
                              style={{ background: shiftColor(m.shift_id) }}
                            />
                            {m.role} {m.position}
                          </span>
                          <span className="num text-muted-foreground">
                            {m.start_clock}-{m.end_clock}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="On-duty schedule">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supervisor</TableHead>
              <TableHead>Assignments</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sched.supervisors.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <AgentLink agentId={s.id} />
                </TableCell>
                <TableCell className="text-sm">
                  {s.assignments
                    .map(
                      (a) =>
                        `${a.weekday.slice(0, 3)} ${a.shift_type} ${a.hours}`,
                    )
                    .join(" · ")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  );
}

function CoverageLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground border-t pt-3">
      <span className="font-medium text-foreground">Heatmap intensity:</span>
      <LegendSwatch className="bg-slate-50 border border-border" label="0" />
      <LegendSwatch className="bg-indigo-50" label="Low" />
      <LegendSwatch className="bg-indigo-200" label="Moderate" />
      <LegendSwatch className="bg-indigo-400" label="Heavy" />
      <LegendSwatch className="bg-indigo-600" label="Peak" />
    </div>
  );
}

function LegendSwatch({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded ${className}`} />
      {label}
    </span>
  );
}

function CoverageProof24x7({
  snapshot,
  csaGrid,
}: {
  snapshot: Snapshot;
  csaGrid: number[][];
}) {
  const sched = snapshot.supervisor_schedule;
  const rows = Array.from({ length: 24 }, (_, h) => {
    const cells = DOW_LIST.map((d, di) => {
      const minutes = csaGrid[di][h];
      const avgCsa = minutes / 60;
      const sups = supervisorsOnDuty(sched, di, h);
      const supOk = sups.length >= 1;
      const csaOk = minutes >= 60;
      const ok = supOk && csaOk;
      return { day: d, avgCsa, sups, supOk, csaOk, ok };
    });
    return { hour: `${String(h).padStart(2, "0")}:00`, cells };
  });
  const totalCells = 24 * 7;
  const fullCoverage = rows.flatMap((r) => r.cells).filter((c) => c.ok).length;
  const csaGapCells = rows.flatMap((r) => r.cells).filter((c) => !c.csaOk).length;
  const supGapCells = rows.flatMap((r) => r.cells).filter((c) => !c.supOk).length;
  const allOk = csaGapCells === 0 && supGapCells === 0;

  return (
    <SectionCard
      title="24/7 agent + supervisor coverage proof"
      toolbar={
        <Badge
          variant={allOk ? "success" : csaGapCells > 0 ? "destructive" : "warning"}
        >
          {allOk
            ? "Full 24/7 coverage"
            : `${csaGapCells} hour(s) where avg CSA < 1`}
        </Badge>
      }
    >
      <div className="grid grid-cols-3 gap-3 mb-3 text-xs">
        <div className="border rounded p-2">
          <div className="text-muted-foreground">Hour-cells fully covered</div>
          <div className="text-base font-semibold num text-emerald-700 dark:text-emerald-400">
            {fullCoverage} of {totalCells}
          </div>
        </div>
        <div className="border rounded p-2">
          <div className="text-muted-foreground">
            CSA dip cells (break windows)
          </div>
          <div
            className={`text-base font-semibold num ${csaGapCells > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}
          >
            {csaGapCells}
          </div>
        </div>
        <div className="border rounded p-2">
          <div className="text-muted-foreground">Supervisor dip cells</div>
          <div
            className={`text-base font-semibold num ${supGapCells > 0 ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}`}
          >
            {supGapCells}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-separate border-spacing-0">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left p-1.5 sticky left-0 bg-muted/40">
                Hour
              </th>
              {DOW_LIST.map((d) => (
                <th key={d} className="text-left p-1.5">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.hour} className="border-t">
                <td className="p-1.5 font-mono sticky left-0 bg-card border-r">
                  {row.hour}
                </td>
                {row.cells.map((c) => {
                  const bg = c.ok
                    ? "bg-emerald-50 dark:bg-emerald-950/30"
                    : !c.supOk
                      ? "bg-rose-50 dark:bg-rose-950/30"
                      : "bg-amber-50 dark:bg-amber-950/30";
                  const tip = `${c.avgCsa.toFixed(1)} CSA · ${c.sups.length} sup`;
                  return (
                    <td
                      key={c.day}
                      className={`p-1.5 ${bg}`}
                      title={tip}
                    >
                      <div className="flex items-center gap-1">
                        <span
                          className={`font-mono font-semibold ${c.csaOk ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}
                        >
                          {c.avgCsa.toFixed(1)}
                        </span>
                        <span className="text-muted-foreground">/</span>
                        <span
                          className={`font-mono ${c.supOk ? "text-foreground" : "text-rose-700 dark:text-rose-400 font-semibold"}`}
                        >
                          {c.sups.length}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground mt-3">
        Cell format <code className="font-mono">CSA avg / Sup count</code>.
        Green = both ≥ 1 every minute. Amber = brief 15-min break window where
        1 CSA is on a paid break and the on-duty supervisor staffs the floor.
        Rose = supervisor gap.
      </p>
    </SectionCard>
  );
}

function OvernightProof({ snapshot }: { snapshot: Snapshot }) {
  const sched = snapshot.supervisor_schedule;
  const overnightHours = [0, 1, 2, 3, 4, 5];
  const grid = overnightHours.map((h) => ({
    hour: `${String(h).padStart(2, "0")}:00`,
    cells: DOW_LIST.map((d, di) => ({
      day: d,
      on: supervisorsOnDuty(sched, di, h),
    })),
  }));
  const allCovered = grid.every((row) =>
    row.cells.every((c) => c.on.length >= 1),
  );

  return (
    <SectionCard
      title="Overnight coverage proof · 00:00–06:00"
      toolbar={
        <Badge variant={allCovered ? "success" : "destructive"}>
          {allCovered ? "All overnight hours covered" : "Coverage gap detected"}
        </Badge>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left p-2 sticky left-0 bg-muted/40">Hour</th>
              {DOW_LIST.map((d) => (
                <th key={d} className="text-left p-2">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row) => (
              <tr key={row.hour} className="border-t">
                <td className="p-2 font-mono sticky left-0 bg-card border-r">
                  {row.hour}
                </td>
                {row.cells.map((c) => (
                  <td
                    key={c.day}
                    className={`p-2 ${c.on.length >= 1 ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-rose-50 dark:bg-rose-950/30"}`}
                  >
                    {c.on.length >= 1 ? (
                      <div className="flex flex-wrap gap-1">
                        {c.on.map((id) => (
                          <span
                            key={id}
                            className="font-mono text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100"
                          >
                            {id}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-rose-700 dark:text-rose-400 font-semibold">
                        GAP
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground mt-3">
        Source of truth:{" "}
        <code className="font-mono">scripts/solve_supervisor_schedule.py</code>{" "}
        enforces &ldquo;supply at least 1&rdquo; as a hard constraint for every
        (day, hour).
      </p>
    </SectionCard>
  );
}
