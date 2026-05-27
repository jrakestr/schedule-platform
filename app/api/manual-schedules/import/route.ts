import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createWriteClient,
  getAuthedUser,
  unauthorizedResponse,
} from "@/lib/supabase/server";

const SHIFT_VALUE_RE = /^(?:OFF|([01]?\d|2[0-3]):[0-5]\d-([01]?\d|2[0-3]):[0-5]\d)$/;
const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type Day = (typeof DAY_HEADERS)[number];

const bodySchema = z.object({
  csv: z.string().min(1, "csv body must be non-empty"),
});

type ParsedRow = {
  agent_id: string;
  schedule: Record<Day, string>;
};

function parseCsv(csv: string): { rows: ParsedRow[]; errors: string[] } {
  const errors: string[] = [];
  const lines = csv.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { rows: [], errors: ["empty CSV"] };
  }

  const header = lines[0].split(",").map((s) => s.trim());
  const idIdx = header.indexOf("agent_id");
  if (idIdx === -1) {
    return { rows: [], errors: ["header must include agent_id"] };
  }
  const dayIdx: Record<Day, number> = {} as Record<Day, number>;
  for (const day of DAY_HEADERS) {
    const i = header.indexOf(day);
    if (i === -1) {
      errors.push(`header missing day column: ${day}`);
    } else {
      dayIdx[day] = i;
    }
  }
  if (errors.length) return { rows: [], errors };

  const rows: ParsedRow[] = [];
  for (let lineNo = 1; lineNo < lines.length; lineNo++) {
    const cells = lines[lineNo].split(",").map((s) => s.trim());
    const agentId = cells[idIdx];
    if (!agentId) {
      errors.push(`line ${lineNo + 1}: missing agent_id`);
      continue;
    }
    const schedule = {} as Record<Day, string>;
    let lineOk = true;
    for (const day of DAY_HEADERS) {
      const val = cells[dayIdx[day]] ?? "";
      if (!SHIFT_VALUE_RE.test(val)) {
        errors.push(`line ${lineNo + 1} (${agentId}): invalid ${day} value "${val}" (expected OFF or HH:MM-HH:MM)`);
        lineOk = false;
        break;
      }
      schedule[day] = val;
    }
    if (lineOk) rows.push({ agent_id: agentId, schedule });
  }

  return { rows, errors };
}

export async function POST(req: Request) {
  const user = await getAuthedUser();
  if (!user) return unauthorizedResponse();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { rows, errors } = parseCsv(parsed.data.csv);
  if (errors.length) {
    return NextResponse.json(
      { ok: false, error: "CSV parse errors", details: errors },
      { status: 400 },
    );
  }
  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "no data rows" }, { status: 400 });
  }

  const supabase = createWriteClient();
  const { data, error } = await supabase.rpc("bulk_update_manual_schedules", {
    p_updates: rows,
    p_updated_by: user.email ?? user.id,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: data ?? 0, submitted: rows.length });
}
