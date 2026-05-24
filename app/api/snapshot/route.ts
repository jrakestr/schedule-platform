import { connection, NextRequest, NextResponse } from "next/server";
import { getLatestSnapshot } from "@/lib/data/snapshot";

export async function GET(request: NextRequest) {
  await connection();

  try {
    const optId = request.nextUrl.searchParams.get("opt_id") ?? undefined;
    const snapshot = await getLatestSnapshot(optId);
    return NextResponse.json({ ok: true, snapshot });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: "Failed to load snapshot", details: message },
      { status: 500 },
    );
  }
}
