"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface CubiclePillProps {
  number: string | number;
  day?: string;
  agentId?: string;
  highlighted?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  className?: string;
}

/** Indigo cubicle badge — matches Cubicles tab assignment pills. */
export function CubiclePill({
  number,
  day,
  agentId,
  highlighted = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
  className,
}: CubiclePillProps) {
  const label = String(number);
  const interactive = Boolean(onClick);

  const pill = (
    <span
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        "inline-flex items-center justify-center w-7 h-7 rounded-md font-bold font-mono text-xs transition-all duration-200 select-none",
        interactive && "cursor-pointer",
        highlighted
          ? "bg-indigo-600 text-white shadow-md scale-110 ring-2 ring-indigo-400 z-10"
          : "bg-indigo-50 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/60",
        className,
      )}
    >
      {label}
    </span>
  );

  if (day || agentId) {
    return (
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>{pill}</TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="font-semibold">Cubicle {label}</div>
          {agentId && day && (
            <div className="text-muted-foreground mt-0.5">
              {agentId} assigned on {day}
            </div>
          )}
          {interactive && (
            <div className="text-muted-foreground mt-0.5">Open in Cubicles tab</div>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  return pill;
}
