"use client";

import { useState, useMemo, useCallback, memo, useEffect, useRef, type ReactNode } from "react";
import {
  Settings2,
  Play,
  RefreshCw,
  AlertTriangle,
  Trash2,
  ShieldAlert,
  Check,
  DollarSign,
  Users2,
  Home,
  MessageSquare,
  X,
} from "lucide-react";
import { LabelWithHelp } from "@/components/shared/metric-help";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { WFM_ERLANG_REQUIRED, WFM_OPTIMIZER_OBJECTIVE } from "@/lib/copy/wfm-tooltips";
import type { Snapshot } from "@/lib/data/types";
import type { OptimizationMeta } from "@/lib/data/snapshot";
import { useQueryState } from "nuqs";
import { useRouter } from "next/navigation";
import { launchOptimization, OptimizerLaunchError, deleteOptimizationRun } from "@/lib/api/optimizer";
import { computeScenarioMetrics } from "@/lib/compute/optimization-metrics";
import { OptimizationResults } from "@/components/optimizer/optimization-results";
import {
  WorkLimitationsPanel,
  DEFAULT_WORK_LIMITATIONS,
} from "@/components/optimizer/work-limitations-panel";
import type { FlexShiftAssignment, WorkLimitations } from "@/lib/data/schemas";

const DEFAULT_FLEX_SHIFTS: FlexShiftAssignment = {
  enabled: false,
  flexEarlyMaxCount: 0,
  cleanupLateMaxCount: 0,
};

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
            <h4 className="font-semibold capitalize text-sm">Run status: {state}</h4>
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
  baselineSnapshot: Snapshot;
  onUpdateSnapshot: (newSnapshot: Snapshot) => void;
  optimizations: OptimizationMeta[];
}

interface ShiftConstraint {
  enabled: boolean;
  mode: "count" | "percentage";
  maxCount: number;
  percentage: number;
}

type ShiftKey = "sixHour" | "eightHour" | "tenHour" | "twelveHour" | "splitShift";

interface ShiftCardProps {
  title: string;
  state: ShiftConstraint;
  onChange: (updated: ShiftConstraint) => void;
  colorClass: string;
  totalHeadcount: number;
  disabled?: boolean;
}

function toSafeCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function toSafeCubicleCap(value: number): number {
  if (!Number.isFinite(value)) return 34;
  return Math.max(1, Math.round(value));
}

function getAbsoluteCount(sc: ShiftConstraint, totalHeadcount: number): number {
  return toSafeCount(
    !sc.enabled
      ? 0
      : sc.mode === "percentage"
        ? (sc.percentage / 100) * totalHeadcount
        : sc.maxCount,
  );
}

function formatZodDetails(details: unknown): string | undefined {
  if (!details || typeof details !== "object") return undefined;
  const entries: string[] = [];
  const walk = (node: unknown, path: string[]) => {
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (Array.isArray(record._errors) && record._errors.length > 0) {
      entries.push(`${path.join(".") || "payload"}: ${record._errors.join(", ")}`);
    }
    for (const [key, value] of Object.entries(record)) {
      if (key === "_errors") continue;
      walk(value, [...path, key]);
    }
  };
  walk(details, []);
  return entries.length > 0 ? entries.join("; ") : undefined;
}

