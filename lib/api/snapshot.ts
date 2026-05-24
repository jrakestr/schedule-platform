import type { Snapshot } from "@/lib/data/types";

export async function fetchOptimizationSnapshot(optId: string): Promise<Snapshot> {
  const response = await fetch(
    `/api/snapshot?opt_id=${encodeURIComponent(optId)}`,
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok || !body.snapshot) {
    throw new Error(body.error || `Failed to load optimization snapshot (${response.status}).`);
  }
  return body.snapshot as Snapshot;
}
