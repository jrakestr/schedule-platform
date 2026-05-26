import { describe, expect, it, vi, afterEach } from "vitest";
import { fetchOptimizationSnapshot } from "@/lib/api/snapshot";

describe("fetchOptimizationSnapshot", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("surfaces API details in thrown errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          ok: false,
          error: "Failed to load snapshot",
          details: "Optimization run abc not found or not succeeded.",
        }),
      }),
    );

    await expect(fetchOptimizationSnapshot("abc")).rejects.toThrow(
      "Optimization run abc not found or not succeeded.",
    );
  });

  it("returns snapshot payload on success", async () => {
    const snapshot = { meta: { source: "test.csv" }, agents: [] };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, snapshot }),
      }),
    );

    await expect(fetchOptimizationSnapshot("run-1")).resolves.toEqual(snapshot);
  });
});
