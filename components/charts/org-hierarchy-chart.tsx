"use client";

import { useQueryState } from "nuqs";
import { parseAsStringEnum } from "nuqs";
import { AgentLink } from "@/components/agent/agent-link";
import { RoleBadgeLink } from "@/components/team/role-badge-link";
import { TeamLink } from "@/components/team/team-link";
import { podAccentColor, roleBadgeClass } from "@/lib/compute/colors";
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
    parseAsStringEnum<TabId>([...TAB_IDS]).withDefault("raci"),
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

interface RoleCohortBlockProps {
  label: string;
  accentClass: string;
  teamName: string;
  badges: Array<{ roleLabel: string; count: number }>;
}

function RoleCohortBlock({ label, accentClass, teamName, badges }: RoleCohortBlockProps) {
  const activeBadges = badges.filter((b) => b.count > 0);
  const total = activeBadges.reduce((sum, b) => sum + b.count, 0);

  return (
    <div
      className={cn(
        "flex-1 min-w-0 rounded-md border bg-card/80 px-1.5 py-1.5 space-y-1",
        accentClass,
      )}
    >
      <div className="text-[9px] font-semibold text-muted-foreground text-center uppercase tracking-wide">
        {label}
      </div>
      {total > 0 ? (
        <div className="flex flex-wrap justify-center gap-0.5">
          {activeBadges.map((b) => (
            <RoleBadgeLink
              key={b.roleLabel}
              teamName={teamName}
              roleLabel={b.roleLabel}
              count={b.count}
            />
          ))}
        </div>
      ) : (
        <div className="text-[9px] text-muted-foreground/60 text-center">—</div>
      )}
    </div>
  );
}

function HierarchyConnector() {
  return (
    <div className="relative w-full px-3 py-0.5" aria-hidden>
      <div className="mx-auto h-3 w-px bg-border" />
      <div className="mx-auto h-px w-[calc(100%-0.5rem)] bg-border" />
      <div className="flex justify-between px-[12%]">
        <div className="h-2.5 w-px bg-border" />
        <div className="h-2.5 w-px bg-border" />
        <div className="h-2.5 w-px bg-border" />
      </div>
    </div>
  );
}

function PodOrgCard({ item, index }: { item: PodSummary; index: number }) {
  const accent = podAccentColor(index);

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border bg-card shadow-sm surface-panel">
      <div
        className="px-2.5 py-2 text-center"
        style={{
          background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
        }}
      >
        <TeamLink
          teamName={item.name}
          className="text-xs font-semibold text-white hover:text-white/90 hover:underline block truncate w-full"
        />
      </div>

      <div className="flex flex-col gap-0 p-2.5 flex-1">
        <div className="rounded-md border border-slate-200 bg-slate-50/80 px-2 py-1.5 text-center dark:border-slate-700 dark:bg-slate-900/40">
          <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">
            Supervisor
          </div>
          <AgentLink
            agentId={item.pod.supervisor_id}
            className="text-xs truncate block max-w-full mt-0.5"
          />
          {item.supervisor && (
            <div className="text-[10px] text-muted-foreground num tabular-nums mt-0.5">
              {item.supervisor.start_clock}–{item.supervisor.end_clock}
            </div>
          )}
        </div>

        <HierarchyConnector />

        <div className="flex gap-1.5">
          <RoleCohortBlock
            label="CSA"
            accentClass="border-emerald-200/80 dark:border-emerald-900/60"
            teamName={item.name}
            badges={[
              { roleLabel: "CSA Lead", count: item.csaLead },
              { roleLabel: "CSA", count: item.csaLine },
            ]}
          />
          <RoleCohortBlock
            label="NDS"
            accentClass="border-sky-200/80 dark:border-sky-900/60"
            teamName={item.name}
            badges={[{ roleLabel: "NDS", count: item.nds }]}
          />
          <RoleCohortBlock
            label="SDS"
            accentClass="border-violet-200/80 dark:border-violet-900/60"
            teamName={item.name}
            badges={[
              { roleLabel: "SDS Lead", count: item.sdsLead },
              { roleLabel: "SDS", count: item.sdsLine },
            ]}
          />
        </div>

        <TeamLink
          teamName={item.name}
          className="text-[10px] text-muted-foreground border-t pt-2 mt-auto w-full font-normal hover:text-foreground text-center"
        >
          {item.total} members · {item.pod.coverage_window ?? "varies"}
        </TeamLink>
      </div>
    </article>
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

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {podSummaries.map((item, i) => (
          <PodOrgCard key={item.name} item={item} index={i} />
        ))}
      </div>
    </div>
  );
}
