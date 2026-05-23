import { cacheLife, cacheTag } from "next/cache";
import { createReadClient } from "@/lib/supabase/server";
import type { Snapshot } from "@/lib/data/types";

export const SNAPSHOT_TAG = "platform-snapshot";

interface SnapshotRecord {
  payload: Snapshot;
  taken_at: string;
}

interface RpcRow {
  payload: Snapshot;
  taken_at: string;
  source_rows: number;
}

export interface OptimizationMeta {
  id: string;
  created_at: string;
  run_name: string;
  status: "pending" | "running" | "succeeded" | "failed";
  kpis: any;
  notes?: string;
}

async function readFromSupabase(): Promise<SnapshotRecord | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasKey =
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !hasKey) return null;

  const supabase = createReadClient();
  const { data, error } = await supabase.rpc("get_baseline_platform_snapshot");

  if (error) {
    throw new Error(`Failed to load platform snapshot: ${error.message}`);
  }
  const rows = (data ?? []) as RpcRow[];
  const row = rows[0];
  if (!row) return null;
  return { payload: row.payload, taken_at: row.taken_at };
}

async function readOptimizationFromSupabase(optId: string): Promise<SnapshotRecord | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasKey =
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !hasKey) return null;

  const supabase = createReadClient();
  const { data, error } = await supabase.rpc("get_optimization", { target_id: optId });

  if (error) {
    console.error(`Failed to load optimization ${optId}: ${error.message}`);
    return null;
  }
  if (!data) return null;
  return { payload: data as Snapshot, taken_at: new Date().toISOString() };
}

// Local-file fallback. Used in dev (no DB needed to run `next dev`) and as a
// safety net during the production build when env vars are absent so that
// first-time deploys can complete and the publish-platform job can seed
// Supabase afterwards. On the deployed Vercel runtime, NEXT_PUBLIC_SUPABASE_URL
// + SUPABASE_SERVICE_ROLE_KEY will be set and Supabase wins by precedence.
async function readFromLocalFile(): Promise<SnapshotRecord | null> {
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const candidates = [
      path.resolve(
        process.cwd(),
        "..",
        "output",
        "schedule-review-platform",
        "data.json",
      ),
      path.resolve(
        process.cwd(),
        "data",
        "platform-snapshot.json",
      ),
    ];
    for (const candidate of candidates) {
      try {
        const raw = await fs.readFile(candidate, "utf-8");
        return {
          payload: JSON.parse(raw) as Snapshot,
          taken_at: new Date().toISOString(),
        };
      } catch {
        continue;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function loadSnapshotRecord(optId?: string): Promise<SnapshotRecord> {
  if (optId) {
    const optRecord = await readOptimizationFromSupabase(optId);
    if (optRecord) return optRecord;
    console.warn(`Optimization run ${optId} not found, falling back to default baseline.`);
  }

  const fromDb = await readFromSupabase();
  if (fromDb) return fromDb;
  const fromFile = await readFromLocalFile();
  if (fromFile) return fromFile;
  throw new Error(
    "No snapshot available. In production set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and run `make publish-platform`. In dev, place data.json at ../output/schedule-review-platform/data.json.",
  );
}

export async function getLatestSnapshot(optId?: string): Promise<Snapshot> {
  const record = await loadSnapshotRecord(optId);
  return record.payload;
}

export async function getSnapshotTakenAt(optId?: string): Promise<string | null> {
  try {
    const record = await loadSnapshotRecord(optId);
    return record.taken_at;
  } catch {
    return null;
  }
}

export async function listOptimizations(): Promise<OptimizationMeta[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasKey =
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !hasKey) return [];

  try {
    const supabase = createReadClient();
    const { data, error } = await supabase.rpc("list_optimizations");

    if (error) {
      console.error(`Failed to list optimizations from database: ${error.message}`);
      return [];
    }
    return (data ?? []) as OptimizationMeta[];
  } catch (err) {
    console.error("Failed to list optimizations:", err);
    return [];
  }
}
