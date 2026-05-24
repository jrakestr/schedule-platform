"use client";

import { useQueryState } from "nuqs";
import { parseAsStringEnum } from "nuqs";
import { AgentLink } from "@/components/agent/agent-link";
import { RoleBadgeLink } from "@/components/team/role-badge-link";
import { TeamLink } from "@/components/team/team-link";
import { POD_PALETTE, roleBadgeClass } from "@/lib/compute/colors";
import { TAB_IDS, type TabId } from "@/components/tab-ids";
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

function roleCounts(members: Agent[]) {
  return {
    csaLine: members.filter((a) => a.role === "CSA" && a.position === "Line").length,
    csaLead: members.filter((a) => a.role === "CSA" && a.position === "Lead").length,
    nds: members.filter((a) => a.role === "NDS").length,
    sdsLine: members.filter((a) => a.role === "SDS" && a.position === "Line").length,
    sdsLead: members.filter((a) => a.role === "SDS" && a.position === "Lead").length,
  };
}

function OrgRoleBadge({ count, label }: { count: number; label: string }) {
  const [, setTab] = useQueryState(
    "tab",
    parseAsStringEnum<TabId>([...TAB_IDS]).withDefault("coverage"),
  );
  const [, setRole] = useQueryState("role", { defaultValue: "", clearOnDefault: true });

  if (count <= 0) return null;

  const rosterRole =
    label === "CSA Lead" || label === "SDS Lead"
      ? label.replace(" Lead", "")
      : label;

  return (
    <button
      type="button"
      onClick={() => {
        setRole(label.includes("Lead") ? "Lead" : rosterRole);
        setTab("roster");
      }}
      className={`text-[10px] px-1.5 py-0.5 rounded border transition-opacity hover:opacity-80 cursor-pointer ${roleBadgeClass(label)}`}
    >
      {count} {label}
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

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <div className="text-sm font-semibold">MJM Contact Center Operations</div>
        <div className="text-xs text-muted-foreground">
          {supervisors.length} Supervisor · {podSummaries.length} teams ·{" "}
          {snapshot.meta.total_bodies} roster bodies
        </div>
        <div className="flex flex-wrap justify-center gap-1.5 pt-1">
          <OrgRoleBadge count={totals.csaLead} label="CSA Lead" />
          <OrgRoleBadge count={totals.csaLine} label="CSA" />
          <OrgRoleBadge count={totals.nds} label="NDS" />
          <OrgRoleBadge count={totals.sdsLead} label="SDS Lead" />
          <OrgRoleBadge count={totals.sdsLine} label="SDS" />
          <OrgRoleBadge count={supervisors.length} label="Supervisor" />
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-1/2 top-0 h-4 w-px -translate-x-1/2 bg-border" aria-hidden />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-4">
          {podSummaries.map((item, i) => (
            <div key={item.name} className="relative flex flex-col items-center">
              <div
                className="absolute -top-4 left-1/2 h-4 w-px -translate-x-1/2 bg-border hidden lg:block"
                aria-hidden
              />
              <div
                className="w-full rounded-lg border bg-card p-3 space-y-2 shadow-sm surface-panel"
                style={{ borderTopColor: POD_PALETTE[i % POD_PALETTE.length], borderTopWidth: 3 }}
              >
                <div className="text-[10px] text-muted-foreground font-medium">
                  Supervisor
                </div>
                <AgentLink
                  agentId={item.pod.supervisor_id}
                  className="text-xs truncate block max-w-full"
                />
                {item.supervisor && (
                  <div className="text-[10px] text-muted-foreground num tabular-nums">
                    {item.supervisor.start_clock}–{item.supervisor.end_clock}
                  </div>
                )}

                <div className="border-t pt-2">
                  <div className="text-[10px] text-muted-foreground font-medium">
                    Team
                  </div>
                  <TeamLink
                    teamName={item.name}
                    className="text-xs leading-tight block"
                  />
                  <div className="text-[10px] text-muted-foreground mt-0.5">{item.pod.type}</div>
                </div>

                <div className="flex flex-wrap gap-1">
                  <RoleBadgeLink teamName={item.name} roleLabel="CSA Lead" count={item.csaLead} />
                  <RoleBadgeLink teamName={item.name} roleLabel="CSA" count={item.csaLine} />
                  <RoleBadgeLink teamName={item.name} roleLabel="NDS" count={item.nds} />
                  <RoleBadgeLink teamName={item.name} roleLabel="SDS Lead" count={item.sdsLead} />
                  <RoleBadgeLink teamName={item.name} roleLabel="SDS" count={item.sdsLine} />
                </div>

                <TeamLink
                  teamName={item.name}
                  className="text-[10px] text-muted-foreground border-t pt-2 w-full font-normal hover:text-foreground"
                >
                  {item.total} members · {item.pod.coverage_window ?? "varies"}
                </TeamLink>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
