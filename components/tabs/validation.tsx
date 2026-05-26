"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Building } from "lucide-react";
import { useQueryState, parseAsString } from "nuqs";
import { AgentLink } from "@/components/agent/agent-link";
import { shiftLengthLabel } from "@/lib/compute/agent-context";
import { TeamLink } from "@/components/team/team-link";
import { SectionCard } from "@/components/shared/section-card";
import { DayTabs } from "@/components/shared/day-tabs";
import { LabelWithHelp } from "@/components/shared/metric-help";
import { StatTile } from "@/components/charts/stat-tile";
import { ValidationCompareChart } from "@/components/charts/validation-compare-chart";
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
import {
  capacityGapStatus,
  computeDayDistribution,
  type DistributionViewMode,
  type HourDistributionRow,
} from "@/lib/compute/distribution";
import {
  WFM_ABANDONED,
  WFM_AHT,
  WFM_ANSWERED_RULE,
  WFM_DATA_SOURCE,
  WFM_ERLANG_REQUIRED,
  WFM_GAP,
  WFM_GAP_HOURS,
  WFM_LEGACY,
  WFM_NO_PER_AGENT_CALLS,
  WFM_OFFERED,
  WFM_PLAN_DELTA,
  WFM_PROPOSED,
} from "@/lib/copy/wfm-tooltips";
import { agentOperationalRole, roleBadgeClass } from "@/lib/compute/colors";
import { getAgentsOnDuty } from "@/lib/compute/supply";
import { getLegacyOnDutyStaff } from "@/lib/compute/legacy-supply";
import { cn, f0, f1, fmtDuration, pct } from "@/lib/utils";
import {
  CSA_FUNCTIONS,
  type DOW,
  type FunctionName,
  type Snapshot,
} from "@/lib/data/types";

interface ValidationTabProps {
  snapshot: Snapshot;
  leadPct: number;
}

