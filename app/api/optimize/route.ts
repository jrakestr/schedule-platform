import { NextResponse } from "next/server";
import { createWriteClient } from "@/lib/supabase/server";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { optimizerConstraintsSchema } from "@/lib/data/schemas";

const execPromise = promisify(exec);

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    
    if (!body) {
      return NextResponse.json(
        { ok: false, code: "MALFORMED_JSON", error: "Request body cannot be empty or malformed." },
        { status: 400 }
      );
    }

    const validation = optimizerConstraintsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          error: "The provided optimization parameters are invalid.",
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }
    
    const { name, notes, shifts, cubicleCap } = validation.data;
    
    // 1. Establish Supabase write client
    const supabase = createWriteClient();
    
    // #region agent log
    fetch('http://127.0.0.1:7652/ingest/f98b42a6-0ecb-4542-93cc-9816df326eaf',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'126045'},body:JSON.stringify({sessionId:'126045',hypothesisId:'A',location:'app/api/optimize/route.ts:39',message:'Attempting to insert optimizations record',data:{name,notes,cubicleCap},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    // 2. Insert optimization run with 'pending' status
    const { data: runId, error: insertError } = await supabase
      .rpc("insert_optimization", {
        run_name: name,
        notes: notes || "",
        constraints: { shifts: shifts || {}, cubicleCap: cubicleCap || 34 },
      });
      
    if (insertError || !runId) {
      // #region agent log
      fetch('http://127.0.0.1:7652/ingest/f98b42a6-0ecb-4542-93cc-9816df326eaf',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'126045'},body:JSON.stringify({sessionId:'126045',hypothesisId:'A',location:'app/api/optimize/route.ts:54',message:'Optimizations record insertion failed',data:{error:insertError?.message || 'No record',code:insertError?.code},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      console.error("Database insert failed:", insertError);
      return NextResponse.json(
        {
          ok: false,
          code: "DATABASE_INIT_FAILURE",
          error: "Failed to initialize optimization record in the database.",
          details: insertError?.message || "No record returned",
        },
        { status: 503 }
      );
    }
    
    const id = runId;
    
    // 3. Kick off solver in the background (fire-and-forget)
    runOptimizationInBackground(id).catch((err) => {
      console.error(`[Fatal] Background launcher failed for optimization run ${id}:`, err);
    });
    
    // 4. Return 202 Accepted immediately
    return NextResponse.json(
      {
        ok: true,
        id: id,
        status: "pending",
        message: "Optimization run initiated successfully in the background.",
      },
      { status: 202 }
    );
  } catch (error: any) {
    console.error("Unhandled API Boundary exception:", error);
    return NextResponse.json(
      {
        ok: false,
        code: "UNHANDLED_SERVER_ERROR",
        error: "An internal unexpected server exception occurred.",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}

async function runOptimizationInBackground(id: string) {
  const supabase = createWriteClient();
  
  // Update status to 'running'
  await supabase
    .rpc("update_optimization_status", {
      target_id: id,
      p_status: "running",
    });
    
  try {
    const workspaceRoot = path.resolve(process.cwd(), "..");
    
    // Environment configurations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zxmtztietmjfmjyszngb.supabase.co";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const revalidateSecret = process.env.REVALIDATE_SECRET || "";
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mjm-schedule.vercel.app";
    const useDocker = process.env.USE_DOCKER === "true";

    const envs = {
      SUPABASE_URL: supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      REVALIDATE_SECRET: revalidateSecret,
      NEXT_PUBLIC_SITE_URL: siteUrl,
      ...process.env,
    };

    const options = {
      cwd: workspaceRoot,
      timeout: 180000, // 3-minute safety net
      env: envs,
    };

    let command: string;
    if (useDocker) {
      console.log(`[Background Task] Running in Docker container for run ${id}`);
      command = `docker run --rm -v /tmp:/tmp -e SUPABASE_URL="${supabaseUrl}" -e SUPABASE_SERVICE_ROLE_KEY="${serviceRoleKey}" -e NEXT_PUBLIC_SITE_URL="${siteUrl}" -e REVALIDATE_SECRET="${revalidateSecret}" schedule-optimizer-container --run-id ${id}`;
    } else {
      console.log(`[Background Task] Running natively via python3 for run ${id}`);
      command = `python3 scripts/solve_orchestrator.py --run-id ${id}`;
    }

    const { stdout, stderr } = await execPromise(command, options);
    console.log(`[Background Task Success] id=${id}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);

  } catch (error: any) {
    console.error(`[Background Task Failed] id=${id}:`, error);
    
    // Update record with failure status and error details
    await supabase
      .rpc("update_optimization_status", {
        target_id: id,
        p_status: "failed",
        p_error_details: error?.message || String(error),
      });
  }
}
