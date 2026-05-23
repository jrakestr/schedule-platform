"use client";

import { useState, useMemo, useCallback, memo, useEffect, useRef } from "react";
import {
  Settings2,
  Play,
  RefreshCw,
  AlertTriangle,
  History,
  Trash2,
  ShieldAlert,
  Check,
  DollarSign,
  Users2,
  Home,
  MessageSquare,
  Columns,
  X,
} from "lucide-react";
import { SectionCard } from "@/components/shared/section-card";
import { StatTile } from "@/components/charts/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Snapshot, Agent, DOW } from "@/lib/data/types";
import type { OptimizationMeta } from "@/lib/data/snapshot";
import { useQueryState } from "nuqs";
import { useRouter } from "next/navigation";
import { launchOptimization, OptimizerLaunchError } from "@/lib/api/optimizer";

type RunState = "idle" | "launching" | "polling" | "succeeded" | "failed";

interface StatusBannerProps {
  state: RunState;
  errorCode?: string;
  errorMessage?: string;
  onRetry: () => void;
}

export function OptimizerStatusBanner({ state, errorCode, errorMessage, onRetry }: StatusBannerProps) {
  if (state === "idle" || state === "succeeded") return null;

  const themes = {
    launching: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/20 dark:border-blue-900/40 dark:text-blue-200",
    polling: "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950/20 dark:border-yellow-900/40 dark:text-yellow-200",
    failed: "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-200",
  };

  return (
    <div className={`p-4 border rounded-md my-4 ${themes[state]}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2.5">
          {state === "failed" ? (
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          ) : (
            <RefreshCw className="h-5 w-5 text-primary shrink-0 animate-spin mt-0.5" />
          )}
          <div>
            <h4 className="font-semibold capitalize text-sm">Solver Status: {state}</h4>
            {errorMessage && (
              <p className="text-xs mt-1 leading-relaxed opacity-90">
                <strong>Details:</strong> {errorMessage} {errorCode && `(${errorCode})`}
              </p>
            )}
          </div>
        </div>
        {state === "failed" && (
          <Button
            onClick={onRetry}
            size="sm"
            className="shrink-0 h-8 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white"
          >
            Modify & Retry
          </Button>
        )}
      </div>
    </div>
  );
}

interface OptimizerTabProps {
  snapshot: Snapshot;
  onUpdateSnapshot: (newSnapshot: Snapshot) => void;
  optimizations: OptimizationMeta[];
}

interface ShiftConstraint {
  enabled: boolean;
  mode: "count" | "percentage";
  maxCount: number;
  percentage: number;
}

type ShiftKey = "sixHour" | "eightHour" | "tenHour" | "twelveHour";

interface ShiftCardProps {
  title: string;
  description: string;
  state: ShiftConstraint;
  onChange: (updated: ShiftConstraint) => void;
  colorClass: string;
  totalHeadcount: number;
  disabled?: boolean;
}

function getAbsoluteCount(sc: ShiftConstraint, totalHeadcount: number): number {
  if (!sc.enabled) return 0;
  if (sc.mode === "percentage") {
    return Math.round((sc.percentage / 100) * totalHeadcount);
  }
  return sc.maxCount;
}

const ShiftCard = memo(function ShiftCard({
  title,
  description,
  state,
  onChange,
  colorClass,
  totalHeadcount,
  disabled,
}: ShiftCardProps) {
  const calculatedCount = getAbsoluteCount(state, totalHeadcount);

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
            onChange={(e) => onChange({ ...state, enabled: e.target.checked })}
            disabled={disabled}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
          />
        </div>
      </div>

      {state.enabled && (
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...state, mode: "count" })}
              disabled={disabled}
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
              onClick={() => onChange({ ...state, mode: "percentage" })}
              disabled={disabled}
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
              Max Limit: {calculatedCount} / {totalHeadcount}
            </Badge>
          </div>

          <div className="space-y-2">
            {state.mode === "count" ? (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono text-muted-foreground">
                  <span>0</span>
                  <span className="font-bold text-foreground">{state.maxCount} agents</span>
                  <span>{totalHeadcount}</span>
                </div>
                <Slider
                  value={[state.maxCount]}
                  onValueChange={([val]) => onChange({ ...state, maxCount: val })}
                  min={0}
                  max={totalHeadcount}
                  step={1}
                  disabled={disabled}
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
                  onValueChange={([val]) => onChange({ ...state, percentage: val })}
                  min={0}
                  max={100}
                  step={5}
                  disabled={disabled}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export function OptimizerTab({ snapshot, onUpdateSnapshot, optimizations }: OptimizerTabProps) {
  const [isSolving, setIsSolving] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [runName, setRunName] = useState("");
  const [notes, setNotes] = useState("");
  const [solvingStatus, setSolvingStatus] = useState<string>("");

  const [optId, setOptId] = useQueryState("opt_id", {
    defaultValue: "",
    clearOnDefault: true,
  });
  const [mode] = useQueryState("mode", {
    defaultValue: "",
  });
  const isViewer = mode === "viewer";

  const router = useRouter();

  const [shifts, setShifts] = useState<Record<ShiftKey, ShiftConstraint>>({
    sixHour: {
      enabled: true,
      mode: "count",
      maxCount: 6,
      percentage: 15,
    },
    eightHour: {
      enabled: true,
      mode: "count",
      maxCount: 36,
      percentage: 80,
    },
    tenHour: {
      enabled: true,
      mode: "count",
      maxCount: 8,
      percentage: 20,
    },
    twelveHour: {
      enabled: false,
      mode: "count",
      maxCount: 0,
      percentage: 0,
    },
  });

  const csaCount = snapshot?.meta?.role_counts?.CSA ?? 36;
  const sdsCount = snapshot?.meta?.role_counts?.SDS ?? 8;
  const ndsCount = snapshot?.meta?.role_counts?.NDS ?? 3;
  const cubicleCap = snapshot?.meta?.cubicle_cap ?? snapshot?.cubicles?.cap ?? 34;

  const [customCubicleCap, setCustomCubicleCap] = useState(cubicleCap);

  useEffect(() => {
    setCustomCubicleCap(cubicleCap);
  }, [cubicleCap]);

  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);
  const [scenarioPayloads, setScenarioPayloads] = useState<Record<string, Snapshot>>({});
  const [loadingPayloads, setLoadingPayloads] = useState<Record<string, boolean>>({});

  const [commentName, setCommentName] = useState("");
  const [commentText, setCommentComment] = useState("");
  const [comments, setComments] = useState<{ name: string; text: string; date: string }[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`schedule-platform.feedback-${optId || "default"}`);
      if (raw) {
        setComments(JSON.parse(raw));
      } else {
        setComments([]);
      }
    } catch {
      setComments([]);
    }
  }, [optId]);

  const handleSelectScenario = async (id: string, checked: boolean) => {
    if (checked) {
      if (selectedScenarios.length >= 3) {
        alert("You can select up to 3 scenarios for comparison.");
        return;
      }
      setSelectedScenarios((prev) => [...prev, id]);

      if (!scenarioPayloads[id]) {
        setLoadingPayloads((prev) => ({ ...prev, [id]: true }));
        try {
          const res = await fetch(`/api/optimize/status?id=${id}&include_payload=true`);
          const data = await res.json();
          if (res.ok && data.ok && data.run?.payload) {
            setScenarioPayloads((prev) => ({ ...prev, [id]: data.run.payload }));
          }
        } catch (err) {
          console.error("Failed to load scenario payload:", err);
        } finally {
          setLoadingPayloads((prev) => ({ ...prev, [id]: false }));
        }
      }
    } else {
      setSelectedScenarios((prev) => prev.filter((x) => x !== id));
    }
  };

  const infeasibilityDetails = useMemo(() => {
    const satReq = snapshot?.volume?.required_on_phones?.Combined?.Sat || [];
    const sunReq = snapshot?.volume?.required_on_phones?.Combined?.Sun || [];

    const blockedIntervals: { day: string; time: string; required: number; cap: number }[] = [];

    satReq.forEach((req, idx) => {
      const weekendFloor = Math.max(1, Math.round(req * 0.5));
      if (weekendFloor > customCubicleCap) {
        const hour = Math.floor(idx / 2);
        const mins = idx % 2 === 0 ? "00" : "30";
        const endHour = idx % 2 === 0 ? hour : hour + 1;
        const endMins = idx % 2 === 0 ? "30" : "00";
        blockedIntervals.push({
          day: "Saturday",
          time: `${hour.toString().padStart(2, "0")}:${mins}–${endHour.toString().padStart(2, "0")}:${endMins}`,
          required: weekendFloor,
          cap: customCubicleCap,
        });
      }
    });

    sunReq.forEach((req, idx) => {
      const weekendFloor = Math.max(1, Math.round(req * 0.5));
      if (weekendFloor > customCubicleCap) {
        const hour = Math.floor(idx / 2);
        const mins = idx % 2 === 0 ? "00" : "30";
        const endHour = idx % 2 === 0 ? hour : hour + 1;
        const endMins = idx % 2 === 0 ? "30" : "00";
        blockedIntervals.push({
          day: "Sunday",
          time: `${hour.toString().padStart(2, "0")}:${mins}–${endHour.toString().padStart(2, "0")}:${endMins}`,
          required: weekendFloor,
          cap: customCubicleCap,
        });
      }
    });

    const maxEnabledCount = Object.keys(shifts).reduce((sum, key) => {
      const sc = shifts[key as ShiftKey];
      return sum + (sc.enabled ? getAbsoluteCount(sc, csaCount + sdsCount + ndsCount) : 0);
    }, 0);

    const isHeadcountInfeasible = maxEnabledCount < (csaCount + sdsCount + ndsCount);

    return {
      isBlocked: blockedIntervals.length > 0 || isHeadcountInfeasible,
      blockedIntervals,
      isHeadcountInfeasible,
      maxEnabledCount,
      totalRequired: csaCount + sdsCount + ndsCount,
    };
  }, [snapshot, customCubicleCap, shifts, csaCount, sdsCount, ndsCount]);

  const TOTAL_HEADCOUNT = useMemo(() => {
    return csaCount + sdsCount + ndsCount;
  }, [csaCount, sdsCount, ndsCount]);

  const handleShiftChange = useCallback((key: ShiftKey, updated: ShiftConstraint) => {
    setShifts((prev) => ({
      ...prev,
      [key]: updated,
    }));
  }, []);

  const handleSixHourChange = useCallback((updated: ShiftConstraint) => {
    handleShiftChange("sixHour", updated);
  }, [handleShiftChange]);

  const handleEightHourChange = useCallback((updated: ShiftConstraint) => {
    handleShiftChange("eightHour", updated);
  }, [handleShiftChange]);

  const handleTenHourChange = useCallback((updated: ShiftConstraint) => {
    handleShiftChange("tenHour", updated);
  }, [handleShiftChange]);

  const handleTwelveHourChange = useCallback((updated: ShiftConstraint) => {
    handleShiftChange("twelveHour", updated);
  }, [handleShiftChange]);

  const [runState, setRunState] = useState<RunState>("idle");
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const isPollingRef = useRef(false);

  useEffect(() => {
    isPollingRef.current = true;
    return () => {
      isPollingRef.current = false;
    };
  }, []);

  const handleRunOptimization = async () => {
    if (!runName.trim()) {
      setErrorDetails("Optimization Run Name is required.");
      return;
    }

    setRunState("launching");
    setIsSolving(true);
    setErrorDetails(null);
    setErrorCode(undefined);
    setSolvingStatus("Initiating optimization solver run...");

    const payload = {
      name: runName.trim(),
      notes: notes.trim() || null,
      cubicleCap: customCubicleCap,
      shifts: {
        sixHour: {
          enabled: shifts.sixHour.enabled,
          maxCount: getAbsoluteCount(shifts.sixHour, TOTAL_HEADCOUNT),
        },
        eightHour: {
          enabled: shifts.eightHour.enabled,
          maxCount: getAbsoluteCount(shifts.eightHour, TOTAL_HEADCOUNT),
        },
        tenHour: {
          enabled: shifts.tenHour.enabled,
          maxCount: getAbsoluteCount(shifts.tenHour, TOTAL_HEADCOUNT),
        },
        twelveHour: {
          enabled: shifts.twelveHour.enabled,
          maxCount: getAbsoluteCount(shifts.twelveHour, TOTAL_HEADCOUNT),
        },
      },
    };

    try {
      const result = await launchOptimization(payload);
      const runId = result.id;
      setRunState("polling");
      setSolvingStatus("Solver launched in background. Polling for results...");

      // Start exponential backoff status polling
      let pollAttempts = 0;
      const maxPollAttempts = 40;

      const executePoll = async () => {
        if (!isPollingRef.current) return;

        try {
          const statusResponse = await fetch(`/api/optimize/status?id=${runId}`);
          if (!statusResponse.ok) {
            throw new Error(`Status check returned code: ${statusResponse.status}`);
          }

          const statusResult = await statusResponse.json();
          if (!statusResult.ok) {
            throw new Error(statusResult.error || "Failed to poll status.");
          }

          const run = statusResult.run;
          if (run.status === "succeeded") {
            setRunState("succeeded");
            setSolvingStatus("Success! Redirecting to overlay roster...");
            setRunName("");
            setNotes("");
            // Set opt_id in URL to switch roster view
            await setOptId(runId);
            // Refresh the page data so the optimizations list updates
            router.refresh();
            setIsSolving(false);
          } else if (run.status === "failed") {
            setRunState("failed");
            setErrorCode("SOLVER_FAIL");
            setErrorDetails(run.error_details || "Optimization CP-SAT solver failed.");
            setIsSolving(false);
          } else {
            // Keep polling with exponential backoff delay (3s -> 10s cap)
            pollAttempts++;
            if (pollAttempts >= maxPollAttempts) {
              setRunState("failed");
              setErrorCode("TIMEOUT_EXCEEDED");
              setErrorDetails("Optimization process timed out on the client side.");
              setIsSolving(false);
              return;
            }

            const backoffMs = Math.min(3000 + pollAttempts * 1000, 10000);
            setSolvingStatus(run.status === "running"
              ? `Roster layout solver is running (attempt ${pollAttempts}/${maxPollAttempts})...`
              : `Waiting in solver queue (attempt ${pollAttempts}/${maxPollAttempts})...`
            );
            setTimeout(executePoll, backoffMs);
          }
        } catch (err: any) {
          setRunState("failed");
          setErrorCode("POLL_FAIL");
          setErrorDetails(err.message || "Failed to parse solver response.");
          setIsSolving(false);
        }
      };

      setTimeout(executePoll, 3000);

    } catch (err: any) {
      setRunState("failed");
      setIsSolving(false);
      if (err instanceof OptimizerLaunchError) {
        setErrorCode(err.code);
        setErrorDetails(err.message);
      } else {
        setErrorCode("UNKNOWN_LAUNCH_ERROR");
        setErrorDetails(err?.message || "An unexpected error occurred during optimization.");
      }
    }
  };

  const handleDeleteRun = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this optimization run?")) return;
    try {
      const response = await fetch(`/api/optimize/delete?id=${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete optimization run.");
      }
      if (optId === id) {
        setOptId("");
      }
      router.refresh();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Deletion failed.");
    }
  };

  return (
    <div className="space-y-6">
      <OptimizerStatusBanner
        state={runState}
        errorCode={errorCode}
        errorMessage={errorDetails || undefined}
        onRetry={() => {
          setRunState("idle");
          setErrorDetails(null);
          setErrorCode(undefined);
        }}
      />

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
          <StatTile label="Total FTE Base" value={`${csaCount} CSAs`} hint="CSA Line & CSA Leads" />
          <StatTile label="SDS Schedulers" value={`${sdsCount} SDS`} hint="Same-Day Dispatchers" />
          <StatTile label="NDS Schedulers" value={`${ndsCount} NDS`} hint="Next-Day Allocations" />
          <StatTile label="Max Workspace Cap" value={`${cubicleCap} Seats`} hint="Physical concurrent cubicle limit" />
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <h2 className="flex items-center gap-2 text-foreground font-semibold text-lg">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            Allowed Shift Configurations
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ShiftCard
              title="6-Hour Shifts"
              description="Twilight and short mid-day shifts (gross 6h). Concentrates coverage during evening call tails."
              state={shifts.sixHour}
              onChange={handleSixHourChange}
              colorClass="bg-indigo-500"
              totalHeadcount={TOTAL_HEADCOUNT}
              disabled={isSolving || isViewer}
            />

            <ShiftCard
              title="8-Hour Shifts"
              description="Standard full-time shifts (gross 8h-8.5h). EARLY, AM_CORE, LATE, and OVERNIGHT blocks."
              state={shifts.eightHour}
              onChange={handleEightHourChange}
              colorClass="bg-emerald-500"
              totalHeadcount={TOTAL_HEADCOUNT}
              disabled={isSolving || isViewer}
            />

            <ShiftCard
              title="10-Hour Shifts"
              description="Compressed workweeks and weekend shifts (gross 10.5h). Covers larger service spans."
              state={shifts.tenHour}
              onChange={handleTenHourChange}
              colorClass="bg-amber-500"
              totalHeadcount={TOTAL_HEADCOUNT}
              disabled={isSolving || isViewer}
            />

            <ShiftCard
              title="12-Hour Shifts"
              description="Toll-free emergency or super-span schedules."
              state={shifts.twelveHour}
              onChange={handleTwelveHourChange}
              colorClass="bg-rose-500"
              totalHeadcount={TOTAL_HEADCOUNT}
              disabled={isSolving || isViewer}
            />
          </div>
        </div>

        <aside className="space-y-5">
          <SectionCard title="Optimization Sandbox" bgImage="/28.jpg" bgImageOpacity={0.06}>
            <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
              <p>
                Adjust the limits and toggle switches to configure biddable shift options. Define a name, run notes, and click Run below to solve the CP-SAT model.
              </p>

              <div className="space-y-3">
                <div className="space-y-1.5 pb-2">
                  <div className="flex justify-between items-center text-xs font-semibold text-foreground">
                    <label htmlFor="cubicle-cap-slider">Workspace Cubicle Cap</label>
                    <span className="num font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{customCubicleCap} seats</span>
                  </div>
                  <Slider
                    id="cubicle-cap-slider"
                    min={10}
                    max={40}
                    step={1}
                    value={[customCubicleCap]}
                    onValueChange={(v) => setCustomCubicleCap(v[0])}
                    disabled={isSolving || isViewer}
                  />
                  <p className="text-[10px] text-muted-foreground">Caps concurrent workstations in use.</p>
                </div>

                <div className="space-y-1">
                  <label htmlFor="run-name" className="text-xs font-semibold text-foreground">
                    Optimization Run Name *
                  </label>
                  <input
                    id="run-name"
                    type="text"
                    placeholder="e.g. Six-Hour Evening Hybrid"
                    value={runName}
                    onChange={(e) => setRunName(e.target.value)}
                    disabled={isSolving || isViewer}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="run-notes" className="text-xs font-semibold text-foreground">
                    Notes / Hypothesis
                  </label>
                  <textarea
                    id="run-notes"
                    rows={2}
                    placeholder="Explain the intent of this run..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={isSolving || isViewer}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 resize-none"
                  />
                </div>
              </div>

              {solvingStatus && (
                <div className="bg-primary/5 border border-primary/20 rounded-md p-3 text-xs text-primary font-medium flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>{solvingStatus}</span>
                </div>
              )}

              <div className="bg-amber-100/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-md p-3 text-xs text-amber-950 dark:text-amber-200 font-medium">
                <span className="font-semibold text-amber-950 dark:text-amber-100">Stateless Solving:</span> Operates entirely in safe isolated memory.
              </div>

              <div className="border-t border-border my-4" />

              {/* Infeasibility alert */}
              {infeasibilityDetails.isBlocked && (
                <div className="border-2 border-red-500/80 bg-red-500/10 text-red-950 dark:text-red-200 p-4 rounded-md space-y-3">
                  <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-bold text-xs">
                    <ShieldAlert className="h-5 w-5 shrink-0" />
                    <span>No Feasible Schedule Found</span>
                  </div>
                  <p className="text-[11px] text-red-800 dark:text-red-300 leading-relaxed">
                    The solver cannot satisfy constraints due to a physical contradiction:
                  </p>
                  
                  {infeasibilityDetails.blockedIntervals.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-red-900 dark:text-red-200 block">Workspace Cap Overrun:</span>
                      <p className="text-[10px] text-muted-foreground">
                        Required weekend phone staffing exceeds your Workspace Cap of {customCubicleCap} seats in the following intervals:
                      </p>
                      <div className="max-h-24 overflow-y-auto rounded border border-red-200/30 bg-black/5 dark:bg-black/20 text-[10px] font-mono p-1">
                        {infeasibilityDetails.blockedIntervals.map((b, idx) => (
                          <div key={idx} className="flex justify-between py-0.5 px-1 border-b border-red-200/10 last:border-b-0">
                            <span>{b.day} {b.time}</span>
                            <span>Req: {b.required} &gt; Cap: {b.cap}</span>
                          </div>
                        ))}
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setCustomCubicleCap(38)}
                        className="text-[10px] h-7 w-full bg-red-600 hover:bg-red-700 text-white"
                      >
                        Set Cubicle Cap to 38
                      </Button>
                    </div>
                  )}

                  {infeasibilityDetails.isHeadcountInfeasible && (
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-red-900 dark:text-red-200 block">Headcount Shortfall:</span>
                      <p className="text-[10px] text-muted-foreground">
                        The sum of enabled shift maximum caps ({infeasibilityDetails.maxEnabledCount}) is less than the total required headcount of {infeasibilityDetails.totalRequired} agents.
                      </p>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setShifts(prev => ({
                            ...prev,
                            eightHour: {
                              ...prev.eightHour,
                              enabled: true,
                              maxCount: 36,
                            }
                          }));
                        }}
                        className="text-[10px] h-7 w-full bg-red-600 hover:bg-red-700 text-white"
                      >
                        Enable 8-Hour shifts with full capacity (Relax by 10%)
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* We no longer render simple unformatted errorDetails below, because they are elegantly surfaced in our status banner above */}

              <Button
                variant="default"
                onClick={handleRunOptimization}
                disabled={isSolving || isViewer}
                className="w-full flex items-center justify-center gap-2 h-10 font-semibold"
              >
                {isSolving ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Solving CP-SAT Model...
                  </>
                ) : isViewer ? (
                  <>
                    <Play className="h-4 w-4 fill-current opacity-50" />
                    Viewer Mode (Read-Only)
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current" />
                    Run Simple Optimizer
                  </>
                )}
              </Button>

              {/* Collaborative commentary comment box */}
              {isViewer && (
                <div className="border border-border bg-card rounded-md p-4 space-y-3 mt-4">
                  <div className="flex items-center gap-1.5 text-foreground font-semibold text-xs">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <span>Stakeholder Feedback</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Collaborative Mode is active. Share your thoughts or suggestions below.
                  </p>
                  <div className="space-y-2 text-xs">
                    <div className="space-y-1">
                      <label htmlFor="feedback-name" className="text-muted-foreground font-medium text-[10px]">Your Name</label>
                      <input
                        id="feedback-name"
                        type="text"
                        placeholder="e.g. Supervisor Jones"
                        value={commentName}
                        onChange={(e) => setCommentName(e.target.value)}
                        className="w-full h-8 rounded border border-input bg-background px-2.5 py-1 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="feedback-text" className="text-muted-foreground font-medium text-[10px]">Comments</label>
                      <textarea
                        id="feedback-text"
                        rows={2}
                        placeholder="e.g. Overnight shift has too much overlap..."
                        value={commentText}
                        onChange={(e) => setCommentComment(e.target.value)}
                        className="w-full rounded border border-input bg-background px-2.5 py-1.5 text-xs resize-none"
                      />
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        if (!commentName.trim() || !commentText.trim()) return;
                        const newComment = {
                          name: commentName.trim(),
                          text: commentText.trim(),
                          date: new Date().toLocaleString("en-US", { timeZone: "America/Phoenix" }),
                        };
                        const updated = [newComment, ...comments];
                        setComments(updated);
                        localStorage.setItem(`schedule-platform.feedback-${optId || "default"}`, JSON.stringify(updated));
                        setCommentName("");
                        setCommentComment("");
                      }}
                      disabled={!commentName.trim() || !commentText.trim()}
                      className="w-full h-8 text-xs font-semibold text-foreground"
                    >
                      Submit Feedback
                    </Button>
                  </div>

                  {comments.length > 0 && (
                    <div className="pt-3 border-t border-border space-y-2.5 max-h-36 overflow-y-auto">
                      {comments.map((c, i) => (
                        <div key={i} className="text-xs space-y-0.5 bg-muted/40 p-2 rounded">
                          <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                            <span className="font-bold text-foreground">{c.name}</span>
                            <span>{c.date}</span>
                          </div>
                          <p className="text-[11px] text-foreground/80 leading-relaxed font-sans">{c.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </SectionCard>
        </aside>
      </div>

      <div className="mt-8 border-t pt-8 space-y-4">
        <h2 className="flex items-center gap-2 text-foreground font-semibold text-lg">
          <History className="h-5 w-5 text-muted-foreground" />
          Optimization History
        </h2>
        <div className="rounded-md border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground font-medium border-b text-xs text-left">
              <tr>
                <th className="p-3 pl-4 w-10 text-center">Compare</th>
                <th className="p-3">Run Name</th>
                <th className="p-3">Created At</th>
                <th className="p-3">Notes</th>
                <th className="p-3">Status</th>
                <th className="p-3">Result KPIs</th>
                <th className="p-3 text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {optimizations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground text-xs">
                    No custom optimization runs saved yet. Configure constraints and click Run above to generate one.
                  </td>
                </tr>
              ) : (
                optimizations.map((opt) => {
                  const isActive = optId === opt.id;
                  const isSelected = selectedScenarios.includes(opt.id);
                  const dateStr = new Date(opt.created_at).toLocaleString();
                  return (
                    <tr key={opt.id} className={isActive ? "bg-primary/5 font-medium" : ""}>
                      <td className="p-3 pl-4 text-center">
                        {opt.status === "succeeded" ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleSelectScenario(opt.id, e.target.checked)}
                            className="rounded border-input text-primary focus:ring-ring cursor-pointer"
                          />
                        ) : (
                          <span className="text-muted-foreground text-[10px]">—</span>
                        )}
                      </td>
                      <td className="p-3 max-w-[200px] truncate">
                        <div className="flex items-center gap-2">
                          {isActive && <Badge variant="default" className="text-[10px] h-4 px-1.5 font-sans">Active</Badge>}
                          <span>{opt.run_name}</span>
                        </div>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground num">{dateStr}</td>
                      <td className="p-3 max-w-[220px] truncate text-xs text-muted-foreground">{opt.notes || "—"}</td>
                      <td className="p-3">
                        <Badge variant={opt.status === "succeeded" ? "secondary" : "outline"} className="capitalize text-[10px] h-4">
                          {opt.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground num">
                        {opt.kpis?.total_bodies ? `${opt.kpis.total_bodies} bodies` : "—"}
                      </td>
                      <td className="p-3 text-right pr-4 space-x-2">
                        {opt.status === "succeeded" && (
                          <Button
                            variant={isActive ? "outline" : "default"}
                            size="sm"
                            className="text-xs px-2.5 h-7"
                            onClick={() => setOptId(isActive ? "" : opt.id)}
                          >
                            {isActive ? "Deselect" : "Overlay"}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs px-2.5 h-7 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                          onClick={() => handleDeleteRun(opt.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scenario Comparison Workspace */}
      {selectedScenarios.length > 0 && (
        <div className="mt-8 border-t pt-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-foreground font-semibold text-lg">
              <Columns className="h-5 w-5 text-muted-foreground" />
              Scenario Comparison Workspace
            </h2>
            <Badge variant="secondary" className="text-xs font-mono">
              {selectedScenarios.length} of 3 selected
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {selectedScenarios.map((id) => {
              const opt = optimizations.find((o) => o.id === id);
              if (!opt) return null;
              
              const payload = scenarioPayloads[id];
              const isLoading = loadingPayloads[id];
              
              const metrics = calculateScenarioMetrics(payload);

              return (
                <Card key={id} className="relative overflow-hidden border border-border shadow-sm">
                  {isLoading ? (
                    <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] flex items-center justify-center z-10">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : null}
                  <CardHeader className="bg-muted/30 pb-3">
                    <div className="flex justify-between items-start gap-2">
                      <CardTitle className="text-sm font-semibold truncate max-w-[200px]" title={opt.run_name}>
                        {opt.run_name}
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => setSelectedScenarios(prev => prev.filter(x => x !== id))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      Created: {new Date(opt.created_at).toLocaleDateString("en-US", { timeZone: "America/Phoenix" })}
                    </p>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4 text-xs font-sans">
                    {metrics ? (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center border-b pb-1.5 border-border">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <DollarSign className="h-3.5 w-3.5" />
                            Total Cost
                          </span>
                          <span className="num font-bold text-foreground">
                            {metrics.totalCost.toLocaleString("en-US", { style: "currency", currency: "USD" })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center border-b pb-1.5 border-border">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                            Coverage Accuracy
                          </span>
                          <span className="num font-bold text-foreground">
                            {(metrics.volumeMatchedShare * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center border-b pb-1.5 border-border">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Users2 className="h-3.5 w-3.5 text-violet-500" />
                            Split-Shift Count
                          </span>
                          <span className="num font-bold text-foreground">
                            {metrics.splitShiftCount} agents
                          </span>
                        </div>
                        <div className="flex justify-between items-center border-b pb-1.5 border-border">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Home className="h-3.5 w-3.5 text-blue-500" />
                            Peak Workstation Occupancy
                          </span>
                          <span className="num font-bold text-foreground">
                            {metrics.peakCubicles} / {payload?.meta?.cubicle_cap || 34} seats
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        Failed to compute comparison metrics.
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function calculateScenarioMetrics(snapshotPayload: Snapshot | null | undefined) {
  if (!snapshotPayload) return null;
  
  let totalCost = 0;
  let splitShiftCount = 0;
  let peakCubicles = 0;

  // 1. Calculate Estimated Weekly Cost
  const agents = snapshotPayload.agents || [];
  for (const agent of agents) {
    let rate = 18; // Default CSA Line
    if (agent.role === "Supervisor") rate = 28;
    else if (agent.role === "CSA" && agent.position === "Lead") rate = 22;
    else if (agent.role === "SDS") {
      rate = agent.position === "Lead" ? 24 : 20;
    } else if (agent.role === "NDS") {
      rate = 20;
    }

    const hoursPerWeek = Number(agent.effective_hours_per_week || (agent.gross_hours ? (agent.gross_hours || 8) * 5 : 40));
    let agentWeeklyCost = hoursPerWeek * rate;

    // Check split incentive eligibility
    const v = agent.shift_id || "";
    const isSplit = v.startsWith("WKND_") || v.startsWith("OVERNIGHT_") || v.startsWith("TWILIGHT_") || v.includes("SPLIT");
    if (isSplit) {
      splitShiftCount++;
      agentWeeklyCost += 100; // $20/day * 5 days = $100 weekly bonus
    }

    totalCost += agentWeeklyCost;
  }

  // 2. Volume matched share
  let matchedShare = 0;
  try {
    const DOW_LIST: DOW[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const offered: Record<string, number[]> = {};
    const staffed: Record<string, number[]> = {};
    let totalVol = 0;
    let totalStaff = 0;
    
    for (const d of DOW_LIST) {
      offered[d] = snapshotPayload.volume?.offered_per_interval?.Combined?.[d] || new Array(48).fill(0);
      
      const csaAgents = agents.filter(a => a.role === "CSA");
      const daySupply = new Array(48).fill(0);
      for (const a of csaAgents) {
        const works = a.works_days || [];
        if (!works.includes(d as any)) continue;
        
        const weight = a.position === "Lead" ? 0.6 : 1.0;
        const parsedSegs = a.structure ? a.structure.split("|") : [];
        const perIntervalMinutes = new Array(48).fill(0);
        let prevEnd: number | null = null;
        for (const part of parsedSegs) {
          const s = part.trim();
          if (!s) continue;
          const spaceIdx = s.lastIndexOf(" ");
          if (spaceIdx === -1) continue;
          const range = s.slice(0, spaceIdx).trim();
          const kind = s.slice(spaceIdx + 1).trim();
          const [rangeA, rangeB] = range.split("-");
          if (!rangeA || !rangeB) continue;
          
          const toMin = (t: string): number => {
            const [h, m] = t.split(":").map(Number);
            return h * 60 + m;
          };
          let start = toMin(rangeA);
          let end = toMin(rangeB);
          if (prevEnd !== null) {
            while (start < prevEnd) {
              start += 1440;
              end += 1440;
            }
          }
          if (end <= start) end += 1440;
          prevEnd = end;

          if (kind === "Voice") {
            for (let minute = start; minute < end; minute++) {
              perIntervalMinutes[Math.floor((minute % 1440) / 30)] += 1;
            }
          }
        }
        for (let i = 0; i < 48; i++) {
          if (perIntervalMinutes[i] >= 15) {
            daySupply[i] += weight;
          }
        }
      }
      staffed[d] = daySupply;

      for (let i = 0; i < 48; i++) {
        totalVol += offered[d][i] ?? 0;
        totalStaff += staffed[d][i] ?? 0;
      }
    }

    if (totalVol > 0 && totalStaff > 0) {
      for (const d of DOW_LIST) {
        for (let i = 0; i < 48; i++) {
          matchedShare += Math.min(
            (offered[d][i] ?? 0) / totalVol,
            (staffed[d][i] ?? 0) / totalStaff
          );
        }
      }
    }
  } catch (err) {
    console.error("Failed to calculate matched share in comparison:", err);
  }

  // 3. Peak Cubicles
  try {
    const DOW_SHORT: DOW[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const occ = snapshotPayload.cubicles?.occupancy_by_day_hour || {};
    for (const d of DOW_SHORT) {
      const dayOcc = occ[d] || [];
      for (const hVal of dayOcc) {
        if (hVal > peakCubicles) peakCubicles = hVal;
      }
    }
  } catch {
    // ignore
  }

  return {
    totalCost,
    volumeMatchedShare: matchedShare,
    splitShiftCount,
    peakCubicles,
  };
}
