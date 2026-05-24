"use client";

import { useMemo, useState } from "react";
import { useQueryState, parseAsString } from "nuqs";
import {
  ArrowDown,
  ArrowUp,
  ArrowRight,
  Clock,
  Users,
  PhoneCall,
  UserCheck,
  Building,
} from "lucide-react";
import { AgentLink } from "@/components/agent/agent-link";
import { TeamLink } from "@/components/team/team-link";
import { SectionCard } from "@/components/shared/section-card";
import { DayTabs } from "@/components/shared/day-tabs";
import { StatTile } from "@/components/charts/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { csaSupply, getAgentsOnDuty } from "@/lib/compute/supply";
import { getLegacyCsaSupply, getLegacyOnDutyStaff } from "@/lib/compute/legacy-supply";
import { balanceTone, roleBadgeClass } from "@/lib/compute/colors";
import { f0, f1, pct } from "@/lib/utils";
import {
  CSA_FUNCTIONS,
  DOW_LIST,
  type DOW,
  type FunctionName,
} from "@/lib/data/types";
import type { Snapshot } from "@/lib/data/types";
import { cn } from "@/lib/utils";

interface ValidationTabProps {
  snapshot: Snapshot;
  leadPct: number;
}

function displayOperationalRole(role: string, position: string): string {
  if (role === "Supervisor") return "Supervisor";
  if (role === "CSA") return position === "Lead" ? "CSA Lead" : "CSA";
  if (role === "SDS") return position === "Lead" ? "SDS Lead" : "SDS";
  if (role === "NDS") return "NDS";
  return role;
}

interface HourRow {
  hour: string;
  calls: number;
  staff: number;
  legacyStaff: number;
  volShare: number;
  staffShare: number;
  legacyStaffShare: number;
  ratio: number;
  legacyRatio: number;
}

