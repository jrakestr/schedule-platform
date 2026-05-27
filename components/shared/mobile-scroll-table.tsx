import * as React from "react";
import { cn } from "@/lib/utils";

interface MobileScrollTableProps {
  children: React.ReactNode;
  hint?: string;
  className?: string;
}

/** Horizontal scroll shell with sticky-column support and a mobile swipe hint. */
export function MobileScrollTable({
  children,
  hint = "Swipe sideways to see all columns",
  className,
}: MobileScrollTableProps) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <p className="mb-1.5 text-[10px] leading-snug text-muted-foreground sm:hidden">{hint}</p>
      <div className="relative overflow-hidden rounded-md border">
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-background via-background/80 to-transparent sm:hidden"
          aria-hidden
        />
        <div className="overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch]">
          {children}
        </div>
      </div>
    </div>
  );
}

export const mobileTableClass = "w-max min-w-full border-collapse text-sm";

export const mobileThClass =
  "h-9 whitespace-nowrap px-2 py-2 text-left align-middle text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:px-3 sm:text-xs";

export const mobileTdClass =
  "whitespace-nowrap px-2 py-2.5 align-middle text-[11px] tabular-nums sm:px-3 sm:text-xs";

export const mobileStickyHeadClass =
  "sticky left-0 z-30 min-w-[7.5rem] max-w-[9rem] border-r bg-muted/40 shadow-[3px_0_8px_-4px_rgba(0,0,0,0.18)] sm:min-w-[11rem] sm:max-w-none";

export const mobileStickyCellClass =
  "sticky left-0 z-20 min-w-[7.5rem] max-w-[9rem] whitespace-normal border-r bg-card leading-snug shadow-[3px_0_8px_-4px_rgba(0,0,0,0.12)] sm:min-w-[11rem] sm:max-w-none sm:whitespace-nowrap";

export const mobileStickyMutedCellClass =
  "sticky left-0 z-20 min-w-[7.5rem] max-w-[9rem] whitespace-normal border-r bg-muted/40 leading-snug shadow-[3px_0_8px_-4px_rgba(0,0,0,0.12)] sm:min-w-[11rem] sm:max-w-none sm:whitespace-nowrap";

export const mobileNumHeadClass = "min-w-[2.25rem] px-1.5 text-right sm:min-w-[2.75rem] sm:px-2";

export const mobileNumCellClass = "px-1.5 text-right sm:px-2";

export function MobileTableSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 min-w-0">
      <div>
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {description && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}
