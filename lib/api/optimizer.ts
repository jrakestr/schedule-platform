import { optimizerConstraintsSchema, type OptimizerConstraints } from "../data/schemas";

export class OptimizerLaunchError extends Error {
  public readonly status?: number;
  public readonly code?: string;
  public readonly details?: unknown;
  public readonly payload: OptimizerConstraints;

  constructor(message: string, options: { status?: number; code?: string; details?: unknown; payload: OptimizerConstraints }) {
    super(message);
    this.name = "OptimizerLaunchError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.payload = options.payload;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, OptimizerLaunchError);
    }
  }
}

interface LaunchResponse {
  ok: boolean;
  id: string;
  status: string;
  message?: string;
}

export async function launchOptimization(
  payload: OptimizerConstraints,
  timeoutMs: number = 15000
): Promise<LaunchResponse> {
  // Pre-flight checks on client side
  const validation = optimizerConstraintsSchema.safeParse(payload);
  if (!validation.success) {
    throw new OptimizerLaunchError("Pre-flight validation failed.", {
      code: "PREFLIGHT_VALIDATION_ERROR",
      details: validation.error.format(),
      payload,
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const endpoint = process.env.NEXT_PUBLIC_API_URL 
    ? `${process.env.NEXT_PUBLIC_API_URL}/api/optimize` 
    : "/api/optimize";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validation.data), // Send sanitized schema output
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new OptimizerLaunchError(
        errorBody.message || errorBody.error || `Server error: ${response.status}`,
        {
          status: response.status,
          code: errorBody.code || "SERVER_ERROR",
          details: errorBody.details || null,
          payload,
        }
      );
    }

    return (await response.json()) as LaunchResponse;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    console.group("❌ Optimizer Launch Failure");
    console.error("Reason:", error.message);
    if (error instanceof OptimizerLaunchError) {
      console.error("Details:", error.details);
    }
    console.groupEnd();

    if (error instanceof OptimizerLaunchError) throw error;
    if (error.name === "AbortError") {
      throw new OptimizerLaunchError(`Request timeout limit of ${timeoutMs / 1000}s reached.`, {
        code: "TIMEOUT_ERROR",
        payload,
      });
    }

    throw new OptimizerLaunchError(error.message || "Network layer exception occurred.", {
      code: "UNKNOWN_TRANSPORT_ERROR",
      details: error,
      payload,
    });
  }
}