export function ValidationTab({ snapshot, leadPct }: ValidationTabProps) {
  const [fn, setFn] = useState<FunctionName>("Combined");
  const [day, setDay] = useState<DOW>("Mon");
  const [viewMode, setViewMode] = useState<"proposed" | "legacy" | "compare">("proposed");
  const [, setTab] = useQueryState("tab");
  const [, setOnShift] = useQueryState("onShift");
  const [, setGlobalSearch] = useQueryState(
    "search",
    parseAsString.withDefault(""),
  );

  const [activeHour, setActiveHour] = useState<string | null>(null);

  const drillToRoster = (hour: string) => {
    const hh = hour.slice(0, 2);
    setOnShift(hh);
    setGlobalSearch(""); // clear search when drilling to entire hour
    setTab("roster");
  };

  // Helper map to find which pod an agent belongs to
  const agentPodMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [podName, pod] of Object.entries(snapshot.pods)) {
      for (const memberId of pod.members) {
        map[memberId] = podName;
      }
    }
    return map;
  }, [snapshot.pods]);

  // Compute hourly metrics for both proposed and legacy schedules
  const data = useMemo(() => {
    const out: Record<
      DOW,
      { hourlyOff: number[]; hourlySup: number[]; hourlyLegacySup: number[] }
    > = {} as Record<
      DOW,
      { hourlyOff: number[]; hourlySup: number[]; hourlyLegacySup: number[] }
    >;
    for (const d of DOW_LIST) {
      const offCombined = snapshot.volume.offered_per_interval.Combined[d];
      const offFn =
        fn === "Combined"
          ? offCombined
          : snapshot.volume.offered_per_interval[fn][d];
      const csa = csaSupply(snapshot.agents, d, leadPct);
      const legacyCsa = getLegacyCsaSupply(d);
      
      const supFn =
        fn === "Combined"
          ? csa
          : csa.map((v, i) =>
              offCombined[i] ? v * (offFn[i] / offCombined[i]) : 0,
            );
            
      const legacySupFn =
        fn === "Combined"
          ? legacyCsa
          : legacyCsa.map((v, i) =>
              offCombined[i] ? v * (offFn[i] / offCombined[i]) : 0,
            );

      const hourlyOff = Array.from(
        { length: 24 },
        (_, h) => offFn[h * 2] + offFn[h * 2 + 1],
      );
      const hourlySup = Array.from(
        { length: 24 },
        (_, h) => (supFn[h * 2] + supFn[h * 2 + 1]) / 2,
      );
      const hourlyLegacySup = Array.from(
        { length: 24 },
        (_, h) => (legacySupFn[h * 2] + legacySupFn[h * 2 + 1]) / 2,
      );
      
      out[d] = { hourlyOff, hourlySup, hourlyLegacySup };
    }
    return out;
  }, [snapshot, fn, leadPct]);

  const dayData = data[day];
  const hourlyOff = dayData.hourlyOff;
  const hourlySup = dayData.hourlySup;
  const hourlyLegacySup = dayData.hourlyLegacySup;
  const dayCalls = hourlyOff.reduce((s, v) => s + v, 0);
  const dayStaff = hourlySup.reduce((s, v) => s + v, 0);
  const dayLegacyStaff = hourlyLegacySup.reduce((s, v) => s + v, 0);
  const offTotal = dayCalls || 1;
  const supTotal = dayStaff || 1;
  const legacySupTotal = dayLegacyStaff || 1;

  const rows: HourRow[] = snapshot.meta.hours.map((h, idx) => {
    const calls = hourlyOff[idx];
    const staff = hourlySup[idx];
    const legacyStaff = hourlyLegacySup[idx];
    const volShare = calls / offTotal;
    const staffShare = staff / supTotal;
    const legacyStaffShare = legacyStaff / legacySupTotal;
    const ratio = volShare ? staffShare / volShare : staffShare > 0 ? 99 : 1;
    const legacyRatio = volShare ? legacyStaffShare / volShare : legacyStaffShare > 0 ? 99 : 1;
    return { hour: h, calls, staff, legacyStaff, volShare, staffShare, legacyStaffShare, ratio, legacyRatio };
  });

  const matched = rows.reduce(
    (acc, r) => acc + Math.min(r.volShare, r.staffShare),
    0,
  );
  const underServed = rows.filter((r) => r.volShare > 0 && r.ratio < 0.6).length;
  
  const legacyMatched = rows.reduce(
    (acc, r) => acc + Math.min(r.volShare, r.legacyStaffShare),
    0,
  );
  const legacyUnderServed = rows.filter((r) => r.volShare > 0 && r.legacyRatio < 0.6).length;

  const worst = useMemo(() => {
    return [...rows]
      .filter((r) => r.volShare > 0)
      .sort((a, b) => {
        const ratioA = viewMode === "legacy" ? a.legacyRatio : a.ratio;
        const ratioB = viewMode === "legacy" ? b.legacyRatio : b.ratio;
        return ratioA - ratioB;
      })
      .slice(0, 3);
  }, [rows, viewMode]);

  const over = useMemo(() => {
    return [...rows]
      .filter((r) => r.volShare > 0)
      .sort((a, b) => {
        const ratioA = viewMode === "legacy" ? a.legacyRatio : a.ratio;
        const ratioB = viewMode === "legacy" ? b.legacyRatio : b.ratio;
        return ratioB - ratioA;
      })
      .slice(0, 3);
  }, [rows, viewMode]);

  // Determine the active hour to show detail for (falls back to the worst under-served hour)
  const selectedHour = activeHour ?? worst[0]?.hour ?? "07:00";
  const selectedHourInt = parseInt(selectedHour.split(":")[0], 10);

  // Get exact list of scheduled agents on duty during this specific hour
  const activeStaff = useMemo(() => {
    if (viewMode === "legacy") {
      return getLegacyOnDutyStaff(day, selectedHourInt);
    }
    return getAgentsOnDuty(snapshot.agents, day, selectedHourInt);
  }, [snapshot.agents, day, selectedHourInt, viewMode]);

  return (
    <div className="space-y-5">
      <SectionCard
        title={`Distribution check · ${day} · ${fn}`}
        description="Headcount is fixed. This tab shows whether the scheduled roster is aimed at the hours that actually have calls."
        toolbar={
          <div className="flex flex-wrap gap-3 items-center">
            <div className="inline-flex gap-1 bg-muted p-1 rounded-md">
              <Button
                variant={viewMode === "proposed" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs rounded-sm"
                onClick={() => setViewMode("proposed")}
              >
                Proposed
              </Button>
              <Button
                variant={viewMode === "legacy" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs rounded-sm"
                onClick={() => setViewMode("legacy")}
              >
                Current/Legacy
              </Button>
              <Button
                variant={viewMode === "compare" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs rounded-sm"
                onClick={() => setViewMode("compare")}
              >
                Compare Both
              </Button>
            </div>
            <Select value={fn} onValueChange={(v) => setFn(v as FunctionName)}>
              <SelectTrigger className="w-[150px] h-8 text-sm bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CSA_FUNCTIONS.map((f) => (
                  <SelectItem key={f} value={f || "default"}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DayTabs day={day} onChange={setDay} />
          </div>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile
            label="Calls forecasted"
            value={f0(dayCalls)}
            hint="Forecasted calls in this function on this day."
          />
          <StatTile
            label={viewMode === "compare" ? "Scheduled CSA Hours" : viewMode === "legacy" ? "Legacy CSA Hours" : "Proposed CSA Hours"}
            value={
              viewMode === "compare"
                ? `P: ${f1(dayStaff)} | L: ${f1(dayLegacyStaff)}`
                : viewMode === "legacy"
                  ? f1(dayLegacyStaff)
                  : f1(dayStaff)
            }
            hint="Sum of avg-concurrent CSAs per hour = total CSA voice-hours scheduled that day."
          />
          <StatTile
            label="Volume-matched share"
            value={
              viewMode === "compare"
                ? `P: ${pct(matched)} | L: ${pct(legacyMatched)}`
                : viewMode === "legacy"
                  ? pct(legacyMatched)
                  : pct(matched)
            }
            hint="Higher = better aim against the day's calls."
            tone={
              viewMode === "compare"
                ? undefined
                : (viewMode === "legacy" ? legacyMatched : matched) >= 0.8
                  ? "text-emerald-700 dark:text-emerald-400"
                  : (viewMode === "legacy" ? legacyMatched : matched) >= 0.6
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-rose-700 dark:text-rose-400"
            }
          />
          <StatTile
            label="Hours under-served"
            value={
              viewMode === "compare"
                ? `P: ${underServed} | L: ${legacyUnderServed}`
                : String(viewMode === "legacy" ? legacyUnderServed : underServed)
            }
            hint="Hours where staff share is less than 60% of that hour's call share."
            tone={
              viewMode === "compare"
                ? undefined
                : (viewMode === "legacy" ? legacyUnderServed : underServed) === 0
                  ? "text-emerald-700 dark:text-emerald-400"
                  : (viewMode === "legacy" ? legacyUnderServed : underServed) >= 4
                    ? "text-rose-700 dark:text-rose-400"
                    : "text-amber-700 dark:text-amber-400"
            }
          />
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <SectionCard
          className="lg:col-span-2"
          title={`Hour-by-hour distribution · ${day} · ${fn}`}
          description={
            viewMode === "compare"
              ? "Proposed vs current CSA staffing shape by hour."
              : "Click a row to inspect team and role details for that hour."
          }
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {viewMode === "compare" ? (
                  <TableRow>
                    <TableHead>Hour</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Proposed CSAs</TableHead>
                    <TableHead className="text-right">Current CSAs</TableHead>
                    <TableHead className="text-right">Vol share</TableHead>
                    <TableHead className="text-right">Prop. Share</TableHead>
                    <TableHead className="text-right">Current Share</TableHead>
                    <TableHead className="min-w-[150px]">Shape Comparison</TableHead>
                    <TableHead>Status (Prop)</TableHead>
                    <TableHead>Status (Current)</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                ) : viewMode === "legacy" ? (
                  <TableRow>
                    <TableHead>Hour</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Current CSAs</TableHead>
                    <TableHead className="text-right">Vol share</TableHead>
                    <TableHead className="text-right">Current Share</TableHead>
                    <TableHead className="min-w-[140px]">Shape</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableHead>Hour</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Proposed CSAs</TableHead>
                    <TableHead className="text-right">Vol share</TableHead>
                    <TableHead className="text-right">Prop. Share</TableHead>
                    <TableHead className="min-w-[140px]">Shape</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                )}
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const maxShare = Math.max(r.volShare, r.staffShare, r.legacyStaffShare, 0.001);
                  const widthVol = (r.volShare / maxShare) * 100;
                  const widthStaff = (r.staffShare / maxShare) * 100;
                  const widthLegacyStaff = (r.legacyStaffShare / maxShare) * 100;
                  
                  const toneProposed =
                    r.volShare === 0 && r.staffShare === 0
                      ? {
                          label: "No volume",
                          cls: "text-slate-400 bg-slate-50 dark:text-slate-500 dark:bg-slate-900",
                        }
                      : r.volShare === 0
                        ? {
                            label: "Buffer staff",
                            cls: "text-indigo-700 bg-indigo-50 dark:text-indigo-300 dark:bg-indigo-950",
                          }
                        : balanceTone(r.ratio);
                        
                  const toneLegacy =
                    r.volShare === 0 && r.legacyStaffShare === 0
                      ? {
                          label: "No volume",
                          cls: "text-slate-400 bg-slate-50 dark:text-slate-500 dark:bg-slate-900",
                        }
                      : r.volShare === 0
                        ? {
                            label: "Buffer staff",
                            cls: "text-orange-700 bg-orange-50 dark:text-orange-300 dark:bg-orange-950",
                          }
                        : balanceTone(r.legacyRatio);

                  const isSelected = r.hour === selectedHour;

                  return (
                    <TableRow
                      key={r.hour}
                      onClick={() => setActiveHour(r.hour)}
                      className={cn(
                        "group cursor-pointer transition-colors border-l-2 select-none",
                        isSelected
                          ? "bg-indigo-50/70 dark:bg-indigo-950/35 border-l-indigo-600 dark:border-l-indigo-500"
                          : "border-l-transparent hover:bg-muted/40"
                      )}
                    >
                      <TableCell className="font-mono font-medium">{r.hour}</TableCell>
                      <TableCell className="text-right num font-mono">
                        {f0(r.calls)}
                      </TableCell>
                      
                      {viewMode === "compare" ? (
                        <>
                          <TableCell className="text-right num font-mono text-indigo-600 dark:text-indigo-400">
                            {f1(r.staff)}
                          </TableCell>
                          <TableCell className="text-right num font-mono text-orange-600 dark:text-orange-400">
                            {f1(r.legacyStaff)}
                          </TableCell>
                          <TableCell className="text-right num">
                            {(r.volShare * 100).toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right num text-indigo-600 dark:text-indigo-400">
                            {(r.staffShare * 100).toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right num text-orange-600 dark:text-orange-400">
                            {(r.legacyStaffShare * 100).toFixed(1)}%
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 py-1 min-w-[150px]">
                              <div
                                className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"
                                title={`Calls ${(r.volShare * 100).toFixed(1)}%`}
                              >
                                <div
                                  className="h-full bg-slate-400 dark:bg-slate-500"
                                  style={{ width: `${widthVol}%` }}
                                />
                              </div>
                              <div
                                className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"
                                title={`Proposed ${(r.staffShare * 100).toFixed(1)}%`}
                              >
                                <div
                                  className="h-full bg-indigo-500 dark:bg-indigo-600"
                                  style={{ width: `${widthStaff}%` }}
                                />
                              </div>
                              <div
                                className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"
                                title={`Legacy ${(r.legacyStaffShare * 100).toFixed(1)}%`}
                              >
                                <div
                                  className="h-full bg-orange-500 dark:bg-orange-600"
                                  style={{ width: `${widthLegacyStaff}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${toneProposed.cls}`}>
                              {toneProposed.label}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${toneLegacy.cls}`}>
                              {toneLegacy.label}
                            </span>
                          </TableCell>
                        </>
                      ) : viewMode === "legacy" ? (
                        <>
                          <TableCell className="text-right num font-mono text-orange-600 dark:text-orange-400">
                            {f1(r.legacyStaff)}
                          </TableCell>
                          <TableCell className="text-right num">
                            {(r.volShare * 100).toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right num text-orange-600 dark:text-orange-400">
                            {(r.legacyStaffShare * 100).toFixed(1)}%
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1.5 py-1 min-w-[130px]">
                              <div
                                className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"
                                title={`Calls ${(r.volShare * 100).toFixed(1)}%`}
                              >
                                <div
                                  className="h-full bg-slate-400 dark:bg-slate-500"
                                  style={{ width: `${widthVol}%` }}
                                />
                              </div>
                              <div
                                className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"
                                title={`Legacy ${(r.legacyStaffShare * 100).toFixed(1)}%`}
                              >
                                <div
                                  className="h-full bg-orange-500 dark:bg-orange-600"
                                  style={{ width: `${widthLegacyStaff}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide ${toneLegacy.cls}`}>
                              {toneLegacy.label}
                            </span>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-right num font-mono text-indigo-600 dark:text-indigo-400">
                            {f1(r.staff)}
                          </TableCell>
                          <TableCell className="text-right num">
                            {(r.volShare * 100).toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right num text-indigo-600 dark:text-indigo-400">
                            {(r.staffShare * 100).toFixed(1)}%
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1.5 py-1 min-w-[130px]">
                              <div
                                className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"
                                title={`Calls ${(r.volShare * 100).toFixed(1)}%`}
                              >
                                <div
                                  className="h-full bg-slate-400 dark:bg-slate-500"
                                  style={{ width: `${widthVol}%` }}
                                />
                              </div>
                              <div
                                className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"
                                title={`Proposed ${(r.staffShare * 100).toFixed(1)}%`}
                              >
                                <div
                                  className="h-full bg-indigo-500 dark:bg-indigo-600"
                                  style={{ width: `${widthStaff}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide ${toneProposed.cls}`}>
                              {toneProposed.label}
                            </span>
                          </TableCell>
                        </>
                      )}

                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => drillToRoster(r.hour)}
                          className="opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10"
                          title={r.hour}
                          aria-label={`Drill to roster for ${r.hour}`}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </SectionCard>

        <div className="space-y-5">
          {/* Action Card: Move Staff IN */}
          <SectionCard
            title={
              <span className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                <ArrowDown className="h-4 w-4 shrink-0" />
                Move staff INTO these hours
              </span>
            }
            description="Hours with the most calls relative to scheduled staff. Click to inspect details."
          >
            <div className="space-y-2">
              {worst.map((w) => {
                const isSelected = w.hour === selectedHour;
                const activeRatio = viewMode === "legacy" ? w.legacyRatio : w.ratio;
                const activeStaffVal = viewMode === "legacy" ? w.legacyStaff : w.staff;
                const activeStaffShare = viewMode === "legacy" ? w.legacyStaffShare : w.staffShare;
                
                return (
                  <div
                    key={w.hour}
                    onClick={() => setActiveHour(w.hour)}
                    className={cn(
                      "border rounded-lg p-3 transition-all cursor-pointer select-none",
                      isSelected
                        ? "border-rose-300 bg-rose-50/60 dark:border-rose-800 dark:bg-rose-950/20 shadow-sm ring-1 ring-rose-200 dark:ring-rose-900"
                        : "border-rose-100 bg-rose-50/15 dark:border-rose-950/5 hover:border-rose-300 dark:hover:border-rose-800"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold">{w.hour}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          viewMode === "legacy"
                            ? "text-orange-700 border-orange-200 bg-orange-50 dark:text-orange-300 dark:border-orange-800 dark:bg-orange-950/30"
                            : "text-rose-700 border-rose-200 bg-rose-50 dark:text-rose-300 dark:border-rose-800 dark:bg-rose-950/30"
                        )}
                      >
                        ratio {activeRatio.toFixed(2)}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1.5 leading-normal">
                      <strong className="text-foreground font-semibold">{f0(w.calls)}</strong> calls ({(w.volShare * 100).toFixed(1)}% of day) <br />
                      <strong className="text-foreground font-semibold">{f1(activeStaffVal)}</strong> scheduled ({(activeStaffShare * 100).toFixed(1)}% of day)
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Action Card: Pull Staff OUT */}
          <SectionCard
            title={
              <span className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400">
                <ArrowUp className="h-4 w-4 shrink-0" />
                Pull staff FROM these hours
              </span>
            }
            description="Hours over-served relative to their share of calls. Candidates for shift moves."
          >
            <div className="space-y-2">
              {over.map((w) => {
                const isSelected = w.hour === selectedHour;
                const activeRatio = viewMode === "legacy" ? w.legacyRatio : w.ratio;
                const activeStaffVal = viewMode === "legacy" ? w.legacyStaff : w.staff;
                const activeStaffShare = viewMode === "legacy" ? w.legacyStaffShare : w.staffShare;

                return (
                  <div
                    key={w.hour}
                    onClick={() => setActiveHour(w.hour)}
                    className={cn(
                      "border rounded-lg p-3 transition-all cursor-pointer select-none",
                      isSelected
                        ? "border-indigo-300 bg-indigo-50/60 dark:border-indigo-800 dark:bg-indigo-950/20 shadow-sm ring-1 ring-indigo-200 dark:ring-indigo-900"
                        : "border-indigo-100 bg-indigo-50/15 dark:border-indigo-950/5 hover:border-indigo-300 dark:hover:border-indigo-800"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold">{w.hour}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          viewMode === "legacy"
                            ? "text-orange-700 border-orange-200 bg-orange-50 dark:text-orange-300 dark:border-orange-800 dark:bg-orange-950/30"
                            : "text-indigo-700 border-indigo-200 bg-indigo-50 dark:text-indigo-300 dark:border-indigo-800 dark:bg-indigo-950/30"
                        )}
                      >
                        ratio {activeRatio.toFixed(2)}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1.5 leading-normal">
                      <strong className="text-foreground font-semibold">{f0(w.calls)}</strong> calls ({(w.volShare * 100).toFixed(1)}% of day) <br />
                      <strong className="text-foreground font-semibold">{f1(activeStaffVal)}</strong> scheduled ({(activeStaffShare * 100).toFixed(1)}% of day)
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* New Interactive Panel: Scheduled Staff Details */}
          <SectionCard
            title={
              <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <UserCheck className="h-4 w-4 shrink-0" />
                Active staff details · {selectedHour}
              </span>
            }
            description={
              viewMode === "legacy"
                ? `Legacy CSA staffing on duty at ${selectedHour} · ${day}.`
                : `Team members on duty at ${selectedHour} · ${day}; click ID for profile.`
            }
            toolbar={
              <Badge variant="success" className="font-mono">
                {activeStaff.length} scheduled
              </Badge>
            }
          >
            <div className="max-h-[300px] overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
              {activeStaff.map((info, idx) => {
                const podName = agentPodMap[info.agent.id] || "—";
                const supervisorId = snapshot.pods[podName]?.supervisor_id || "Operations";
                const isPartialHour = info.voiceMinutes < 60;
                
                return (
                  <div
                    key={`${info.agent.id}-${idx}`}
                    className="flex flex-col gap-1.5 p-2.5 border rounded-lg hover:border-border/80 bg-background/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      {viewMode === "legacy" ? (
                        <span className="text-xs font-bold text-foreground px-1.5 py-0.5 bg-muted rounded font-mono">
                          {info.agent.id}
                        </span>
                      ) : (
                        <AgentLink
                          agentId={info.agent.id}
                          className="inline-flex items-center gap-1 bg-primary/5 hover:bg-primary/10 px-1.5 py-0.5 rounded"
                        />
                      )}
                      <div className="flex items-center gap-1.5">
                        {(() => {
                          const label = displayOperationalRole(
                            info.agent.role,
                            info.agent.position,
                          );
                          return (
                            <Badge
                              variant="outline"
                              className={`text-[10px] uppercase font-semibold ${roleBadgeClass(label)}`}
                            >
                              {label}
                            </Badge>
                          );
                        })()}
                        <Badge
                          variant={isPartialHour ? "warning" : "success"}
                          className="font-mono text-[10px] font-semibold"
                        >
                          {info.voiceMinutes}m Voice
                        </Badge>
                      </div>
                    </div>
                    
                    {viewMode !== "legacy" && (
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building className="h-3 w-3 text-muted-foreground/70" />
                          {podName !== "—" ? (
                            <TeamLink teamName={podName} className="text-[11px] font-normal" />
                          ) : (
                            podName
                          )}
                        </span>
                        <span>
                          Supervisor:{" "}
                          {supervisorId !== "Operations" ? (
                            <AgentLink agentId={supervisorId} className="inline font-semibold" />
                          ) : (
                            <strong className="font-semibold font-mono">{supervisorId}</strong>
                          )}
                        </span>
                      </div>
                    )}

                    <div className="text-[10px] text-muted-foreground/80 flex justify-between font-mono pt-0.5 border-t border-dashed">
                      <span>Shift: {info.agent.shift_id}</span>
                      <span>Hours: {info.agent.start_clock}–{info.agent.end_clock}</span>
                    </div>
                  </div>
                );
              })}

              {activeStaff.length === 0 && (
                <div className="text-center text-xs text-muted-foreground py-10 border border-dashed rounded-lg">
                  <Users className="h-6 w-6 mx-auto opacity-40 mb-1.5" />
                  No staff scheduled during this hour.
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>

    </div>
  );
}
