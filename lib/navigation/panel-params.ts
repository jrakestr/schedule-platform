import { parseAsString } from "nuqs";

/** Shareable URL params for drill-down panels. */
export const agentIdParam = parseAsString;
export const teamParam = parseAsString;
/** Optional role filter when opening team panel from a role badge (e.g. "CSA", "CSA Lead"). */
export const teamRoleParam = parseAsString;
/** Cubicles tab: filter assignments table to this cubicle number. */
export const cubicleParam = parseAsString;

export const SEGMENT_KIND_COLOR: Record<string, string> = {
  Voice: "#16a34a",
  Break: "#d97706",
  Lunch: "#0284c7",
};

export function segmentKindColor(kind: string): string {
  return SEGMENT_KIND_COLOR[kind] ?? "#64748b";
}

/** Map org-chart / pod badge labels to member filter keys. */
export function roleFilterKey(label: string): string {
  if (label === "CSA Line") return "CSA";
  if (label === "SDS Line") return "SDS";
  return label;
}

export function agentMatchesTeamRole(
  agent: { role: string; position: string },
  teamRole: string | null | undefined,
): boolean {
  if (!teamRole) return true;
  if (teamRole === "Supervisor") return agent.role === "Supervisor";
  if (teamRole === "CSA Lead")
    return agent.role === "CSA" && agent.position === "Lead";
  if (teamRole === "CSA")
    return agent.role === "CSA" && agent.position === "Line";
  if (teamRole === "CSA Line")
    return agent.role === "CSA" && agent.position === "Line";
  if (teamRole === "SDS Lead")
    return agent.role === "SDS" && agent.position === "Lead";
  if (teamRole === "SDS")
    return agent.role === "SDS" && agent.position === "Line";
  if (teamRole === "SDS Line")
    return agent.role === "SDS" && agent.position === "Line";
  if (teamRole === "NDS") return agent.role === "NDS";
  return false;
}
