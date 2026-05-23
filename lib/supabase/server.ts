import { createClient } from "@supabase/supabase-js";

// Read-only Supabase client used by the Next.js server to fetch the latest
// platform snapshot. Uses the publishable (anon) key — the schedule data is
// reviewed internally and the only mutating operation (seed_platform_snapshot)
// is locked to service_role inside Postgres. The Next.js app calls
// public.get_latest_platform_snapshot() via PostgREST RPC, so the analytics
// schema does not need to be exposed.
export function createReadClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY as a fallback)",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-application-name": "schedule-platform" } },
  });
}
