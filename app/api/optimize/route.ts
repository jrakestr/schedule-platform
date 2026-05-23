import { NextResponse, after } from "next/server";
import { createWriteClient } from "@/lib/supabase/server";
import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import path from "node:path";
import { optimizerConstraintsSchema } from "@/lib/data/schemas";

const execPromise = promisify(exec);

function resolveWorkspaceRoot(): string {
  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), ".."),
    path.resolve(process.cwd(), "../.."),
  ];
  for (const root of candidates) {
    if (existsSync(path.join(root, "scripts", "solve_orchestrator.py"))) {
      return root;
    }
  }
  return path.resolve(process.cwd(), "..");
}

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
    
    // 2. Insert optimization run with 'pending' status
    const { data: runId, error: insertError } = await supabase
      .rpc("insert_optimization", {
        run_name: name,
        notes: notes || "",
        constraints: { shifts: shifts || {}, cubicleCap: cubicleCap || 34 },
      });
      
    if (insertError || !runId) {
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
    
    // 3. Keep the solver alive after the 202 response (Vercel/serverless safe).
    after(async () => {
      try {
        await runOptimizationInBackground(id);
      } catch (err) {
        console.error(`[Fatal] Background launcher failed for optimization run ${id}:`, err);
      }
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

async function dispatchToExternalWorker(runId: string): Promise<void> {
  const workerUrl = process.env.SOLVER_WORKER_URL;
  if (!workerUrl) {
    throw new Error("SOLVER_WORKER_URL is not configured.");
  }

  const workerSecret = process.env.SOLVER_WORKER_SECRET || "";
  console.log(`[Background Task] Dispatching run ${runId} to external solver worker`);

  const response = await fetch(workerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(workerSecret ? { Authorization: `Bearer ${workerSecret}` } : {}),
    },
    body: JSON.stringify({ runId }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(
      `External solver worker returned ${response.status}${details ? `: ${details}` : ""}`,
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
    if (process.env.SOLVER_WORKER_URL) {
      await dispatchToExternalWorker(id);
      return;
    }

    const workspaceRoot = resolveWorkspaceRoot();
    const orchestratorPath = path.join(workspaceRoot, "scripts", "solve_orchestrator.py");
    if (!existsSync(orchestratorPath)) {
      throw new Error(
        `Solver orchestrator not found at ${orchestratorPath}. ` +
          "Deploy scripts/output with the app or set SOLVER_WORKER_URL.",
      );
    }
    
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
      console.log(`[Background Task] Running natively via python3 for run ${id} (cwd=${workspaceRoot})`);
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
