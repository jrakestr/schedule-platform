"use client";

import { useMemo } from "react";
import { useQueryState } from "nuqs";
import { ArrowLeft, X } from "lucide-react";
import { AgentLink } from "@/components/agent/agent-link";
import { DayStructureBar } from "@/components/agent/day-structure-bar";
import { WeekStrip } from "@/components/agent/week-strip";
import { CubiclePill } from "@/components/shared/cubicle-pill";
import { TeamLink } from "@/components/team/team-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  agentOperationalRole,
  roleBadgeClass,
  roleColor,
} from "@/lib/compute/colors";
import {
  agentDisplayName,
  agentDisplayNameById,
  agentInitials,
  agentPodInfo,
} from "@/lib/compute/agent-context";
import {
  agentIdParam,
  cubicleParam,
} from "@/lib/navigation/panel-params";
import { DOW_LIST, type Snapshot } from "@/lib/data/types";
import type { TabId } from "@/components/tab-ids";
import { cn } from "@/lib/utils";

interface AgentProfilePanelProps {
  snapshot: Snapshot;
  onJump?: (tab: TabId) => void;
}

const CHIP_CLASS =
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-accent/80 hover:no-underline cursor-pointer";

const SECTION_LABEL =
  "text-[10px] uppercase tracking-wider text-muted-foreground font-semibold";

export function AgentProfilePanel({ snapshot, onJump }: AgentProfilePanelProps) {
  const [agentId, setAgentId] = useQueryState("agent_id", agentIdParam);
  const [, setCubicleFilter] = useQueryState("cubicle", cubicleParam);

  const agent = useMemo(
    () => snapshot.agents.find((a) => a.id === agentId) ?? null,
    [snapshot.agents, agentId],
  );

  const podInfo = useMemo(
    () => (agentId ? agentPodInfo(agentId, snapshot.pods) : null),
    [agentId, snapshot.pods],
  );

  const shiftEntry = useMemo(
    () =>
      agent
        ? snapshot.shift_catalog.find((s) => s.shift_id === agent.shift_id)
        : undefined,
    [agent, snapshot.shift_catalog],
  );

  const opRole = agent ? agentOperationalRole(agent) : null;
  const accent = opRole ? roleColor(opRole) : "#64748b";
  const open = Boolean(agentId);

  const close = () => {
    setAgentId(null);
  };

  const jumpToCubicle = (cubicle: string) => {
    setCubicleFilter(String(cubicle));
    onJump?.("cubicles");
    close();
  };

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={(next) => !next && close()}>
        <DialogContent
          className={cn(
            "fixed inset-y-0 right-0 left-auto top-0 h-full w-full max-w-md",
            "translate-x-0 translate-y-0 rounded-none border-l p-0 gap-0",
            "surface-panel sm:max-h-full overflow-y-auto",
            "[&>button.absolute]:hidden",
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {!agent ? (
            <div className="p-6 space-y-4">
              <DialogTitle className="text-base">Agent not found</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {agentId
                  ? `No roster entry matches ${agentId} in this snapshot.`
                  : "Select an agent to view their profile."}
              </p>
              <Button variant="outline" size="sm" onClick={close}>
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Close
              </Button>
            </div>
          ) : (
            <>
              <div
                className="h-1 w-full shrink-0"
                style={{ background: accent }}
                aria-hidden
              />

              <div className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur px-5 py-4">
                <div className="flex items-start gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 -ml-1"
                    onClick={close}
                    aria-label="Close profile"
                  >
                    <X className="h-4 w-4" />
                  </Button>

                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold"
                    style={{
                      borderColor: accent,
                      color: accent,
                      backgroundColor: `${accent}18`,
                    }}
                    aria-hidden
                  >
                    {agentInitials(agent)}
                  </div>

                  <div className="min-w-0 flex-1 pt-0.5">
                    <DialogTitle className="text-lg font-semibold leading-tight text-left truncate">
                      {agentDisplayName(agent)}
                    </DialogTitle>
                    <p className="font-mono text-[11px] text-muted-foreground mt-0.5 truncate">
                      {agent.id}
                    </p>
                    {opRole && (
                      <Badge
                        variant="outline"
                        className={cn("mt-2 text-[10px] font-semibold", roleBadgeClass(opRole))}
                      >
                        {opRole}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-5 py-5 space-y-6">
                <section className="space-y-2.5">
                  <h3 className={SECTION_LABEL}>Team</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    {podInfo ? (
                      <TeamLink
                        teamName={podInfo.podName}
                        className={cn(CHIP_CLASS, "border-primary/25 bg-primary/5 text-primary")}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground rounded-full border border-dashed px-2.5 py-1">
                        Unassigned
                      </span>
                    )}

                    {podInfo && agent.role !== "Supervisor" && (
                      <AgentLink
                        agentId={podInfo.supervisorId}
                        className={cn(CHIP_CLASS, roleBadgeClass("Supervisor"))}
                      >
                        {agentDisplayNameById(podInfo.supervisorId, snapshot.agents)}
                      </AgentLink>
                    )}

                    {podInfo?.leadId &&
                      podInfo.leadId !== agent.id &&
                      podInfo.leadId !== "Coached by Supervisor" && (
                        <AgentLink
                          agentId={podInfo.leadId}
                          className={cn(CHIP_CLASS, roleBadgeClass("CSA Lead"))}
                        >
                          Lead · {agentDisplayNameById(podInfo.leadId, snapshot.agents)}
                        </AgentLink>
                      )}
                  </div>
                </section>

                <section className="space-y-2.5">
                  <h3 className={SECTION_LABEL}>Week at a glance</h3>
                  <WeekStrip agent={agent} shiftLabel={shiftEntry?.label} />
                </section>

                {agent.cubicle_by_day && Object.keys(agent.cubicle_by_day).length > 0 && (
                  <section className="space-y-2.5">
                    <h3 className={SECTION_LABEL}>Cubicles</h3>
                    <div className="rounded-xl border bg-muted/15 p-3">
                      <div className="grid grid-cols-7 gap-1">
                        {DOW_LIST.map((d) => {
                          const cubicle = agent.cubicle_by_day?.[d];
                          return (
                            <div key={d} className="text-center">
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                                {d}
                              </div>
                              {cubicle ? (
                                <CubiclePill
                                  number={cubicle}
                                  day={d}
                                  agentId={agent.id}
                                  onClick={() => jumpToCubicle(String(cubicle))}
                                />
                              ) : (
                                <span className="inline-flex h-7 w-7 items-center justify-center text-muted-foreground/30 text-sm">
                                  ·
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                )}

                {agent.structure && agent.structure.includes("Voice") && (
                  <section className="space-y-2.5">
                    <h3 className={SECTION_LABEL}>Day structure</h3>
                    <DayStructureBar structure={agent.structure} />
                  </section>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
