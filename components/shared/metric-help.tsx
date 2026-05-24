"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface MetricHelpProps {
  content: React.ReactNode;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
  /** Accessible name when the trigger is icon-only. */
  label?: string;
}

export function MetricHelp({
  content,
  className,
  side = "top",
  label = "Metric definition",
}: MetricHelpProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-sm text-muted-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
          aria-label={label}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        className="max-w-[300px] text-xs leading-relaxed"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

interface LabelWithHelpProps {
  label: React.ReactNode;
  help: React.ReactNode;
  className?: string;
  helpLabel?: string;
}

/** Inline label + help icon (table headers, stat tiles). */
export function LabelWithHelp({
  label,
  help,
  className,
  helpLabel,
}: LabelWithHelpProps) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span>{label}</span>
      <MetricHelp content={help} label={helpLabel ?? `${String(label)} definition`} />
    </span>
  );
}
