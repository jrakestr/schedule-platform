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
