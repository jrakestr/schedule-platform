"use client";

import { useId } from "react";
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
}

function DurationInput({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      placeholder="H:MM"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-7 w-full rounded-md border border-border/70 bg-background px-2",
        "font-mono text-xs tabular-nums shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
    />
  );
}

function LimitRow({
  label,
  checkbox,
  children,
}: {
  label: React.ReactNode;
  checkbox?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 text-xs">
      <label className="flex items-center gap-2 text-foreground">
        {checkbox}
        {label}
      </label>
      <div className="flex items-center justify-end gap-2">{children}</div>
    </div>
  );
}

/** Compact work limitation controls. Renders as a flat fieldset — the parent owns the section label. */
export function WorkLimitationsPanel({ value, onChange, disabled }: WorkLimitationsPanelProps) {
  const baseId = useId();
  const maxWorkId = `${baseId}-max-work`;
  const stretchToggleId = `${baseId}-stretch-toggle`;
  const stretchTimeId = `${baseId}-stretch-time`;
  const breaksToggleId = `${baseId}-breaks-toggle`;
  const breaksEveryId = `${baseId}-breaks-every`;
  const breaksLengthId = `${baseId}-breaks-length`;

  const checkboxClass =
    "h-3.5 w-3.5 rounded border-input text-primary focus:ring-primary cursor-pointer disabled:cursor-not-allowed";

  return (
    <fieldset
      disabled={disabled}
      className="space-y-2 rounded-lg border border-border/70 bg-card px-3 py-2.5 shadow-sm disabled:opacity-60"
    >
      <LimitRow label={<span>Max work time</span>}>
        <div className="w-20">
          <DurationInput
            id={maxWorkId}
            value={value.maxWorkTime}
            onChange={(maxWorkTime) => onChange({ ...value, maxWorkTime })}
            disabled={disabled}
          />
        </div>
      </LimitRow>

      <LimitRow
        label={<span>Max stretch time</span>}
        checkbox={
          <input
            id={stretchToggleId}
            type="checkbox"
            checked={value.maxStretch.enabled}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...value, maxStretch: { ...value.maxStretch, enabled: e.target.checked } })
            }
            className={checkboxClass}
          />
        }
      >
        {value.maxStretch.enabled ? (
          <div className="w-20">
            <DurationInput
              id={stretchTimeId}
              value={value.maxStretch.time}
              onChange={(time) =>
                onChange({ ...value, maxStretch: { ...value.maxStretch, time } })
              }
              disabled={disabled}
            />
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground">off</span>
        )}
      </LimitRow>

      <LimitRow
        label={<span>Break every / for</span>}
        checkbox={
          <input
            id={breaksToggleId}
            type="checkbox"
            checked={value.breaks.enabled}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...value, breaks: { ...value.breaks, enabled: e.target.checked } })
            }
            className={checkboxClass}
          />
        }
      >
        {value.breaks.enabled ? (
          <>
            <div className="w-16">
              <DurationInput
                id={breaksEveryId}
                value={value.breaks.every}
                onChange={(every) => onChange({ ...value, breaks: { ...value.breaks, every } })}
                disabled={disabled}
              />
            </div>
            <span className="text-[11px] text-muted-foreground">/</span>
            <div className="w-16">
              <DurationInput
                id={breaksLengthId}
                value={value.breaks.length}
                onChange={(length) => onChange({ ...value, breaks: { ...value.breaks, length } })}
                disabled={disabled}
              />
            </div>
          </>
        ) : (
          <span className="text-[11px] text-muted-foreground">off</span>
        )}
      </LimitRow>
    </fieldset>
  );
}
