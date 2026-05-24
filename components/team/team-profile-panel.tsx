"use client";

import { useEffect, useMemo, useRef } from "react";
import { useQueryState } from "nuqs";
import { ArrowLeft, ExternalLink, X } from "lucide-react";
import { AgentLink } from "@/components/agent/agent-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  agentOperationalRole,
  podAccentColor,
  roleBadgeClass,
  shiftColor,
} from "@/lib/compute/colors";
import {
  agentIdParam,
  agentMatchesTeamRole,
  teamParam,
  teamRoleParam,
} from "@/lib/navigation/panel-params";
import { podNamesOrdered } from "@/lib/compute/week-schedule";
import type { Agent, Snapshot } from "@/lib/data/types";
import { cn } from "@/lib/utils";
import type { TabId } from "@/components/tab-ids";

interface TeamProfilePanelProps {
  snapshot: Snapshot;
  onJump?: (tab: TabId) => void;
}

export function TeamProfilePanel({ snapshot, onJump }: TeamProfilePanelProps) {
  const [teamName, setTeam] = useQueryState("team", teamParam);
  const [teamRole, setTeamRole] = useQueryState("team_role", teamRoleParam);
  const [, setAgentId] = useQueryState("agent_id", agentIdParam);
  const membersRef = useRef<HTMLDivElement>(null);

  const podEntry = useMemo(() => {
    if (!teamName) return null;
    const pod = snapshot.pods[teamName];
    if (!pod) return null;
    return { name: teamName, pod };
  }, [teamName, snapshot.pods]);

  const members = useMemo((): Agent[] => {
    if (!podEntry) return [];
    return podEntry.pod.members
      .map((id) => snapshot.agents.find((a) => a.id === id))
      .filter((a): a is Agent => !!a);
  }, [podEntry, snapshot.agents]);

  const filteredMembers = useMemo(
    () => members.filter((m) => agentMatchesTeamRole(m, teamRole)),
    [members, teamRole],
  );

  const podIndex = useMemo(
    () => podNamesOrdered(snapshot.pods).indexOf(podEntry?.name ?? ""),
    [snapshot.pods, podEntry?.name],
  );

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of members) {
      const label = agentOperationalRole(m);
      if (label) counts[label] = (counts[label] ?? 0) + 1;
    }
    return counts;
  }, [members]);

  const open = Boolean(teamName);

  useEffect(() => {
    if (open && teamRole && membersRef.current) {
      membersRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [open, teamRole, filteredMembers.length]);

  const close = () => {
    setTeam(null);
    setTeamRole(null);
  };

  const goToPodsTab = () => {
    onJump?.("pods");
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent
        className={cn(
          "fixed inset-y-0 right-0 left-auto top-0 h-full w-full max-w-md",
          "translate-x-0 translate-y-0 rounded-none border-l p-0 gap-0",
          "surface-panel sm:max-h-full overflow-y-auto",
        )}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {!podEntry ? (
          <div className="p-6 space-y-4">
            <DialogTitle className="text-base">Team not found</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {teamName
                ? `No team matches "${teamName}" in this snapshot.`
                : "Select a team to view details."}
            </p>
            <Button variant="outline" size="sm" onClick={close}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Close
            </Button>
          </div>
        ) : (
          <>
            <div
              className="h-1 w-full"
              style={{
                background: podAccentColor(Math.max(podIndex, 0)),
              }}
              aria-hidden
            />
            <div className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur px-5 py-4">
              <div className="flex items-start gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={close}
                  aria-label="Close team panel"
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-xl font-semibold leading-tight text-left">
                    {podEntry.name}
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{podEntry.pod.type}</p>
                </div>
              </div>
            </div>

            <div className="px-5 py-5 space-y-6">
              <section className="space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground">Leadership</h3>
                <div className="rounded-lg border bg-muted/20 px-3 py-2.5 space-y-1.5 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Supervisor</span>
                    <AgentLink agentId={podEntry.pod.supervisor_id} />
                  </div>
                  {podEntry.pod.lead_id !== "Coached by Supervisor" && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Team lead</span>
                      <AgentLink agentId={podEntry.pod.lead_id} />
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground">Coverage window</h3>
                <p className="num font-mono text-sm tabular-nums">
                  {podEntry.pod.coverage_window || "Varies by member shift"}
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground">Role mix</h3>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(roleCounts).map(([label, count]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() =>
                        setTeamRole(teamRole === label ? null : label)
                      }
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full border transition-opacity hover:opacity-80 cursor-pointer",
                        roleBadgeClass(label),
                        teamRole === label && "ring-2 ring-primary/40",
                      )}
                    >
                      {count} {label}
                    </button>
                  ))}
                  <Badge variant="secondary" className="text-[10px]">
                    {members.length} total
                  </Badge>
                </div>
              </section>

              <section ref={membersRef} className="space-y-2 scroll-mt-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-medium text-muted-foreground">
                    Members
                    {teamRole ? ` · ${teamRole}` : ""}
                  </h3>
                  {teamRole && (
                    <button
                      type="button"
                      onClick={() => setTeamRole(null)}
                      className="text-[10px] text-primary hover:underline"
                    >
                      Clear filter
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  {filteredMembers.map((m) => {
                    const op = agentOperationalRole(m);
                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-sm hover:bg-muted/30 transition-colors"
                      >
                        <AgentLink agentId={m.id} />
                        <span className="flex items-center gap-1.5 shrink-0">
                          <span
                            className="inline-block w-2 h-2 rounded-sm"
                            style={{ background: shiftColor(m.shift_id) }}
                          />
                          {op && (
                            <Badge
                              variant="outline"
                              className={cn("text-[10px] h-5", roleBadgeClass(op))}
                            >
                              {op}
                            </Badge>
                          )}
                        </span>
                        <span className="num text-[10px] font-mono text-muted-foreground tabular-nums shrink-0">
                          {m.start_clock}–{m.end_clock}
                        </span>
                      </div>
                    );
                  })}
                  {filteredMembers.length === 0 && (
                    <p className="text-xs text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                      No members match this role filter.
                    </p>
                  )}
                </div>
              </section>

              {onJump && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={goToPodsTab}
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Open in Pods tab
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
