import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createReadClient,
  createWriteClient,
  getAuthedUser,
  unauthorizedResponse,
} from "@/lib/supabase/server";

const DAY_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const SHIFT_VALUE_RE = /^(?:OFF|([01]?\d|2[0-3]):[0-5]\d-([01]?\d|2[0-3]):[0-5]\d)$/;

const scheduleSchema = z.object({
  Mon: z.string().regex(SHIFT_VALUE_RE),
  Tue: z.string().regex(SHIFT_VALUE_RE),
  Wed: z.string().regex(SHIFT_VALUE_RE),
  Thu: z.string().regex(SHIFT_VALUE_RE),
  Fri: z.string().regex(SHIFT_VALUE_RE),
  Sat: z.string().regex(SHIFT_VALUE_RE),
  Sun: z.string().regex(SHIFT_VALUE_RE),
});

const bulkUpdateSchema = z.object({
  updates: z
    .array(
      z.object({
        agent_id: z.string().min(1),
        schedule: scheduleSchema,
      }),
    )
    .min(1),
});

export type ManualScheduleRow = {
  agent_id: string;
  name: string;
  role: "SDS" | "Next Day" | "Supervisor";
  schedule: Record<(typeof DAY_KEYS)[number], string>;
  updated_at: string;
  updated_by: string | null;
};

export async function GET() {
  const supabase = createReadClient();
  const { data, error } = await supabase.rpc("list_manual_schedules");
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, rows: data ?? [] });
}

export async function PUT(req: Request) {
  const user = await getAuthedUser();
  if (!user) return unauthorizedResponse();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = bulkUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const supabase = createWriteClient();
  const { data, error } = await supabase.rpc("bulk_update_manual_schedules", {
    p_updates: parsed.data.updates,
    p_updated_by: user.email ?? user.id,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, updated: data ?? 0 });
}
