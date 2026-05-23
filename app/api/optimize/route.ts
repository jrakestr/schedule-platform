import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { SNAPSHOT_TAG } from "@/lib/data/snapshot";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

const execPromise = promisify(exec);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // 1. Establish absolute paths
    const workspaceRoot = path.resolve(process.cwd(), "..");
    const constraintsPath = path.join(workspaceRoot, "output", "optimizer_constraints.json");
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(constraintsPath), { recursive: true });
    
    // 2. Write the JSON constraints
    await fs.writeFile(constraintsPath, JSON.stringify(body, null, 2), "utf-8");
    
    // 3. Sequentially execute Python optimization scripts with a strict timeout boundary
    const options = {
      cwd: workspaceRoot,
      timeout: 35000, // 35 seconds max execution limit to prevent server timeouts
    };
    
    // Command A: Run CP-SAT solver with dynamic constraints
    await execPromise(
      "python3 scripts/optimize_roster_with_cubicles.py --catalog output/shift_catalog_staggered.json --out output/exp_template/weekly_roster.csv --constraints-json output/optimizer_constraints.json",
      options
    );
    
    // Command B: Post-process hot-desk cubicle allocations
    await execPromise(
      "python3 scripts/assign_cubicles.py --roster output/exp_template/weekly_roster.csv --out output/weekly_roster_with_cubicles.csv",
      options
    );
    
    // Command C: Recompile platform data.json
    await execPromise(
      "python3 scripts/build_platform_data.py",
      options
    );
    
    // 4. Copy the compiled data.json to fallback snapshot location
    const sourceDataJson = path.join(workspaceRoot, "output", "schedule-review-platform", "data.json");
    const destDataJson = path.join(process.cwd(), "data", "platform-snapshot.json");
    
    await fs.mkdir(path.dirname(destDataJson), { recursive: true });
    await fs.copyFile(sourceDataJson, destDataJson);
    
    // 5. Invalidate Next.js Server Cache tags instantly
    revalidateTag(SNAPSHOT_TAG, "max");
    
    // Read and return the fresh compiled snapshot
    const rawData = await fs.readFile(destDataJson, "utf-8");
    const freshSnapshot = JSON.parse(rawData);
    
    return NextResponse.json({
      ok: true,
      snapshot: freshSnapshot,
      optimized_at: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Optimization failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Optimization failed",
        details: error?.message || String(error),
        stderr: error?.stderr || ""
      },
      { status: 500 }
    );
  }
}
