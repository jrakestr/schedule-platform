import type { Agent, Pod } from "@/lib/data/types";

export interface AgentPodInfo {
  podName: string;
  pod: Pod;
  supervisorId: string;
  leadId: string;
  isSupervisor: boolean;
}

/** Resolve team/pod membership for an agent ID (including supervisors). */
export function agentPodInfo(
  agentId: string,
  pods: Record<string, Pod>,
): AgentPodInfo | null {
  for (const [name, pod] of Object.entries(pods)) {
    if (pod.supervisor_id === agentId) {
      return {
        podName: name,
        pod,
        supervisorId: pod.supervisor_id,
        leadId: pod.lead_id,
        isSupervisor: true,
      };
    }
    if (pod.members.includes(agentId)) {
      return {
        podName: name,
        pod,
        supervisorId: pod.supervisor_id,
        leadId: pod.lead_id,
        isSupervisor: false,
      };
    }
  }
  return null;
}

/** Display label: name when present, otherwise agent ID. */
export function agentDisplayName(agent: Agent): string {
  const trimmed = agent.name?.trim();
  return trimmed || agent.id;
}

/** Resolve display name by roster ID, falling back to the ID. */
export function agentDisplayNameById(agentId: string, agents: Agent[]): string {
  const agent = agents.find((a) => a.id === agentId);
  return agent ? agentDisplayName(agent) : agentId;
}

/** Initials for avatar ring (up to two characters). */
export function agentInitials(agent: Agent): string {
  const label = agentDisplayName(agent);
  const parts = label.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return label.slice(0, 2).toUpperCase();
}
