import { NextResponse } from "next/server";
import { z } from "zod";
import { createWriteClient } from "@/lib/supabase/server";

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

const putBodySchema = z.object({ schedule: scheduleSchema });

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ agent_id: string }> },
) {
  const { agent_id } = await params;
  if (!agent_id) {
    return NextResponse.json({ ok: false, error: "Missing agent_id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = putBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const supabase = createWriteClient();
  const { data, error } = await supabase.rpc("update_manual_schedule", {
    p_agent_id: agent_id,
    p_schedule: parsed.data.schedule,
    p_updated_by: null,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    // RPC refuses to touch out-of-scope roles (CSAs, etc.) and returns no rows.
    return NextResponse.json(
      { ok: false, error: `agent_id ${agent_id} not in manual-schedule scope` },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, row: Array.isArray(data) ? data[0] : data });
}