const ShiftCard = memo(function ShiftCard({
  title,
  state,
  onChange,
  colorClass,
  totalHeadcount,
  disabled,
}: ShiftCardProps) {
  const calculatedCount = getAbsoluteCount(state, totalHeadcount);
  const toggleId = `${title}-toggle`;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border/60 bg-card shadow-sm",
        "transition-[border-color,box-shadow] duration-150",
        state.enabled
          ? "hover:border-border hover:shadow-md"
          : "opacity-60",
      )}
    >
      {/* Color stripe — full-width identity rail */}
      <div className={cn("h-1 w-full", colorClass, !state.enabled && "opacity-40")} />

      <div className="p-4">
        {/* Title row */}
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>

          {/* Switch-style toggle */}
          <label
            htmlFor={toggleId}
            className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center"
          >
            <input
              id={toggleId}
              type="checkbox"
              checked={state.enabled}
              onChange={(e) => onChange({ ...state, enabled: e.target.checked })}
              disabled={disabled}
              className="peer sr-only"
            />
            <span
              className={cn(
                "absolute inset-0 rounded-full transition-colors duration-150",
                "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-card",
                state.enabled ? "bg-primary" : "bg-muted",
              )}
            />
            <span
              className={cn(
                "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-150",
                state.enabled ? "translate-x-[1.125rem]" : "translate-x-0.5",
              )}
            />
          </label>
        </div>

        {/* Body — only when enabled */}
        {state.enabled && (
          <div className="mt-4 space-y-3">
            {/* Segmented control + result chip */}
            <div className="flex items-center justify-between gap-2">
              <div
                role="tablist"
                aria-label={`${title} mode`}
                className="inline-flex h-7 items-center rounded-md bg-muted p-0.5"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={state.mode === "count"}
                  onClick={() => onChange({ ...state, mode: "count" })}
                  disabled={disabled}
                  className={cn(
                    "h-6 rounded-[5px] px-2.5 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    state.mode === "count"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Count
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={state.mode === "percentage"}
                  onClick={() => onChange({ ...state, mode: "percentage" })}
                  disabled={disabled}
                  className={cn(
                    "h-6 rounded-[5px] px-2.5 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    state.mode === "percentage"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  %
                </button>
              </div>

              <span className="num font-mono text-[11px] tabular-nums text-muted-foreground">
                <span className="font-semibold text-foreground">{calculatedCount}</span>
                {" "}/ {totalHeadcount}
              </span>
            </div>

            {/* Slider + range labels */}
            {state.mode === "count" ? (
              <div className="space-y-1.5">
                <Slider
                  value={[state.maxCount]}
                  onValueChange={([val]) => onChange({ ...state, maxCount: val })}
                  min={0}
                  max={totalHeadcount}
                  step={1}
                  disabled={disabled}
                />
                <div className="flex justify-between font-mono text-[10px] tabular-nums text-muted-foreground">
                  <span>0</span>
                  <span className="font-semibold text-foreground">{state.maxCount} agents</span>
                  <span>{totalHeadcount}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Slider
                  value={[state.percentage]}
                  onValueChange={([val]) => onChange({ ...state, percentage: val })}
                  min={0}
                  max={100}
                  step={5}
                  disabled={disabled}
                />
                <div className="flex justify-between font-mono text-[10px] tabular-nums text-muted-foreground">
                  <span>0%</span>
                  <span className="font-semibold text-foreground">{state.percentage}% of roster</span>
                  <span>100%</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

function SectionHeader({ title, hint }: { title: string; hint?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 border-b border-border/40 pb-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/70">
        {title}
      </h2>
      {hint && (
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {hint}
        </span>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "succeeded"
      ? "bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300"
      : status === "failed"
        ? "bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20 dark:text-rose-300"
        : status === "running" || status === "pending"
          ? "bg-amber-500/10 text-amber-800 ring-1 ring-amber-500/30 dark:text-amber-300"
          : "bg-muted text-muted-foreground ring-1 ring-border";
  return (
    <span className={cn("inline-flex h-4 items-center rounded px-1.5 text-[10px] font-semibold uppercase tracking-wide", tone)}>
      {status === "succeeded" && (
        <span className="mr-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
      )}
      {(status === "running" || status === "pending") && (
        <span className="mr-1 h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
      )}
      {status === "failed" && <span className="mr-1 h-1.5 w-1.5 rounded-full bg-rose-500" />}
      {status}
    </span>
  );
}

function SubsectionLabel({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {icon}
      {children}
    </h3>
  );
}

function FlexShiftsPanel({
  value,
  onChange,
  disabled,
}: {
  value: FlexShiftAssignment;
  onChange: (next: FlexShiftAssignment) => void;
  disabled?: boolean;
}) {
  const setEnabled = (enabled: boolean) =>
    onChange({ ...value, enabled });
  const setCount = (key: "flexEarlyMaxCount" | "cleanupLateMaxCount", n: number) => {
    const safe = Number.isFinite(n) ? Math.max(0, Math.min(50, Math.round(n))) : 0;
    onChange({ ...value, [key]: safe });
  };

  const inputCls =
    "h-7 w-16 rounded-md border border-border/70 bg-background px-2 font-mono text-xs tabular-nums shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <fieldset
      disabled={disabled}
      className="space-y-2 rounded-lg border border-border/70 bg-card px-3 py-2.5 shadow-sm disabled:opacity-60"
    >
      <div className="flex items-center justify-between text-xs">
        <label className="flex cursor-pointer items-center gap-2 text-foreground">
          <input
            type="checkbox"
            checked={value.enabled}
            disabled={disabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-input text-primary focus:ring-primary cursor-pointer"
          />
          Allow flex / cleanup variants
        </label>
        {!value.enabled && (
          <span className="text-[11px] text-muted-foreground">off</span>
        )}
      </div>

      {value.enabled && (
        <>
          <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-xs">
            <div className="space-y-0.5">
              <div className="font-medium text-foreground">Flex-early shifts</div>
              <div className="text-[10px] text-muted-foreground">Start 2h earlier than the base template</div>
            </div>
            <input
              type="number"
              min={0}
              max={50}
              step={1}
              value={value.flexEarlyMaxCount}
              onChange={(e) => setCount("flexEarlyMaxCount", e.target.valueAsNumber)}
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-xs">
            <div className="space-y-0.5">
              <div className="font-medium text-foreground">Cleanup-late shifts</div>
              <div className="text-[10px] text-muted-foreground">Extend 2h past the base template end</div>
            </div>
            <input
              type="number"
              min={0}
              max={50}
              step={1}
              value={value.cleanupLateMaxCount}
              onChange={(e) => setCount("cleanupLateMaxCount", e.target.valueAsNumber)}
              className={inputCls}
            />
          </div>
        </>
      )}
    </fieldset>
  );
}

function FieldGroup({
  label,
  htmlFor,
  required,
  trailing,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-xs font-semibold text-foreground">
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </label>
        {trailing}
      </div>
      {children}
    </div>
  );
}

function CompareRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-1.5">
      <span className="flex items-center gap-1 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="num font-bold text-foreground">{children}</span>
    </div>
  );
}

export function OptimizerTab({ snapshot, baselineSnapshot, onUpdateSnapshot, optimizations }: OptimizerTabProps) {
  const [isSolving, setIsSolving] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [runName, setRunName] = useState("");
  const [notes, setNotes] = useState("");
  const [solvingStatus, setSolvingStatus] = useState<string>("");

  const [optId, setOptId] = useQueryState("opt_id", {
    defaultValue: "",
    clearOnDefault: true,
    shallow: false,
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
      enabled: true,
      mode: "count",
      maxCount: 8,
      percentage: 15,
    },
    splitShift: {
      enabled: true,
      mode: "count",
      maxCount: 8,
      percentage: 20,
    },
  });

  const csaCount = snapshot?.meta?.role_counts?.CSA ?? 36;
  const sdsCount = snapshot?.meta?.role_counts?.SDS ?? 8;
  const ndsCount = snapshot?.meta?.role_counts?.NDS ?? 3;
  const cubicleCap = snapshot?.meta?.cubicle_cap ?? snapshot?.cubicles?.cap ?? 34;

  const [customCubicleCap, setCustomCubicleCap] = useState(cubicleCap);
  const [workLimitations, setWorkLimitations] = useState<WorkLimitations>(
    DEFAULT_WORK_LIMITATIONS,
  );
  const [flexShifts, setFlexShifts] = useState<FlexShiftAssignment>(DEFAULT_FLEX_SHIFTS);

  useEffect(() => {
    setCustomCubicleCap(cubicleCap);
  }, [cubicleCap]);

  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);
  const [scenarioPayloads, setScenarioPayloads] = useState<Record<string, Snapshot>>({});
  const [loadingPayloads, setLoadingPayloads] = useState<Record<string, boolean>>({});

  const [commentName, setCommentName] = useState("");
  const [commentText, setCommentComment] = useState("");
  const [comments, setComments] = useState<{ name: string; text: string; date: string }[]>([]);

  // Safe SSR LocalStorage synchronization
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

  const handleSplitShiftChange = useCallback((updated: ShiftConstraint) => {
    handleShiftChange("splitShift", updated);
  }, [handleShiftChange]);

  const [runState, setRunState] = useState<RunState>("idle");
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [completedRunId, setCompletedRunId] = useState<string | null>(null);
  const isPollingRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isPollingRef.current = true;
    return () => {
      isPollingRef.current = false;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      pollAbortRef.current?.abort();
      pollAbortRef.current = null;
    };
  }, []);

  const handleRunOptimization = async () => {
    const trimmedName = runName.trim();
    if (!trimmedName) {
      setErrorDetails("Optimization Run Name is required.");
      return;
    }
    if (trimmedName.length < 3) {
      setErrorDetails("Optimization Run Name must be at least 3 characters.");
      setErrorCode("PREFLIGHT_VALIDATION_ERROR");
      setRunState("failed");
      return;
    }

    setRunState("launching");
    setIsSolving(true);
    setErrorDetails(null);
    setErrorCode(undefined);
    setSolvingStatus("Starting optimization run...");

    const payload = {
      name: trimmedName,
      notes: notes.trim() || null,
      cubicleCap: toSafeCubicleCap(customCubicleCap),
      workLimitations,
      flexShifts,
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
        splitShift: {
          enabled: shifts.splitShift.enabled,
          maxCount: getAbsoluteCount(shifts.splitShift, TOTAL_HEADCOUNT),
        },
      },
    };

    try {
      const result = await launchOptimization(payload);
      const runId = result.id;
      setRunState("polling");
      setSolvingStatus("Optimization is running. Checking for results...");

      let pollAttempts = 0;
      const maxPollAttempts = 40;

      pollAbortRef.current?.abort();
      pollAbortRef.current = new AbortController();

      const executePoll = async () => {
        if (!isPollingRef.current) return;

        try {
          const statusResponse = await fetch(`/api/optimize/status?id=${runId}`, {
            signal: pollAbortRef.current?.signal,
          });
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
            setSolvingStatus("Complete. Loading roster overlay...");
            setCompletedRunId(runId);
            setRunName("");
            setNotes("");
            await setOptId(runId);
            setIsSolving(false);
          } else if (run.status === "failed") {
            setRunState("failed");
            setErrorCode("SOLVER_FAIL");
            setErrorDetails(run.error_details || "Optimization failed.");
            setIsSolving(false);
          } else {
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
              ? `Building roster (check ${pollAttempts}/${maxPollAttempts})...`
              : `Queued (check ${pollAttempts}/${maxPollAttempts})...`
            );
            pollTimerRef.current = setTimeout(executePoll, backoffMs);
          }
        } catch (err: any) {
          if (err?.name === "AbortError") return;
          setRunState("failed");
          setErrorCode("POLL_FAIL");
          setErrorDetails(err.message || "Failed to read optimization status.");
          setIsSolving(false);
        }
      };

      pollTimerRef.current = setTimeout(executePoll, 3000);

    } catch (err: unknown) {
      setRunState("failed");
      setIsSolving(false);
      if (err instanceof OptimizerLaunchError) {
        setErrorCode(err.code);
        const detailText =
          err.details && typeof err.details === "object"
            ? formatZodDetails(err.details)
            : undefined;
        setErrorDetails(detailText ? `${err.message} (${detailText})` : err.message);
      } else {
        setErrorCode("UNKNOWN_LAUNCH_ERROR");
        setErrorDetails(err instanceof Error ? err.message : "An unexpected error occurred during optimization.");
      }
    }
  };

  const handleDeleteRun = async (id: string, runName?: string) => {
    const label = runName ? `"${runName}"` : "this optimization run";
    if (!confirm(`Permanently delete ${label}? This cannot be undone.`)) return;
    try {
      await deleteOptimizationRun(id);
      if (optId === id) {
        setOptId("");
      }
      setSelectedScenarios((prev) => prev.filter((x) => x !== id));
      setScenarioPayloads((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      router.refresh();
    } catch (err: unknown) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Deletion failed.");
    }
  };

  // Safe memoization: Serialize relevant properties so optimizations array reference doesn't trigger recalc
  const memoizedOptsKey = optimizations.map(o => `${o.id}-${o.status}`).join(",");
  const activeOptimization = useMemo(
    () =>
      optId
        ? optimizations.find((opt) => opt.id === optId && opt.status === "succeeded") ?? null
        : null,
    [optId, memoizedOptsKey],
  );

  const leadPct = snapshot.meta.lead_on_work_default;

  const runSummary = useMemo(() => {
    const activeShifts = Object.values(shifts).filter((s) => s.enabled).length;
    return `${activeShifts} shift type${activeShifts === 1 ? "" : "s"} · ${TOTAL_HEADCOUNT} agents · ${customCubicleCap}-seat cap`;
  }, [shifts, TOTAL_HEADCOUNT, customCubicleCap]);

  const historySummary = useMemo(() => {
    if (optimizations.length === 0) return "no runs yet";
    const succeeded = optimizations.filter((o) => o.status === "succeeded").length;
    const inFlight = optimizations.filter((o) => o.status === "running" || o.status === "pending").length;
    const parts = [`${optimizations.length} run${optimizations.length === 1 ? "" : "s"}`];
    if (succeeded > 0) parts.push(`${succeeded} succeeded`);
    if (inFlight > 0) parts.push(`${inFlight} in-flight`);
    return parts.join(" · ");
  }, [optimizations]);

  return (
    <div className="space-y-10">
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

      {activeOptimization && (
        <OptimizationResults
          runName={activeOptimization.run_name}
          baseline={baselineSnapshot}
          proposed={snapshot}
          leadPct={leadPct}
          showSuccessBanner={completedRunId === activeOptimization.id}
          onDismissSuccess={() => setCompletedRunId(null)}
        />
      )}

      {/* ─── CONFIGURE ─────────────────────────────────────────────── */}
      <section>
        <SectionHeader
          title="Configure optimization run"
          hint={`${TOTAL_HEADCOUNT} agents · ${customCubicleCap}-seat cap`}
        />

        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Constraints (8/12) */}
          <div className="space-y-8 lg:col-span-8">
            <div className="space-y-3">
              <SubsectionLabel icon={<Settings2 className="h-3.5 w-3.5" />}>
                Shift types
              </SubsectionLabel>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <ShiftCard
                  title="6-Hour Shifts"
                  state={shifts.sixHour}
                  onChange={handleSixHourChange}
                  colorClass="bg-indigo-500"
                  totalHeadcount={TOTAL_HEADCOUNT}
                  disabled={isSolving || isViewer}
                />
                <ShiftCard
                  title="8-Hour Shifts"
                  state={shifts.eightHour}
                  onChange={handleEightHourChange}
                  colorClass="bg-emerald-500"
                  totalHeadcount={TOTAL_HEADCOUNT}
                  disabled={isSolving || isViewer}
                />
                <ShiftCard
                  title="10-Hour Shifts"
                  state={shifts.tenHour}
                  onChange={handleTenHourChange}
                  colorClass="bg-amber-500"
                  totalHeadcount={TOTAL_HEADCOUNT}
                  disabled={isSolving || isViewer}
                />
                <ShiftCard
                  title="12-Hour Shifts"
                  state={shifts.twelveHour}
                  onChange={handleTwelveHourChange}
                  colorClass="bg-rose-500"
                  totalHeadcount={TOTAL_HEADCOUNT}
                  disabled={isSolving || isViewer}
                />
                <ShiftCard
                  title="Split Shifts"
                  state={shifts.splitShift}
                  onChange={handleSplitShiftChange}
                  colorClass="bg-sky-500"
                  totalHeadcount={TOTAL_HEADCOUNT}
                  disabled={isSolving || isViewer}
                />
              </div>
            </div>

            <div className="space-y-3">
              <SubsectionLabel>Work limits</SubsectionLabel>
              <WorkLimitationsPanel
                value={workLimitations}
                onChange={setWorkLimitations}
                disabled={isSolving || isViewer}
              />
            </div>

            <div className="space-y-3">
              <SubsectionLabel>Flex shifts</SubsectionLabel>
              <FlexShiftsPanel
                value={flexShifts}
                onChange={setFlexShifts}
                disabled={isSolving || isViewer}
              />
            </div>
          </div>

          {/* Right: Run action (4/12, sticky on lg+) */}
          <aside className="lg:col-span-4">
            <div className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-sm lg:sticky lg:top-6">
              <div className="space-y-1">
                <SubsectionLabel>
                  <LabelWithHelp
                    label="Run"
                    help={
                      <>
                        <p>{WFM_OPTIMIZER_OBJECTIVE}</p>
                        <p className="mt-1.5">{WFM_ERLANG_REQUIRED}</p>
                      </>
                    }
                  />
                </SubsectionLabel>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Each run starts fresh. Saved only on success.
                </p>
              </div>

              <FieldGroup label="Run name" required htmlFor="run-name">
                <input
                  id="run-name"
                  type="text"
                  placeholder="e.g. Six-Hour Evening Hybrid"
                  value={runName}
                  onChange={(e) => setRunName(e.target.value)}
                  disabled={isSolving || isViewer}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                />
              </FieldGroup>

              <FieldGroup label="Notes" htmlFor="run-notes">
                <textarea
                  id="run-notes"
                  rows={2}
                  placeholder="Optional context for this run…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isSolving || isViewer}
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                />
              </FieldGroup>

              <FieldGroup
                label="Cubicle cap"
                htmlFor="cubicle-cap-slider"
                trailing={
                  <span className="num font-mono text-[11px] tabular-nums text-muted-foreground">
                    {customCubicleCap} seats
                  </span>
                }
              >
                <Slider
                  id="cubicle-cap-slider"
                  min={10}
                  max={40}
                  step={1}
                  value={[customCubicleCap]}
                  onValueChange={(v) => setCustomCubicleCap(v[0])}
                  disabled={isSolving || isViewer}
                />
              </FieldGroup>

              {solvingStatus && (
                <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs font-medium text-primary">
                  <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  <span>{solvingStatus}</span>
                </div>
              )}

              {infeasibilityDetails.isBlocked && (
                <div className="space-y-3 rounded-md border-2 border-red-500/80 bg-red-500/10 p-4 text-red-950 dark:text-red-200">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400">
                    <ShieldAlert className="h-5 w-5 shrink-0" />
                    <span>No feasible schedule found</span>
                  </div>

                  {infeasibilityDetails.blockedIntervals.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold text-red-900 dark:text-red-200">Workspace cap overrun</p>
                      <p className="text-[10px] text-muted-foreground">
                        Weekend phone staffing exceeds your cap of {customCubicleCap} seats:
                      </p>
                      <div className="max-h-24 overflow-y-auto rounded border border-red-200/30 bg-black/5 p-1 font-mono text-[10px] dark:bg-black/20">
                        {infeasibilityDetails.blockedIntervals.map((b, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between border-b border-red-200/10 px-1 py-0.5 last:border-b-0"
                          >
                            <span>{b.day} {b.time}</span>
                            <span>Req: {b.required} &gt; Cap: {b.cap}</span>
                          </div>
                        ))}
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setCustomCubicleCap(38)}
                        className="h-7 w-full bg-red-600 text-[10px] text-white hover:bg-red-700"
                      >
                        Set cubicle cap to 38
                      </Button>
                    </div>
                  )}

                  {infeasibilityDetails.isHeadcountInfeasible && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold text-red-900 dark:text-red-200">Headcount shortfall</p>
                      <p className="text-[10px] text-muted-foreground">
                        Enabled shift caps total {infeasibilityDetails.maxEnabledCount}, less than the required {infeasibilityDetails.totalRequired} agents.
                      </p>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setShifts((prev) => ({
                            ...prev,
                            eightHour: { ...prev.eightHour, enabled: true, maxCount: 36 },
                          }));
                        }}
                        className="h-7 w-full bg-red-600 text-[10px] text-white hover:bg-red-700"
                      >
                        Enable 8-hour shifts at full roster
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Run summary — confirms what's about to happen */}
              <div className="rounded-md border border-border/60 bg-muted/20 p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  This run will use
                </p>
                <p className="mt-1 font-mono text-[11px] tabular-nums text-foreground">
                  {runSummary}
                </p>
              </div>

              <Button
                variant="default"
                onClick={handleRunOptimization}
                disabled={isSolving || isViewer || infeasibilityDetails.isBlocked}
                className="group flex h-10 w-full items-center justify-center gap-2 font-semibold transition-all hover:shadow-md hover:shadow-primary/20"
              >
                {isSolving ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Running optimization…
                  </>
                ) : isViewer ? (
                  <>
                    <Play className="h-4 w-4 fill-current opacity-50" />
                    Viewer mode (read-only)
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current transition-transform group-hover:scale-110" />
                    Run optimization
                  </>
                )}
              </Button>
            </div>
          </aside>
        </div>
      </section>

      {/* ─── STAKEHOLDER FEEDBACK (viewer mode only) ──────────────── */}
      {isViewer && (
        <section>
          <SectionHeader
            title="Stakeholder feedback"
            hint={`${comments.length} comment${comments.length === 1 ? "" : "s"}`}
          />
          <div className="mt-5 space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FieldGroup label="Your name" htmlFor="feedback-name">
                <input
                  id="feedback-name"
                  type="text"
                  placeholder="e.g. Supervisor Jones"
                  value={commentName}
                  onChange={(e) => setCommentName(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                />
              </FieldGroup>
              <FieldGroup label="Comment" htmlFor="feedback-text">
                <textarea
                  id="feedback-text"
                  rows={1}
                  placeholder="e.g. Overnight shift has too much overlap…"
                  value={commentText}
                  onChange={(e) => setCommentComment(e.target.value)}
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-xs"
                />
              </FieldGroup>
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
                localStorage.setItem(
                  `schedule-platform.feedback-${optId || "default"}`,
                  JSON.stringify(updated),
                );
                setCommentName("");
                setCommentComment("");
              }}
              disabled={!commentName.trim() || !commentText.trim()}
              className="h-8 text-xs font-semibold text-foreground"
            >
              <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
              Submit feedback
            </Button>

            {comments.length > 0 && (
              <div className="max-h-48 space-y-2.5 overflow-y-auto border-t border-border pt-3">
                {comments.map((c, i) => (
                  <div key={i} className="space-y-0.5 rounded bg-muted/40 p-2 text-xs">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="font-bold text-foreground">{c.name}</span>
                      <span>{c.date}</span>
                    </div>
                    <p className="font-sans text-[11px] leading-relaxed text-foreground/80">{c.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ─── HISTORY ───────────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Optimization history" hint={historySummary} />
        <div className="mt-5 overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-muted/30 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-10 p-2.5 pl-4 text-center">Cmp</th>
                <th className="p-2.5">Run name</th>
                <th className="p-2.5">Created</th>
                <th className="p-2.5">Notes</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5 text-right">Bodies</th>
                <th className="p-2.5 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {optimizations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-xs text-muted-foreground">
                    No runs saved yet. Configure constraints above and click Run.
                  </td>
                </tr>
              ) : (
                optimizations.map((opt) => {
                  const isActive = optId === opt.id;
                  const isSelected = selectedScenarios.includes(opt.id);
                  const dateStr = new Date(opt.created_at).toLocaleString();
                  return (
                    <tr
                      key={opt.id}
                      className={cn(
                        "transition-colors",
                        isActive ? "bg-primary/5 font-medium" : "hover:bg-muted/30",
                      )}
                    >
                      <td className="p-2.5 pl-4 text-center">
                        {opt.status === "succeeded" ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleSelectScenario(opt.id, e.target.checked)}
                            className="cursor-pointer rounded border-input text-primary focus:ring-ring"
                          />
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="max-w-[220px] truncate p-2.5">
                        <div className="flex items-center gap-2">
                          {isActive && (
                            <span className="inline-flex h-4 items-center rounded bg-primary/15 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                              Active
                            </span>
                          )}
                          <span>{opt.run_name}</span>
                        </div>
                      </td>
                      <td className="num p-2.5 text-xs text-muted-foreground">{dateStr}</td>
                      <td className="max-w-[220px] truncate p-2.5 text-xs text-muted-foreground">
                        {opt.notes || "—"}
                      </td>
                      <td className="p-2.5">
                        <StatusBadge status={opt.status} />
                      </td>
                      <td className="num p-2.5 text-right text-xs text-muted-foreground tabular-nums">
                        {opt.kpis?.total_bodies ?? "—"}
                      </td>
                      <td className="space-x-1.5 p-2.5 pr-4 text-right">
                        {opt.status === "succeeded" && (
                          <Button
                            variant={isActive ? "outline" : "default"}
                            size="sm"
                            className="h-7 px-2.5 text-xs"
                            onClick={async () => {
                              await setOptId(isActive ? "" : opt.id);
                            }}
                          >
                            {isActive ? "Deselect" : "Overlay"}
                          </Button>
                        )}
                        {!isViewer && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-rose-500 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-600 [tr:hover_&]:opacity-100"
                            onClick={() => handleDeleteRun(opt.id, opt.run_name)}
                            title="Delete this run"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── COMPARE SCENARIOS (conditional) ───────────────────────── */}
      {selectedScenarios.length > 0 && (
        <section>
          <SectionHeader title="Compare scenarios" hint={`${selectedScenarios.length} of 3 selected`} />
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {selectedScenarios.map((id) => {
              const opt = optimizations.find((o) => o.id === id);
              if (!opt) return null;

              const payload = scenarioPayloads[id];
              const isLoading = loadingPayloads[id];
              const metrics = payload ? computeScenarioMetrics(payload, leadPct) : null;

              return (
                <Card key={id} className="relative overflow-hidden border border-border shadow-sm">
                  {isLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-[1px]">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  <CardHeader className="bg-muted/30 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle
                        className="max-w-[200px] truncate text-sm font-semibold"
                        title={opt.run_name}
                      >
                        {opt.run_name}
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          setSelectedScenarios((prev) => prev.filter((x) => x !== id))
                        }
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {new Date(opt.created_at).toLocaleDateString("en-US", {
                        timeZone: "America/Phoenix",
                      })}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-4 font-sans text-xs">
                    {metrics ? (
                      <>
                        <CompareRow icon={<DollarSign className="h-3.5 w-3.5" />} label="Total cost">
                          {metrics.totalCost.toLocaleString("en-US", { style: "currency", currency: "USD" })}
                        </CompareRow>
                        <CompareRow icon={<Check className="h-3.5 w-3.5 text-emerald-500" />} label="Coverage">
                          {metrics.weightedCoveragePct.toFixed(1)}%
                        </CompareRow>
                        <CompareRow icon={<Users2 className="h-3.5 w-3.5 text-rose-500" />} label="12-hour shifts">
                          {metrics.twelveHourCount} agents
                        </CompareRow>
                        <CompareRow icon={<Users2 className="h-3.5 w-3.5 text-violet-500" />} label="Split shifts">
                          {metrics.splitShiftCount} agents
                        </CompareRow>
                        <CompareRow icon={<Home className="h-3.5 w-3.5 text-blue-500" />} label="Peak occupancy">
                          {metrics.peakCubicles} / {payload?.meta?.cubicle_cap || 34} seats
                        </CompareRow>
                      </>
                    ) : (
                      <div className="py-6 text-center text-muted-foreground">
                        Failed to compute comparison metrics.
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
