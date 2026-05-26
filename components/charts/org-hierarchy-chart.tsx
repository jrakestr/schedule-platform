"use client";

import { useQueryState, parseAsStringEnum } from "nuqs";
import { AgentLink } from "@/components/agent/agent-link";
import { TeamLink } from "@/components/team/team-link";
import { podAccentColor } from "@/lib/compute/colors";
import { TAB_IDS, type TabId } from "@/components/tab-ids";
import { cn } from "@/lib/utils";
import type { Agent, Pod, Snapshot } from "@/lib/data/types";

interface OrgHierarchyChartProps {
  snapshot: Snapshot;
}

interface PodSummary {
  name: string;
  pod: Pod;
  supervisor: Agent | undefined;
  csaLine: number;
  csaLead: number;
  nds: number;
  sdsLine: number;
  sdsLead: number;
  total: number;
}

type RoleKey = "csaLead" | "csaLine" | "sdsLead" | "sdsLine" | "nds";

const ROLE_TONE: Record<RoleKey, { fill: string; label: string; filterRole: string }> = {
  csaLead: { fill: "bg-amber-500", label: "CSA Lead", filterRole: "Lead" },
  csaLine: { fill: "bg-emerald-500", label: "CSA", filterRole: "CSA" },
  sdsLead: { fill: "bg-fuchsia-500", label: "SDS Lead", filterRole: "Lead" },
  sdsLine: { fill: "bg-violet-500", label: "SDS", filterRole: "SDS" },
  nds: { fill: "bg-sky-500", label: "NDS", filterRole: "NDS" },
};

const ROLE_ORDER: RoleKey[] = ["csaLead", "csaLine", "sdsLead", "sdsLine", "nds"];

function roleCounts(members: Agent[]) {
  return {
    csaLine: members.filter((a) => a.role === "CSA" && a.position === "Line").length,
    csaLead: members.filter((a) => a.role === "CSA" && a.position === "Lead").length,
    nds: members.filter((a) => a.role === "NDS").length,
    sdsLine: members.filter((a) => a.role === "SDS" && a.position === "Line").length,
    sdsLead: members.filter((a) => a.role === "SDS" && a.position === "Lead").length,
  };
}

/** Horizontal stacked bar of role segments, length proportional to team headcount. */
function CompositionBar({ item, maxTotal }: { item: PodSummary; maxTotal: number }) {
  const members = item.total - 1; // exclude supervisor
  const widthPct = maxTotal > 0 ? (item.total / maxTotal) * 100 : 0;

  return (
    <div className="flex h-7 items-stretch" style={{ width: `${Math.max(widthPct, 8)}%` }}>
      {ROLE_ORDER.map((roleKey) => {
        const count = item[roleKey];
        if (count <= 0) return null;
        const segPct = members > 0 ? (count / members) * 100 : 0;
        const tone = ROLE_TONE[roleKey];
        return (
          <div
            key={roleKey}
            className={cn("flex items-center justify-center text-[10px] font-bold text-white shadow-[inset_0_-1px_0_rgba(0,0,0,0.12)] first:rounded-l-md last:rounded-r-md", tone.fill)}
            style={{ width: `${segPct}%` }}
            title={`${count} ${tone.label}`}
          >
            {count >= 1 && segPct > 8 ? count : ""}
          </div>
        );
      })}
    </div>
  );
}

function RoleTotalChip({
  count,
  label,
  fill,
  filterRole,
}: {
  count: number;
  label: string;
  fill: string;
  filterRole: string;
}) {
  const [, setTab] = useQueryState(
    "tab",
    parseAsStringEnum<TabId>([...TAB_IDS]).withDefault("raci"),
  );
  const [, setRole] = useQueryState("role", { defaultValue: "", clearOnDefault: true });

  if (count <= 0) return null;
  return (
    <button
      type="button"
      onClick={() => {
        setRole(filterRole);
        setTab("roster");
      }}
      className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <span className={cn("h-2 w-2 rounded-full", fill)} />
      <span className="num font-mono font-semibold tabular-nums text-foreground">
        {count}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </button>
  );
}

