import { connection, NextRequest, NextResponse } from "next/server";
import { normalizeSnapshotPods } from "@/lib/data/normalize-snapshot";
import { createWriteClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  await connection();

  try {
    const id = request.nextUrl.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing required query parameter: id" },
        { status: 400 }
      );
    }

    const includePayload = request.nextUrl.searchParams.get("include_payload") === "true";

    const supabase = createWriteClient();
    const { data, error } = await supabase
      .rpc("get_optimization_status", { target_id: id });

    if (error || !data || data.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Optimization run not found", details: error?.message },
        { status: 404 }
      );
    }

    const run = { ...data[0] };
    if (!includePayload) {
      delete run.payload;
    } else if (run.payload) {
      run.payload = normalizeSnapshotPods(run.payload);
    }

    return NextResponse.json({
      ok: true,
      run,
    });
  } catch (error: any) {
    console.error("Failed to query status:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to query status", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