function ViewModeToggle({
  value,
  onChange,
}: {
  value: DistributionViewMode;
  onChange: (mode: DistributionViewMode) => void;
}) {
  return (
    <div className="inline-flex gap-1 bg-muted p-1 rounded-md">
      {(
        [
          ["proposed", "Proposed"],
          ["legacy", "Current"],
          ["compare", "Both"],
        ] as const
      ).map(([mode, label]) => (
        <Button
          key={mode}
          variant={value === mode ? "default" : "ghost"}
          size="sm"
          className="h-7 text-xs rounded-sm"
          onClick={() => onChange(mode)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

function headcountDeltaStatus(proposed: number, legacy: number) {
  const delta = proposed - legacy;
  if (Math.abs(delta) < 0.5) {
    return {
      label: "Match" as const,
      cls: "text-muted-foreground bg-muted/50",
    };
  }
  if (delta < 0) {
    return {
      label: "−CSA" as const,
      cls: "text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950",
    };
  }
  return {
    label: "+CSA" as const,
    cls: "text-indigo-700 bg-indigo-50 dark:text-indigo-300 dark:bg-indigo-950",
  };
}

function CapacityBadge({ gap }: { gap: number }) {
  const status = capacityGapStatus(gap);
  return (
    <span
      className={cn(
        "inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide",
        status.cls,
      )}
    >
      {status.label}
    </span>
  );
}

function DeltaBadge({
  proposed,
  legacy,
}: {
  proposed: number;
  legacy: number;
}) {
  const status = headcountDeltaStatus(proposed, legacy);
  return (
    <span
      className={cn(
        "inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide",
        status.cls,
      )}
    >
      {status.label}
    </span>
  );
}

function HourHighlightCard({
  row,
  variant,
  selected,
  onSelect,
}: {
  row: HourDistributionRow;
  variant: "under" | "over";
  selected: boolean;
  onSelect: () => void;
}) {
  const gap = variant === "under" ? row.staffGap : row.staffGap;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left border rounded-lg p-3 transition-colors",
        selected
          ? variant === "under"
            ? "border-rose-300 bg-rose-50/50 dark:border-rose-800 dark:bg-rose-950/25"
            : "border-indigo-300 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-950/25"
          : "border-border/60 hover:border-border hover:bg-muted/30",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold">{row.hour}</span>
        <CapacityBadge gap={gap} />
      </div>
      <div className="mt-1 text-xs text-muted-foreground num tabular-nums">
        {f0(row.calls)} calls · {f0(row.abandoned)} abandoned · gap{" "}
        {gap >= 0 ? "+" : ""}
        {gap.toFixed(1)}
      </div>
      <div className="text-[11px] text-muted-foreground num tabular-nums">
        Req {f1(row.requiredStaff)} · Prop {f1(row.proposedStaff)} · AHT{" "}
        {fmtDuration(row.ahtSeconds)}
      </div>
    </button>
  );
}

export function ValidationTab({ snapshot, leadPct }: ValidationTabProps) {
  const [fn, setFn] = useState<FunctionName>("Combined");
  const [day, setDay] = useState<DOW>("Mon");
  const [viewMode, setViewMode] = useState<DistributionViewMode>("compare");
  const [activeHour, setActiveHour] = useState<string | null>(null);

  const [, setTab] = useQueryState("tab");
  const [, setOnShift] = useQueryState("onShift");
  const [, setGlobalSearch] = useQueryState(
    "search",
    parseAsString.withDefault(""),
  );

  const stats = useMemo(
    () => computeDayDistribution(snapshot, day, fn, leadPct),
    [snapshot, day, fn, leadPct],
  );

  const agentPodMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [podName, pod] of Object.entries(snapshot.pods)) {
      for (const memberId of pod.members) {
        map[memberId] = podName;
      }
    }
    return map;
  }, [snapshot.pods]);

  const understaffed = stats.worstCapacity;
  const overstaffed = stats.overCapacity;

  const selectedHour =
    activeHour ??
    understaffed[0]?.hour ??
    stats.rows.find((r) => r.calls > 0)?.hour ??
    "00:00";
  const selectedHourInt = parseInt(selectedHour.split(":")[0], 10);

  const legacyStaff = useMemo(
    () => getLegacyOnDutyStaff(day, selectedHourInt),
    [day, selectedHourInt],
  );

  const proposedStaff = useMemo(
    () => getAgentsOnDuty(snapshot.agents, day, selectedHourInt),
    [snapshot.agents, day, selectedHourInt],
  );

  const drillToRoster = (hour: string) => {
    setOnShift(hour.slice(0, 2));
    setGlobalSearch("");
    setTab("roster");
  };

  const gapHours =
    viewMode === "legacy" ? stats.gapHoursLegacy : stats.gapHoursProposed;

  const dataSourceNote = useMemo(() => {
    const weeks = snapshot.meta.forecast_weeks?.length
      ? snapshot.meta.forecast_weeks.join(", ")
      : "full ISO weeks in source file";
    return `${WFM_DATA_SOURCE} Source: ${snapshot.meta.source} (${snapshot.meta.source_rows.toLocaleString()} rows). Forecast weeks: ${weeks}.`;
  }, [snapshot.meta]);

  return (
    <div className="space-y-6">
      <SectionCard
        title={
          <LabelWithHelp
            label={`Call load vs staffed capacity · ${day} · ${fn}`}
            help={
              <>
                <p>{dataSourceNote}</p>
                <p className="mt-2">{WFM_NO_PER_AGENT_CALLS}</p>
              </>
            }
          />
        }
        description="Hourly offered volume vs Erlang-required CSAs vs proposed Voice headcount. Hover (?) icons for definitions."
        toolbar={
          <div className="flex flex-wrap gap-2 items-center">
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
            <Select value={fn} onValueChange={(v) => setFn(v as FunctionName)}>
              <SelectTrigger className="w-[140px] h-8 text-sm bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CSA_FUNCTIONS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DayTabs day={day} onChange={setDay} />
          </div>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <StatTile
            label="Daily offered calls"
            value={f0(stats.dayCalls)}
            tooltip={
              <>
                <p>{WFM_OFFERED}</p>
                <p className="mt-1.5">{WFM_ANSWERED_RULE}</p>
              </>
            }
          />
          <StatTile
            label="Daily abandoned"
            value={f0(stats.dayAbandoned)}
            hint={`${pct(stats.dayAbandonRate)} abandon rate`}
            tooltip={WFM_ABANDONED}
            tone={
              stats.dayAbandonRate >= 0.5
                ? "text-rose-700 dark:text-rose-400"
                : stats.dayAbandonRate >= 0.35
                  ? "text-amber-700 dark:text-amber-400"
                  : undefined
            }
          />
          <StatTile
            label="Avg AHT (handled)"
            value={fmtDuration(stats.avgAhtSeconds)}
            tooltip={WFM_AHT}
          />
          <StatTile
            label="Gap hours (req > staff)"
            value={
              viewMode === "compare"
                ? `P ${stats.gapHoursProposed} · C ${stats.gapHoursLegacy}`
                : String(gapHours)
            }
            tooltip={WFM_GAP_HOURS}
            tone={
              viewMode === "compare"
                ? undefined
                : gapHours === 0
                  ? "text-emerald-700 dark:text-emerald-400"
                  : gapHours >= 4
                    ? "text-rose-700 dark:text-rose-400"
                    : "text-amber-700 dark:text-amber-400"
            }
          />
        </div>

        <ValidationCompareChart
          rows={stats.rows}
          viewMode={viewMode}
          selectedHour={selectedHour}
          onHourSelect={setActiveHour}
        />
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <SectionCard
          className="lg:col-span-2"
          title={
            <LabelWithHelp
              label="Hour matrix"
              help={
                <>
                  <p>{WFM_ERLANG_REQUIRED}</p>
                  <p className="mt-1.5">{WFM_PROPOSED}</p>
                  <p className="mt-1.5">{WFM_GAP}</p>
                </>
              }
            />
          }
          description="Req / Prop / Gap / Curr / Plan Δ — hover column headers for each definition."
        >
          <div className="overflow-x-auto -mx-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hour</TableHead>
                  <TableHead className="text-right">
                    <LabelWithHelp
                      className="justify-end"
                      label="Calls"
                      help={WFM_OFFERED}
                      helpLabel="Calls definition"
                    />
                  </TableHead>
                  <TableHead className="text-right">
                    <LabelWithHelp
                      className="justify-end"
                      label="Abnd"
                      help={WFM_ABANDONED}
                      helpLabel="Abandoned definition"
                    />
                  </TableHead>
                  <TableHead className="text-right">
                    <LabelWithHelp
                      className="justify-end"
                      label="AHT"
                      help={WFM_AHT}
                      helpLabel="AHT definition"
                    />
                  </TableHead>
                  <TableHead className="text-right">
                    <LabelWithHelp
                      className="justify-end"
                      label="Req"
                      help={WFM_ERLANG_REQUIRED}
                      helpLabel="Required definition"
                    />
                  </TableHead>
                  <TableHead className="text-right">
                    <LabelWithHelp
                      className="justify-end"
                      label="Prop"
                      help={WFM_PROPOSED}
                      helpLabel="Proposed definition"
                    />
                  </TableHead>
                  <TableHead className="text-right">
                    <LabelWithHelp
                      className="justify-end"
                      label="Gap"
                      help={WFM_GAP}
                      helpLabel="Gap definition"
                    />
                  </TableHead>
                  <TableHead>
                    <LabelWithHelp label="Status" help={WFM_GAP} helpLabel="Status definition" />
                  </TableHead>
                  <TableHead className="text-right">
                    <LabelWithHelp
                      className="justify-end"
                      label="Curr"
                      help={WFM_LEGACY}
                      helpLabel="Current roster definition"
                    />
                  </TableHead>
                  <TableHead>
                    <LabelWithHelp
                      label="Plan Δ"
                      help={WFM_PLAN_DELTA}
                      helpLabel="Plan delta definition"
                    />
                  </TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.rows.map((row) => {
                  const isSelected = row.hour === selectedHour;

                  return (
                    <TableRow
                      key={row.hour}
                      onClick={() => setActiveHour(row.hour)}
                      className={cn(
                        "group cursor-pointer border-l-2 transition-colors",
                        isSelected
                          ? "bg-indigo-50/60 dark:bg-indigo-950/30 border-l-indigo-600"
                          : "border-l-transparent hover:bg-muted/40",
                      )}
                    >
                      <TableCell className="font-mono font-medium">
                        {row.hour}
                      </TableCell>
                      <TableCell className="text-right num font-mono">
                        {f0(row.calls)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right num font-mono",
                          row.abandoned > 0 &&
                            row.abandonRate >= 0.5 &&
                            "text-rose-600 dark:text-rose-400",
                        )}
                      >
                        {f0(row.abandoned)}
                      </TableCell>
                      <TableCell className="text-right num font-mono text-muted-foreground">
                        {fmtDuration(row.ahtSeconds)}
                      </TableCell>
                      <TableCell className="text-right num font-mono text-amber-700 dark:text-amber-400">
                        {f1(row.requiredStaff)}
                      </TableCell>
                      <TableCell className="text-right num font-mono text-indigo-600 dark:text-indigo-400">
                        {f1(row.proposedStaff)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right num font-mono font-medium",
                          row.staffGap < -0.5
                            ? "text-rose-600 dark:text-rose-400"
                            : row.staffGap > 0.5
                              ? "text-indigo-600 dark:text-indigo-400"
                              : "text-muted-foreground",
                        )}
                      >
                        {row.staffGap >= 0 ? "+" : ""}
                        {row.staffGap.toFixed(1)}
                      </TableCell>
                      <TableCell>
                        <CapacityBadge gap={row.staffGap} />
                      </TableCell>
                      <TableCell className="text-right num font-mono text-orange-600 dark:text-orange-400">
                        {f1(row.legacyStaff)}
                      </TableCell>
                      <TableCell>
                        <DeltaBadge
                          proposed={row.proposedStaff}
                          legacy={row.legacyStaff}
                        />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => drillToRoster(row.hour)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-opacity"
                          title={`${row.hour} · roster`}
                          aria-label={`Open roster for ${row.hour}`}
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

        <aside className="space-y-5">
          <SectionCard
            title={
              <LabelWithHelp
                label="Understaffed hours"
                help="Hours where Proposed Voice headcount is below Erlang Required (negative Gap). Does not imply a specific abandon rate — Erlang assumes 80/20 service level at Required."
              />
            }
          >
            <div className="space-y-2">
              {understaffed.length > 0 ? (
                understaffed.map((row) => (
                  <HourHighlightCard
                    key={row.hour}
                    row={row}
                    variant="under"
                    selected={row.hour === selectedHour}
                    onSelect={() => setActiveHour(row.hour)}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">None</p>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title={
              <LabelWithHelp
                label="Overstaffed hours"
                help="Hours where Proposed exceeds Erlang Required (positive Gap). Extra Voice capacity vs the Erlang model, not necessarily waste — cubicle and coverage rules may require it."
              />
            }
          >
            <div className="space-y-2">
              {overstaffed.length > 0 ? (
                overstaffed.map((row) => (
                  <HourHighlightCard
                    key={row.hour}
                    row={row}
                    variant="over"
                    selected={row.hour === selectedHour}
                    onSelect={() => setActiveHour(row.hour)}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">None</p>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title={
              <LabelWithHelp
                label={`On duty · ${selectedHour}`}
                help={
                  <>
                    <p>{WFM_PROPOSED}</p>
                    <p className="mt-1.5">
                      Voice minutes = time in Voice segments during the selected clock hour on the selected day. Partial-hour badge = less than 60 voice minutes in that hour.
                    </p>
                  </>
                }
              />
            }
            toolbar={
              <Badge variant="secondary" className="font-mono num">
                {viewMode === "legacy"
                  ? legacyStaff.length
                  : proposedStaff.length}
              </Badge>
            }
          >
            <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
              {viewMode === "legacy"
                ? legacyStaff.map((info, idx) => (
                    <LegacyStaffRow key={`${info.agent.id}-${idx}`} info={info} />
                  ))
                : proposedStaff.map((info, idx) => {
                    const podName = agentPodMap[info.agent.id] ?? "—";
                    const supervisorId =
                      snapshot.pods[podName]?.supervisor_id ?? "Operations";
                    const roleLabel = agentOperationalRole(info.agent);
                    const isPartialHour = info.voiceMinutes < 60;

                    return (
                      <ProposedStaffRow
                        key={`${info.agent.id}-${idx}`}
                        info={info}
                        podName={podName}
                        supervisorId={supervisorId}
                        roleLabel={roleLabel}
                        isPartialHour={isPartialHour}
                      />
                    );
                  })}

              {(viewMode === "legacy"
                ? legacyStaff.length
                : proposedStaff.length) === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No staff on duty
                </p>
              )}
            </div>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}

function LegacyStaffRow({
  info,
}: {
  info: ReturnType<typeof getLegacyOnDutyStaff>[number];
}) {
  return (
    <div className="flex flex-col gap-1.5 p-2.5 border rounded-lg bg-background/60">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold font-mono">{info.agent.id}</span>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] uppercase font-semibold">
            {info.agent.role}
          </Badge>
          <Badge variant="success" className="font-mono text-[10px]">
            {info.voiceMinutes}m
          </Badge>
        </div>
      </div>
      <div className="text-[10px] text-muted-foreground font-mono flex justify-between pt-0.5 border-t border-dashed">
        <span>{info.agent.shift_id}</span>
        <span>
          {info.agent.start_clock}–{info.agent.end_clock}
        </span>
      </div>
    </div>
  );
}

function ProposedStaffRow({
  info,
  podName,
  supervisorId,
  roleLabel,
  isPartialHour,
}: {
  info: ReturnType<typeof getAgentsOnDuty>[number];
  podName: string;
  supervisorId: string;
  roleLabel: ReturnType<typeof agentOperationalRole>;
  isPartialHour: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 p-2.5 border rounded-lg bg-background/60">
      <div className="flex items-center justify-between gap-2">
        <AgentLink
          agentId={info.agent.id}
          className="inline-flex items-center gap-1 bg-primary/5 hover:bg-primary/10 px-1.5 py-0.5 rounded"
        />
        <div className="flex items-center gap-1.5">
          {roleLabel && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] uppercase font-semibold",
                roleBadgeClass(roleLabel),
              )}
            >
              {roleLabel}
            </Badge>
          )}
          <Badge
            variant={isPartialHour ? "warning" : "success"}
            className="font-mono text-[10px]"
          >
            {info.voiceMinutes}m
          </Badge>
        </div>
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Building className="h-3 w-3 opacity-60" />
          {podName !== "—" ? (
            <TeamLink teamName={podName} className="text-[11px] font-normal" />
          ) : (
            podName
          )}
        </span>
        <span>
          {supervisorId !== "Operations" ? (
            <AgentLink agentId={supervisorId} className="inline font-semibold" />
          ) : (
            supervisorId
          )}
        </span>
      </div>
      <div className="text-[10px] text-muted-foreground flex justify-between pt-0.5 border-t border-dashed">
        <span>{shiftLengthLabel(info.agent) ?? info.agent.shift_id}</span>
        <span className="font-mono">
          {info.agent.start_clock}–{info.agent.end_clock}
        </span>
      </div>
    </div>
  );
}
