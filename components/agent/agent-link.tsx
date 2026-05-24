"use client";

import type { ReactNode } from "react";
import { useQueryState } from "nuqs";
import { agentIdParam, teamParam, teamRoleParam } from "@/lib/navigation/panel-params";
import { cn } from "@/lib/utils";

interface AgentLinkProps {
  agentId: string;
  className?: string;
  children?: ReactNode;
}

const DEFAULT_LINK_CLASS =
  "font-mono text-xs font-semibold text-primary hover:underline cursor-pointer text-left";

/** Opens the agent profile panel by setting the shareable `agent_id` URL param. */
export function AgentLink({ agentId, className, children }: AgentLinkProps) {
  const [, setAgentId] = useQueryState("agent_id", agentIdParam);
  const [, setTeam] = useQueryState("team", teamParam);
  const [, setTeamRole] = useQueryState("team_role", teamRoleParam);

  if (!agentId) {
    return <>{children ?? null}</>;
  }

  const isChip = className?.includes("rounded-full");

  return (
    <button
      type="button"
      onClick={() => {
        setTeam(null);
        setTeamRole(null);
        setAgentId(agentId);
      }}
      className={cn(isChip ? undefined : DEFAULT_LINK_CLASS, className)}
    >
      {children ?? agentId}
    </button>
  );
}
