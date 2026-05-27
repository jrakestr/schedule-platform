"use client";

import type { ReactNode } from "react";
import { useQueryState, parseAsString } from "nuqs";
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
  const [, setAgentId] = useQueryState("agent_id", parseAsString);
  const [, setTeam] = useQueryState("team", parseAsString);
  const [, setTeamRole] = useQueryState("team_role", parseAsString);

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
