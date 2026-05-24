"use client";

import type { ReactNode } from "react";
import { useQueryState } from "nuqs";
import { agentIdParam, teamParam, teamRoleParam, roleFilterKey } from "@/lib/navigation/panel-params";
import { roleBadgeClass } from "@/lib/compute/colors";
import { cn } from "@/lib/utils";

interface RoleBadgeLinkProps {
  teamName: string;
  roleLabel: string;
  count: number;
  className?: string;
  children?: ReactNode;
}

/** Role count badge on org cards — opens team panel filtered to that role. */
export function RoleBadgeLink({
  teamName,
  roleLabel,
  count,
  className,
  children,
}: RoleBadgeLinkProps) {
  const [, setTeam] = useQueryState("team", teamParam);
  const [, setTeamRole] = useQueryState("team_role", teamRoleParam);
  const [, setAgentId] = useQueryState("agent_id", agentIdParam);

  if (count <= 0) return null;

  const label = children ?? `${count} ${roleLabel}`;
  const filterKey = roleFilterKey(roleLabel);

  return (
    <button
      type="button"
      onClick={() => {
        setAgentId(null);
        setTeamRole(filterKey);
        setTeam(teamName);
      }}
      className={cn(
        "text-[10px] px-1.5 py-0.5 rounded border transition-opacity hover:opacity-80 cursor-pointer",
        roleBadgeClass(roleLabel),
        className,
      )}
    >
      {label}
    </button>
  );
}
