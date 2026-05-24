import { NextResponse, after } from "next/server";
import { createWriteClient } from "@/lib/supabase/server";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import { optimizerConstraintsSchema } from "@/lib/data/schemas";

const execFilePromise = promisify(execFile);

const DEFAULT_CUBICLE_CAP = 34;
const SOLVER_TIMEOUT_MS = 3 * 60 * 1000;
const DOCKER_IMAGE = "schedule-optimizer-container";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RunStatus = "pending" | "running" | "succeeded" | "failed";

type RunConstraints = {
  shifts: Record<string, { enabled: boolean; maxCount: number }>;
  cubicleCap: number;
};

type ApiError = {
  ok: false;
  code: string;
  error: string;
  details?: unknown;
};

type ApiSuccess<T extends Record<string, unknown>> = { ok: true } & T;

function jsonError(status: number, code: string, error: string, details?: unknown) {
  const body: ApiError = { ok: false, code, error, ...(details !== undefined ? { details } : {}) };
  return NextResponse.json(body, { status });
}

function jsonSuccess<T extends Record<string, unknown>>(status: number, body: ApiSuccess<T>) {
  return NextResponse.json(body, { status });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseRunId(value: unknown): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw new Error("insert_optimization returned an invalid run id.");
  }
  return value;
}

function debugLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
) {
  // #region agent log
  fetch("http://127.0.0.1:7652/ingest/f98b42a6-0ecb-4542-93cc-9816df326eaf", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "126045" },
    body: JSON.stringify({
      sessionId: "126045",
      location,
      message,
      data,
      hypothesisId,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

function logEvent(event: string, fields: Record<string, unknown>) {
  console.log(JSON.stringify({ event, ...fields, ts: new Date().toISOString() }));
}

function resolveWorkspaceRoot(): string {
  const explicit = process.env.SOLVER_WORKSPACE_ROOT;
  if (explicit) {
    return path.resolve(explicit);
  }

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

  throw new Error(
    "Solver workspace not found. Set SOLVER_WORKSPACE_ROOT or deploy with scripts/output.",
  );
}

function buildChildEnv(): NodeJS.ProcessEnv {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const siteUrl = requireEnv("NEXT_PUBLIC_SITE_URL");
  const revalidateSecret = process.env.REVALIDATE_SECRET ?? "";

  return {
    ...process.env,
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    NEXT_PUBLIC_SITE_URL: siteUrl,
    REVALIDATE_SECRET: revalidateSecret,
  };
}

async function updateRunStatus(
  runId: string,
  status: RunStatus,
  errorDetails?: string,
): Promise<void> {
  const supabase = createWriteClient();
  const payload: Record<string, string> = {
    target_id: runId,
    p_status: status,
  };
  if (errorDetails !== undefined) {
    payload.p_error_details = errorDetails;
  }

  const { error } = await supabase.rpc("update_optimization_status", payload);
  if (error) {
    logEvent("optimization.status_update_failed", { runId, status, error: error.message });
    debugLog(
      "route.ts:updateRunStatus",
      "status update RPC failed",
      { runId, status, error: error.message },
      "D",
    );
    throw new Error(`Failed to update optimization status to '${status}': ${error.message}`);
  }

  debugLog(
    "route.ts:updateRunStatus",
    "status update RPC succeeded",
    { runId, status },
    "D",
  );
}

/**
 * Dispatches a pending optimization run to an external solver worker.
 * Preconditions: SOLVER_WORKER_URL must be set. Mutates nothing locally.
 */
async function dispatchToExternalWorker(runId: string): Promise<void> {
  const workerUrl = requireEnv("SOLVER_WORKER_URL");
  const workerSecret = process.env.SOLVER_WORKER_SECRET ?? "";

  logEvent("optimization.dispatch_worker", { runId, mode: "external_worker" });
  debugLog(
    "route.ts:dispatchToExternalWorker",
    "dispatching to external worker",
    { runId, hasSecret: Boolean(workerSecret) },
    "E",
  );

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

/**
 * Runs the CP-SAT solver pipeline for a single optimization record.
 * Mutates the optimization row status in Supabase. Never logs secrets or shell commands.
 */
async function runOptimizationInBackground(runId: string, constraints: RunConstraints): Promise<void> {
  await updateRunStatus(runId, "running");

  const constraintsPath = path.join("/tmp", `constraints-${runId}.json`);

  try {
    await writeFile(constraintsPath, JSON.stringify(constraints, null, 2), "utf-8");
    debugLog(
      "route.ts:runOptimizationInBackground",
      "wrote constraints scratch file",
      { runId, constraintsPath },
      "F",
    );

    if (process.env.SOLVER_WORKER_URL) {
      await dispatchToExternalWorker(runId);
      return;
    }

    const isProduction = process.env.NODE_ENV === "production";
    const allowInlineSolver = process.env.ALLOW_INLINE_SOLVER === "true";
    if (isProduction && !allowInlineSolver) {
      throw new Error(
        "Inline solver is disabled in production. Set SOLVER_WORKER_URL or ALLOW_INLINE_SOLVER=true.",
      );
    }

    const workspaceRoot = resolveWorkspaceRoot();
    const orchestratorPath = path.join(workspaceRoot, "scripts", "solve_orchestrator.py");
    if (!existsSync(orchestratorPath)) {
      throw new Error(
        `Solver orchestrator not found at ${orchestratorPath}. Set SOLVER_WORKSPACE_ROOT or SOLVER_WORKER_URL.`,
      );
    }

    const childEnv = buildChildEnv();
    const useDocker = process.env.USE_DOCKER === "true";

    logEvent("optimization.dispatch_inline", {
      runId,
      mode: useDocker ? "docker" : "python",
      workspaceRoot,
    });
    debugLog(
      "route.ts:runOptimizationInBackground",
      "starting inline solver via execFile",
      { runId, useDocker, workspaceRoot, orchestratorExists: true },
      "A",
    );

    const execOptions = {
      cwd: workspaceRoot,
      timeout: SOLVER_TIMEOUT_MS,
      env: childEnv,
      maxBuffer: 10 * 1024 * 1024,
    };

    const { stdout, stderr } = useDocker
      ? await execFilePromise(
          "docker",
          [
            "run",
            "--rm",
            "-v",
            "/tmp:/tmp",
            "-e",
            "SUPABASE_URL",
            "-e",
            "SUPABASE_SERVICE_ROLE_KEY",
            "-e",
            "NEXT_PUBLIC_SITE_URL",
            "-e",
            "REVALIDATE_SECRET",
            DOCKER_IMAGE,
            "--run-id",
            runId,
            "--constraints-json",
            constraintsPath,
          ],
          { ...execOptions, env: childEnv },
        )
      : await execFilePromise(
          "python3",
          [orchestratorPath, "--run-id", runId, "--constraints-json", constraintsPath],
          execOptions,
        );

    logEvent("optimization.inline_success", {
      runId,
      stdoutBytes: stdout.length,
      stderrBytes: stderr.length,
    });
    debugLog(
      "route.ts:runOptimizationInBackground",
      "inline solver completed",
      { runId, stdoutPreview: stdout.slice(0, 200), stderrPreview: stderr.slice(0, 200) },
      "A",
    );
  } catch (error: unknown) {
    const message = errorMessage(error);
    logEvent("optimization.inline_failed", { runId, error: message });
    debugLog(
      "route.ts:runOptimizationInBackground",
      "inline solver failed",
      { runId, error: message },
      "B",
    );

    try {
      await updateRunStatus(runId, "failed", message);
    } catch (statusError: unknown) {
      logEvent("optimization.failed_status_update_failed", {
        runId,
        error: errorMessage(statusError),
      });
    }
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body) {
      return jsonError(400, "MALFORMED_JSON", "Request body cannot be empty or malformed.");
    }

    const validation = optimizerConstraintsSchema.safeParse(body);
    if (!validation.success) {
      return jsonError(
        400,
        "VALIDATION_ERROR",
        "The provided optimization parameters are invalid.",
        validation.error.flatten(),
      );
    }

    const { name, notes, shifts, cubicleCap } = validation.data;

    debugLog(
      "route.ts:POST",
      "validation succeeded",
      {
        shiftKeys: Object.keys(shifts),
        cubicleCap,
        twelveHourEnabled: shifts.twelveHour.enabled,
        splitShiftEnabled: shifts.splitShift.enabled,
      },
      "C",
    );

    const supabase = createWriteClient();

    const { data: insertedRunId, error: insertError } = await supabase.rpc("insert_optimization", {
      run_name: name,
      notes: notes ?? "",
      constraints: { shifts, cubicleCap: cubicleCap ?? DEFAULT_CUBICLE_CAP },
    });

    if (insertError) {
      console.error("Database insert failed:", insertError);
      debugLog(
        "route.ts:POST",
        "insert_optimization RPC failed",
        { code: insertError.code, message: insertError.message },
        "D",
      );
      return jsonError(
        500,
        "DATABASE_INIT_FAILURE",
        "Failed to initialize optimization record in the database.",
        insertError.message,
      );
    }

    let runId: string;
    try {
      runId = parseRunId(insertedRunId);
    } catch (error: unknown) {
      return jsonError(
        500,
        "DATABASE_INIT_FAILURE",
        "Failed to initialize optimization record in the database.",
        errorMessage(error),
      );
    }

    debugLog(
      "route.ts:POST",
      "optimization row inserted",
      { runId, dispatchMode: process.env.SOLVER_WORKER_URL ? "worker" : "inline" },
      "E",
    );

    after(async () => {
      try {
        await runOptimizationInBackground(runId, {
          shifts,
          cubicleCap: cubicleCap ?? DEFAULT_CUBICLE_CAP,
        });
      } catch (error: unknown) {
        logEvent("optimization.background_fatal", {
          runId,
          error: errorMessage(error),
        });
      }
    });

    return jsonSuccess(202, {
      ok: true,
      id: runId,
      status: "pending" satisfies RunStatus,
      message: "Optimization run initiated successfully in the background.",
    });
  } catch (error: unknown) {
    console.error("Unhandled API Boundary exception:", error);
    return jsonError(
      500,
      "UNHANDLED_SERVER_ERROR",
      "An internal unexpected server exception occurred.",
      errorMessage(error),
    );
  }
}
