"use client";

import { useId, type ReactNode } from "react";
import { ChevronDown, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkLimitations } from "@/lib/data/schemas";

export const DEFAULT_WORK_LIMITATIONS: WorkLimitations = {
  maxWorkTime: "12:00",
  maxStretch: { enabled: true, time: "16:00" },
  breaks: { enabled: true, every: "5:00", length: "0:30" },
};

interface WorkLimitationsPanelProps {
  value: WorkLimitations;
  onChange: (next: WorkLimitations) => void;
  disabled?: boolean;
  defaultOpen?: boolean;
}

function DurationField({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-[11px] font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="H:MM"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-9 w-full rounded-lg border border-border/70 bg-background px-3",
          "font-mono text-xs tabular-nums shadow-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      />
    </div>
  );
}

function ToggleRow({
  id,
  label,
  checked,
  onCheckedChange,
  disabled,
  children,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/10">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <label htmlFor={id} className="text-xs font-medium text-foreground">
          {label}
        </label>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="h-4 w-4 rounded border-input text-primary focus:ring-primary cursor-pointer disabled:cursor-not-allowed"
        />
      </div>
      {checked && children && (
        <div className="grid grid-cols-2 gap-3 border-t border-border/50 px-3 py-3">
          {children}
        </div>
      )}
    </div>
  );
}

/** Optibus-style work limitation controls — Catalyst fieldset surface. */
export function WorkLimitationsPanel({
  value,
  onChange,
  disabled,
  defaultOpen = true,
}: WorkLimitationsPanelProps) {
  const baseId = useId();
  const maxWorkId = `${baseId}-max-work`;
  const stretchToggleId = `${baseId}-stretch-toggle`;
  const stretchTimeId = `${baseId}-stretch-time`;
  const breaksToggleId = `${baseId}-breaks-toggle`;
  const breaksEveryId = `${baseId}-breaks-every`;
  const breaksLengthId = `${baseId}-breaks-length`;

  return (
    <details
      open={defaultOpen}
      className="group rounded-xl border border-border/70 bg-card shadow-sm"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Timer className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
          Work limitations
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>

      <fieldset
        disabled={disabled}
        className="space-y-3 border-t border-border/60 px-4 py-4 disabled:opacity-60"
      >
        <DurationField
          id={maxWorkId}
          label="Max work time"
          value={value.maxWorkTime}
          onChange={(maxWorkTime) => onChange({ ...value, maxWorkTime })}
          disabled={disabled}
        />

        <ToggleRow
          id={stretchToggleId}
          label="Max stretch time"
          checked={value.maxStretch.enabled}
          onCheckedChange={(enabled) =>
            onChange({
              ...value,
              maxStretch: { ...value.maxStretch, enabled },
            })
          }
          disabled={disabled}
        >
          <DurationField
            id={stretchTimeId}
            label="Stretch limit"
            value={value.maxStretch.time}
            onChange={(time) =>
              onChange({
                ...value,
                maxStretch: { ...value.maxStretch, time },
              })
            }
            disabled={disabled}
          />
        </ToggleRow>

        <ToggleRow
          id={breaksToggleId}
          label="Breaks required every"
          checked={value.breaks.enabled}
          onCheckedChange={(enabled) =>
            onChange({
              ...value,
              breaks: { ...value.breaks, enabled },
            })
          }
          disabled={disabled}
        >
          <>
            <DurationField
              id={breaksEveryId}
              label="Interval"
              value={value.breaks.every}
              onChange={(every) =>
                onChange({
                  ...value,
                  breaks: { ...value.breaks, every },
                })
              }
              disabled={disabled}
            />
            <DurationField
              id={breaksLengthId}
              label="Break length"
              value={value.breaks.length}
              onChange={(length) =>
                onChange({
                  ...value,
                  breaks: { ...value.breaks, length },
                })
              }
              disabled={disabled}
            />
          </>
        </ToggleRow>
      </fieldset>
    </details>
  );
}
