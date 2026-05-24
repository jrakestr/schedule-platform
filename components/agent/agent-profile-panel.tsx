"use client";

import { useMemo } from "react";
import { useQueryState } from "nuqs";
import { ArrowLeft } from "lucide-react";
import { AgentLink } from "@/components/agent/agent-link";
import { DayStructureBar } from "@/components/agent/day-structure-bar";
import { WeekStrip } from "@/components/agent/week-strip";
import { CubiclePill } from "@/components/shared/cubicle-pill";
import {
  ENTITY_CHIP_CLASS,
  PanelSection,
} from "@/components/shared/panel-section";
import { ProfileSlideOver } from "@/components/shared/profile-slide-over";
import { TeamLink } from "@/components/team/team-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  if (!open) {
    return null;
  }

  if (!agent) {
    return (
      <ProfileSlideOver
        open={open}
        onClose={close}
        accentColor={accent}
        title="Agent not found"
      >
        <div className="space-y-4 px-5 py-6">
          <p className="text-sm text-muted-foreground">
            {agentId
              ? `No roster entry matches ${agentId} in this snapshot.`
              : "Select an agent to view their profile."}
          </p>
          <Button variant="outline" size="sm" onClick={close}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Close
          </Button>
        </div>
      </ProfileSlideOver>
    );
  }

  const displayName = agentDisplayName(agent);

  return (
    <ProfileSlideOver
        open={open}
        onClose={close}
        accentColor={accent}
        title={displayName}
        header={
          <div
            className="sticky top-0 z-10 shrink-0 border-b border-border/60 px-5 pb-4 pt-5"
            style={{
              background:
                "linear-gradient(180deg, hsl(var(--surface-wash) / 0.55) 0%, hsl(var(--card)) 100%)",
            }}
          >
            <div className="flex items-start gap-3.5 pr-9">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-[2.5px] text-sm font-semibold tracking-tight"
                style={{
                  borderColor: accent,
                  color: accent,
                  backgroundColor: `${accent}14`,
                }}
                aria-hidden
              >
                {agentInitials(agent)}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold leading-tight tracking-tight">
                  {displayName}
                </p>
                <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                  {agent.id}
                </p>
                {opRole && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "mt-2 text-[10px] font-semibold uppercase tracking-wide",
                      roleBadgeClass(opRole),
                    )}
                  >
                    {opRole}
                  </Badge>
                )}
              </div>
            </div>

            <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
              {podInfo ? (
                <TeamLink
                  teamName={podInfo.podName}
                  className={cn(
                    ENTITY_CHIP_CLASS,
                    "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10",
                  )}
                />
              ) : (
                <span className="inline-flex items-center rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] text-muted-foreground">
                  Unassigned
                </span>
              )}

              {podInfo && agent.role !== "Supervisor" && (
                <AgentLink
                  agentId={podInfo.supervisorId}
                  className={cn(ENTITY_CHIP_CLASS, roleBadgeClass("Supervisor"))}
                >
                  {agentDisplayNameById(podInfo.supervisorId, snapshot.agents)}
                </AgentLink>
              )}

              {podInfo?.leadId &&
                podInfo.leadId !== agent.id &&
                podInfo.leadId !== "Coached by Supervisor" && (
                  <AgentLink
                    agentId={podInfo.leadId}
                    className={cn(ENTITY_CHIP_CLASS, roleBadgeClass("CSA Lead"))}
                  >
                    Lead ·{" "}
                    {agentDisplayNameById(podInfo.leadId, snapshot.agents)}
                  </AgentLink>
                )}
            </div>
          </div>
        }
      >
        <div className="space-y-7 px-5 py-6">
          <PanelSection label="Week at a glance">
            <WeekStrip agent={agent} />
          </PanelSection>

          {agent.cubicle_by_day &&
            Object.keys(agent.cubicle_by_day).length > 0 && (
              <PanelSection label="Cubicles">
                <div className="grid w-full min-w-0 grid-cols-7 gap-1">
                  {DOW_LIST.map((d) => {
                    const cubicle = agent.cubicle_by_day?.[d];
                    return (
                      <div
                        key={d}
                        className="flex min-w-0 flex-col items-center gap-1.5"
                      >
                        <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {d.slice(0, 3)}
                        </span>
                        {cubicle ? (
                          <CubiclePill
                            number={cubicle}
                            day={d}
                            agentId={agent.id}
                            onClick={() => jumpToCubicle(String(cubicle))}
                          />
                        ) : (
                          <span className="inline-flex h-7 w-7 items-center justify-center text-sm text-muted-foreground/25">
                            ·
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </PanelSection>
            )}

          {agent.structure && agent.structure.includes("Voice") && (
            <PanelSection label="Day structure">
              <DayStructureBar structure={agent.structure} />
            </PanelSection>
          )}
        </div>
      </ProfileSlideOver>
  );
}
