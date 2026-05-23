import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { SNAPSHOT_TAG } from "@/lib/data/snapshot";
import { createWriteClient } from "@/lib/supabase/server";

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing required query parameter: id" },
        { status: 400 }
      );
    }

    const supabase = createWriteClient();

    // #region agent log
    fetch('http://127.0.0.1:7652/ingest/f98b42a6-0ecb-4542-93cc-9816df326eaf',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'126045'},body:JSON.stringify({sessionId:'126045',hypothesisId:'D',location:'app/api/optimize/delete/route.ts:20',message:'Attempting to delete optimization record',data:{id},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    const { error } = await supabase
      .rpc("delete_optimization", { target_id: id });

    if (error) {
      // #region agent log
      fetch('http://127.0.0.1:7652/ingest/f98b42a6-0ecb-4542-93cc-9816df326eaf',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'126045'},body:JSON.stringify({sessionId:'126045',hypothesisId:'D',location:'app/api/optimize/delete/route.ts:31',message:'Optimization record deletion failed',data:{error:error.message},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return NextResponse.json(
        { ok: false, error: "Failed to delete optimization run", details: error.message },
        { status: 500 }
      );
    }

    // Force revalidation of cache tag
    // @ts-expect-error - Deprecated single-argument form in Next.js 16 types but remains functional at runtime
    revalidateTag(SNAPSHOT_TAG);

    return NextResponse.json({
      ok: true,
      message: "Optimization run deleted successfully.",
    });
  } catch (error: any) {
    console.error("Failed to delete optimization run:", error);
    return NextResponse.json(
      { ok: false, error: "Deletion failed", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

// Support POST as a fail-safe fallback for environments with client verb limitations
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get("id");

    if (!id) {
      const body = await request.json().catch(() => ({}));
      id = body?.id;
    }

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing required parameter: id" },
        { status: 400 }
      );
    }

    const supabase = createWriteClient();
    const { error } = await supabase
      .rpc("delete_optimization", { target_id: id });

    if (error) {
      return NextResponse.json(
        { ok: false, error: "Failed to delete optimization run", details: error.message },
        { status: 500 }
      );
    }

    // @ts-expect-error - Deprecated single-argument form in Next.js 16 types but remains functional at runtime
    revalidateTag(SNAPSHOT_TAG);

    return NextResponse.json({
      ok: true,
      message: "Optimization run deleted successfully.",
    });
  } catch (error: any) {
    console.error("Failed to delete optimization run:", error);
    return NextResponse.json(
      { ok: false, error: "Deletion failed", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
