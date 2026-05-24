"use client";

import type { ReactNode } from "react";
import { useQueryState } from "nuqs";
import { agentIdParam, teamParam, teamRoleParam } from "@/lib/navigation/panel-params";
import { cn } from "@/lib/utils";

interface TeamLinkProps {
  teamName: string;
  className?: string;
  children?: ReactNode;
  /** When set, team panel scrolls to members filtered to this role. */
  roleFilter?: string;
}

/** Opens the team detail panel via shareable `team` URL param. */
export function TeamLink({ teamName, className, children, roleFilter }: TeamLinkProps) {
  const [, setTeam] = useQueryState("team", teamParam);
  const [, setTeamRole] = useQueryState("team_role", teamRoleParam);
  const [, setAgentId] = useQueryState("agent_id", agentIdParam);

  if (!teamName || teamName === "—") {
    return <>{children ?? teamName ?? null}</>;
  }

  return (
    <button
      type="button"
      onClick={() => {
        setAgentId(null);
        setTeamRole(roleFilter ?? null);
        setTeam(teamName);
      }}
      className={cn(
        "text-sm font-semibold text-primary hover:underline cursor-pointer text-left",
        className,
      )}
    >
      {children ?? teamName}
    </button>
  );
}

/** Alias — pods and teams are the same entity in this platform. */
export const PodLink = TeamLink;
