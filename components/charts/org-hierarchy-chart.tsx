"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { POD_PALETTE, roleBadgeClass } from "@/lib/compute/colors";
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

export function OrgHierarchyChart({ snapshot }: OrgHierarchyChartProps) {
  const supervisors = useMemo(
    () => snapshot.agents.filter((a) => a.role === "Supervisor"),
    [snapshot.agents],
  );

  const podSummaries = useMemo((): PodSummary[] => {
    return Object.entries(snapshot.pods).map(([name, pod], i) => {
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
  }, [snapshot.agents, snapshot.pods]);

  const totals = useMemo(() => {
    const all = podSummaries.reduce(
      (acc, p) => ({
        csaLine: acc.csaLine + p.csaLine,
        csaLead: acc.csaLead + p.csaLead,
        nds: acc.nds + p.nds,
        sdsLine: acc.sdsLine + p.sdsLine,
        sdsLead: acc.sdsLead + p.sdsLead,
      }),
      { csaLine: 0, csaLead: 0, nds: 0, sdsLine: 0, sdsLead: 0 },
    );
    return {
      ...all,
      supervisors: supervisors.length,
      pods: podSummaries.length,
      agents: snapshot.meta.total_bodies,
    };
  }, [podSummaries, supervisors.length, snapshot.meta.total_bodies]);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <div className="text-sm font-semibold">MJM Contact Center Operations</div>
        <div className="text-xs text-muted-foreground">
          {totals.supervisors} Supervisor · {totals.pods} teams ·{" "}
          {totals.agents} roster bodies
        </div>
        <div className="flex flex-wrap justify-center gap-1.5 pt-1">
          {totals.csaLead > 0 && (
            <Badge variant="outline" className={roleBadgeClass("CSA Lead")}>
              {totals.csaLead} CSA Lead
            </Badge>
          )}
          {totals.csaLine > 0 && (
            <Badge variant="outline" className={roleBadgeClass("CSA")}>
              {totals.csaLine} CSA
            </Badge>
          )}
          {totals.nds > 0 && (
            <Badge variant="outline" className={roleBadgeClass("NDS")}>
              {totals.nds} NDS
            </Badge>
          )}
          {totals.sdsLead > 0 && (
            <Badge variant="outline" className={roleBadgeClass("SDS Lead")}>
              {totals.sdsLead} SDS Lead
            </Badge>
          )}
          {totals.sdsLine > 0 && (
            <Badge variant="outline" className={roleBadgeClass("SDS")}>
              {totals.sdsLine} SDS
            </Badge>
          )}
          <Badge variant="outline" className={roleBadgeClass("Supervisor")}>
            {totals.supervisors} Supervisor
          </Badge>
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
                className="w-full rounded-lg border bg-card p-3 space-y-2 shadow-sm"
                style={{ borderTopColor: POD_PALETTE[i % POD_PALETTE.length], borderTopWidth: 3 }}
              >
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Supervisor
                </div>
                <div className="font-mono text-xs font-semibold truncate" title={item.pod.supervisor_id}>
                  {item.pod.supervisor_id}
                </div>
                {item.supervisor && (
                  <div className="text-[10px] text-muted-foreground num tabular-nums">
                    {item.supervisor.start_clock}–{item.supervisor.end_clock}
                  </div>
                )}

                <div className="border-t pt-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    Team
                  </div>
                  <div className="text-xs font-semibold leading-tight">{item.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{item.pod.type}</div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {item.csaLead > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${roleBadgeClass("CSA Lead")}`}>
                      {item.csaLead} CSA Lead
                    </span>
                  )}
                  {item.csaLine > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${roleBadgeClass("CSA")}`}>
                      {item.csaLine} CSA
                    </span>
                  )}
                  {item.nds > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${roleBadgeClass("NDS")}`}>
                      {item.nds} NDS
                    </span>
                  )}
                  {item.sdsLead > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${roleBadgeClass("SDS Lead")}`}>
                      {item.sdsLead} SDS Lead
                    </span>
                  )}
                  {item.sdsLine > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${roleBadgeClass("SDS")}`}>
                      {item.sdsLine} SDS
                    </span>
                  )}
                </div>

                <div className="text-[10px] text-muted-foreground border-t pt-2">
                  {item.total} members · {item.pod.coverage_window ?? "varies"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
