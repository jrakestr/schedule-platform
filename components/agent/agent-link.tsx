"use client";

import type { ReactNode } from "react";
import { useQueryState, parseAsString } from "nuqs";
import { cn } from "@/lib/utils";

interface AgentLinkProps {
  agentId: string;
  className?: string;
  children?: ReactNode;
}

/** Opens the agent profile panel by setting the shareable `agent_id` URL param. */
export function AgentLink({ agentId, className, children }: AgentLinkProps) {
  const [, setAgentId] = useQueryState("agent_id", parseAsString);

  if (!agentId) {
    return <>{children ?? null}</>;
  }

  return (
    <button
      type="button"
      onClick={() => setAgentId(agentId)}
      className={cn(
        "font-mono text-xs font-semibold text-primary hover:underline cursor-pointer text-left",
        className,
      )}
    >
      {children ?? agentId}
    </button>
  );
}
