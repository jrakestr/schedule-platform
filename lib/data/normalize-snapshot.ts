import type { Pod, Snapshot } from "@/lib/data/types";

const CANONICAL_POD_RE = /^Team \d+$/;

/** Legacy themed labels retained only for bookmarked `?team=` URLs. */
const LEGACY_POD_ALIASES: Record<string, string> = {
  "Sunrise Saguaros": "Team 1",
  "Desert Roadrunners": "Team 2",
  "Camelback Coyotes": "Team 3",
  "Papago Phoenix": "Team 4",
  "Sunset Scorpions": "Team 5",
  "Night Owls": "Team 6",
};

function canonicalPodName(key: string, pod: Pod): string {
  if (CANONICAL_POD_RE.test(key)) return key;

  const supNum = pod.supervisor_id?.match(/^Sup_(\d+)$/)?.[1];
  if (supNum) return `Team ${Number(supNum)}`;

  return key;
}

function snapshotUsesLegacyPodNames(pods: Record<string, Pod>): boolean {
  return Object.keys(pods).some((key) => !CANONICAL_POD_RE.test(key));
}

/** Renames non-canonical pod keys to Team 1–6 using each pod's supervisor_id. */
export function normalizeSnapshotPods(snapshot: Snapshot): Snapshot {
  if (!snapshotUsesLegacyPodNames(snapshot.pods)) return snapshot;

  const pods: Record<string, Pod> = {};
  for (const [key, pod] of Object.entries(snapshot.pods)) {
    pods[canonicalPodName(key, pod)] = pod;
  }

  return { ...snapshot, pods };
}

/** Maps a legacy themed label (or passthrough Team N) for URL/deep links. */
export function resolveCanonicalPodName(name: string): string {
  if (CANONICAL_POD_RE.test(name)) return name;
  return LEGACY_POD_ALIASES[name] ?? name;
}