export function OrgHierarchyChart({ snapshot }: OrgHierarchyChartProps) {
  const supervisors = snapshot.agents.filter((a) => a.role === "Supervisor");

  const podSummaries: PodSummary[] = Object.entries(snapshot.pods).map(([name, pod]) => {
    const members = pod.members
      .map((id) => snapshot.agents.find((a) => a.id === id))
      .filter((a): a is Agent => !!a);
    const counts = roleCounts(members);
    return {
      name,
      pod,
      supervisor: snapshot.agents.find((a) => a.id === pod.supervisor_id),
      ...counts,
      total: members.length,
    };
  });

  const totals = podSummaries.reduce(
    (acc, p) => ({
      csaLine: acc.csaLine + p.csaLine,
      csaLead: acc.csaLead + p.csaLead,
      nds: acc.nds + p.nds,
      sdsLine: acc.sdsLine + p.sdsLine,
      sdsLead: acc.sdsLead + p.sdsLead,
    }),
    { csaLine: 0, csaLead: 0, nds: 0, sdsLine: 0, sdsLead: 0 },
  );

  const maxTotal = Math.max(...podSummaries.map((p) => p.total), 1);

  return (
    <div className="space-y-5">
      {/* Roster summary chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Roster
        </span>
        <RoleTotalChip
          count={supervisors.length}
          label="Supervisors"
          fill="bg-cyan-500"
          filterRole="Supervisor"
        />
        <RoleTotalChip
          count={totals.csaLead}
          label="CSA Leads"
          fill={ROLE_TONE.csaLead.fill}
          filterRole="Lead"
        />
        <RoleTotalChip
          count={totals.csaLine}
          label="CSAs"
          fill={ROLE_TONE.csaLine.fill}
          filterRole="CSA"
        />
        <RoleTotalChip
          count={totals.sdsLead}
          label="SDS Leads"
          fill={ROLE_TONE.sdsLead.fill}
          filterRole="Lead"
        />
        <RoleTotalChip
          count={totals.sdsLine}
          label="SDS"
          fill={ROLE_TONE.sdsLine.fill}
          filterRole="SDS"
        />
        <RoleTotalChip
          count={totals.nds}
          label="NDS"
          fill={ROLE_TONE.nds.fill}
          filterRole="NDS"
        />
        <span className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">
          {podSummaries.length} teams · {snapshot.meta.total_bodies} bodies
        </span>
      </div>

      {/* Asymmetric team bars — width proportional to headcount, segments by role */}
      <div className="space-y-2.5">
        {podSummaries.map((item, i) => {
          const accent = podAccentColor(i);
          return (
            <div
              key={item.name}
              className="grid grid-cols-[140px_180px_1fr_auto] items-center gap-4"
            >
              {/* Team name with color marker */}
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-sm"
                  style={{ background: accent }}
                />
                <TeamLink
                  teamName={item.name}
                  className="truncate text-sm font-semibold text-foreground hover:text-primary"
                />
              </div>

              {/* Supervisor */}
              <div className="min-w-0">
                <AgentLink
                  agentId={item.pod.supervisor_id}
                  className="block truncate text-xs text-foreground hover:text-primary"
                />
                {item.supervisor && (
                  <div className="num font-mono text-[10px] tabular-nums text-muted-foreground">
                    {item.supervisor.start_clock}–{item.supervisor.end_clock}
                  </div>
                )}
              </div>

              {/* Composition bar (asymmetric, sized by headcount) */}
              <CompositionBar item={item} maxTotal={maxTotal} />

              {/* Total */}
              <span className="num min-w-[2ch] text-right font-mono text-sm font-semibold tabular-nums text-foreground">
                {item.total}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
        <span className="font-semibold uppercase tracking-wider">Legend</span>
        {ROLE_ORDER.map((k) => {
          const tone = ROLE_TONE[k];
          return (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className={cn("h-2.5 w-2.5 rounded-sm", tone.fill)} />
              <span>{tone.label}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
