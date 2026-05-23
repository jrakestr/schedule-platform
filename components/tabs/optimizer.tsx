"use client";

import { useState } from "react";
import { Settings2, Play, RefreshCw, AlertTriangle } from "lucide-react";
import { SectionCard } from "@/components/shared/section-card";
import { StatTile } from "@/components/charts/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { Snapshot } from "@/lib/data/types";

interface OptimizerTabProps {
  snapshot: Snapshot;
  onUpdateSnapshot: (newSnapshot: Snapshot) => void;
}

interface ShiftConstraint {
  enabled: boolean;
  mode: "count" | "percentage";
  maxCount: number;
  percentage: number;
}

export function OptimizerTab({ snapshot, onUpdateSnapshot }: OptimizerTabProps) {
  const [isSolving, setIsSolving] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  // Core Shift State Defaults
  const [sixHour, setSixHour] = useState<ShiftConstraint>({
    enabled: true,
    mode: "count",
    maxCount: 6,
    percentage: 15,
  });

  const [eightHour, setEightHour] = useState<ShiftConstraint>({
    enabled: true,
    mode: "count",
    maxCount: 36,
    percentage: 80,
  });

  const [tenHour, setTenHour] = useState<ShiftConstraint>({
    enabled: true,
    mode: "count",
    maxCount: 8,
    percentage: 20,
  });

  const [twelveHour, setTwelveHour] = useState<ShiftConstraint>({
    enabled: false,
    mode: "count",
    maxCount: 0,
    percentage: 0,
  });

  // Total headcount of cubicle-occupying agents = 47
  const TOTAL_HEADCOUNT = 47;

  // Convert percentage or hard count state to absolute maxCount for the API
  const getAbsoluteCount = (sc: ShiftConstraint): number => {
    if (!sc.enabled) return 0;
    if (sc.mode === "percentage") {
      return Math.round((sc.percentage / 100) * TOTAL_HEADCOUNT);
    }
    return sc.maxCount;
  };

  const handleRunOptimization = async () => {
    setIsSolving(true);
    setErrorDetails(null);

    const payload = {
      shifts: {
        sixHour: {
          enabled: sixHour.enabled,
          maxCount: getAbsoluteCount(sixHour),
        },
        eightHour: {
          enabled: eightHour.enabled,
          maxCount: getAbsoluteCount(eightHour),
        },
        tenHour: {
          enabled: tenHour.enabled,
          maxCount: getAbsoluteCount(tenHour),
        },
        twelveHour: {
          enabled: twelveHour.enabled,
          maxCount: getAbsoluteCount(twelveHour),
        },
      },
    };

    try {
      const response = await fetch("/api/optimize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.details || "Optimization solver failed.");
      }

      // Success: instantly trigger page state refresh
      onUpdateSnapshot(result.snapshot);
    } catch (err: any) {
      console.error(err);
      setErrorDetails(err?.message || "An unexpected error occurred during optimization.");
    } finally {
      setIsSolving(false);
    }
  };

  const renderShiftCard = (
    title: string,
    description: string,
    state: ShiftConstraint,
    setState: React.Dispatch<React.SetStateAction<ShiftConstraint>>,
    colorClass: string,
  ) => {
    const calculatedCount = getAbsoluteCount(state);

    return (
      <div className={`p-5 rounded-lg border bg-card transition-all ${!state.enabled ? "opacity-60" : ""}`}>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h4 className="font-semibold text-sm flex items-center gap-2 text-foreground">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${colorClass}`} />
              {title}
            </h4>
            <p className="text-xs text-muted-foreground leading-snug">{description}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <label htmlFor={`${title}-toggle`} className="text-xs text-muted-foreground cursor-pointer select-none">
              {state.enabled ? "Enabled" : "Disabled"}
            </label>
            <input
              id={`${title}-toggle`}
              type="checkbox"
              checked={state.enabled}
              onChange={(e) => setState((prev) => ({ ...prev, enabled: e.target.checked }))}
              disabled={isSolving}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
            />
          </div>
        </div>

        {state.enabled && (
          <div className="mt-5 space-y-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setState((prev) => ({ ...prev, mode: "count" }))}
                disabled={isSolving}
                className={`px-2.5 py-1 text-[10px] uppercase font-bold rounded border ${
                  state.mode === "count"
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-background border-input text-muted-foreground hover:bg-muted"
                }`}
              >
                Hard Count
              </button>
              <button
                type="button"
                onClick={() => setState((prev) => ({ ...prev, mode: "percentage" }))}
                disabled={isSolving}
                className={`px-2.5 py-1 text-[10px] uppercase font-bold rounded border ${
                  state.mode === "percentage"
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-background border-input text-muted-foreground hover:bg-muted"
                }`}
              >
                Percentage
              </button>
              <div className="grow" />
              <Badge variant="outline" className="font-mono text-xs">
                Max Limit: {calculatedCount} / {TOTAL_HEADCOUNT}
              </Badge>
            </div>

            <div className="space-y-2">
              {state.mode === "count" ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono text-muted-foreground">
                    <span>0</span>
                    <span className="font-bold text-foreground">{state.maxCount} agents</span>
                    <span>{TOTAL_HEADCOUNT}</span>
                  </div>
                  <Slider
                    value={[state.maxCount]}
                    onValueChange={([val]) => setState((prev) => ({ ...prev, maxCount: val }))}
                    min={0}
                    max={TOTAL_HEADCOUNT}
                    step={1}
                    disabled={isSolving}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono text-muted-foreground">
                    <span>0%</span>
                    <span className="font-bold text-foreground">{state.percentage}% of roster</span>
                    <span>100%</span>
                  </div>
                  <Slider
                    value={[state.percentage]}
                    onValueChange={([val]) => setState((prev) => ({ ...prev, percentage: val }))}
                    min={0}
                    max={100}
                    step={5}
                    disabled={isSolving}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Simple Optimizer Configurator"
        description="Toggle available shift lengths and specify headcount capacities. Run Google's CP-SAT engine dynamically to instantly re-solve and align weekly roster schedules."
        bgImage="/28.jpg"
        bgImageOpacity={0.03}
        toolbar={
          <Badge variant="secondary" className="font-mono text-xs">
            Headcount Constraint: {TOTAL_HEADCOUNT} Cubicles
          </Badge>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile label="Total FTE Base" value="36 CSAs" hint="CSA Line & CSA Leads" />
          <StatTile label="SDS Schedulers" value="8 SDS" hint="Same-Day Dispatchers" />
          <StatTile label="NDS Schedulers" value="3 NDS" hint="Next-Day Allocations" />
          <StatTile label="Max Workspace Cap" value="34 Seats" hint="Physical concurrent cubicle limit" />
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <h2 className="flex items-center gap-2 text-foreground font-semibold text-lg">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            Allowed Shift Configurations
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderShiftCard(
              "6-Hour Shifts",
              "Twilight and short mid-day shifts (gross 6h). Concentrates coverage during evening call tails.",
              sixHour,
              setSixHour,
              "bg-indigo-500",
            )}

            {renderShiftCard(
              "8-Hour Shifts",
              "Standard full-time shifts (gross 8h-8.5h). EARLY, AM_CORE, LATE, and OVERNIGHT blocks.",
              eightHour,
              setEightHour,
              "bg-emerald-500",
            )}

            {renderShiftCard(
              "10-Hour Shifts",
              "Compressed workweeks and weekend shifts (gross 10.5h). Covers larger service spans.",
              tenHour,
              setTenHour,
              "bg-amber-500",
            )}

            {renderShiftCard(
              "12-Hour Shifts",
              "Toll-free emergency or super-span schedules. (Not present in default catalog, capped at 0).",
              twelveHour,
              setTwelveHour,
              "bg-rose-500",
            )}
          </div>
        </div>

        <aside className="space-y-5">
          <SectionCard title="Optimization Sandbox" bgImage="/28.jpg" bgImageOpacity={0.06}>
            <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
              <p>
                Adjust the limits and toggle switches to configure biddable shift options. Clicking the optimizer
                will safely re-solve the CP-SAT model.
              </p>
              <div className="bg-amber-100/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-md p-3 text-xs text-amber-950 dark:text-amber-200 font-medium">
                <span className="font-semibold text-amber-950 dark:text-amber-100">Solver Timeout:</span> Strict 30s Safety Limit enforced.
              </div>

              <div className="border-t border-border my-4" />

              {errorDetails && (
                <div className="border border-destructive/40 bg-destructive/5 rounded-md p-3 text-xs text-destructive flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-bold">Optimization Failed</span>
                    <p className="font-mono text-[10px] break-all max-h-24 overflow-y-auto">
                      {errorDetails}
                    </p>
                  </div>
                </div>
              )}

              <Button
                variant="default"
                onClick={handleRunOptimization}
                disabled={isSolving}
                className="w-full flex items-center justify-center gap-2 h-10 font-semibold"
              >
                {isSolving ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Solving CP-SAT Model...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current" />
                    Run Simple Optimizer
                  </>
                )}
              </Button>
            </div>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}
