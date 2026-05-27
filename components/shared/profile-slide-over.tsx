"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ProfileSlideOverProps {
  open: boolean;
  onClose: () => void;
  /** Hex accent for the left rail gradient. */
  accentColor?: string;
  title: string;
  header?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Right-rail slide-over shell — Catalyst zinc surface + role/pod accent rail. */
export function ProfileSlideOver({
  open,
  onClose,
  accentColor = "#64748b",
  title,
  header,
  children,
  className,
}: ProfileSlideOverProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className={cn(
          "fixed inset-y-0 right-0 left-auto top-0 h-full w-full max-w-[420px]",
          "translate-x-0 translate-y-0 rounded-none border-l border-border/70 p-0 gap-0",
          "surface-panel sm:max-h-full overflow-hidden flex flex-col",
          "[&>button.absolute]:hidden",
          className,
        )}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex h-full min-h-0">
          <div
            className="w-1 shrink-0"
            style={{
              background: `linear-gradient(180deg, ${accentColor}, ${accentColor}bb 55%, ${accentColor}55)`,
            }}
            aria-hidden
          />

          <div className="relative flex min-w-0 flex-1 flex-col">
            <DialogTitle className="sr-only">{title}</DialogTitle>

            <button
              type="button"
              onClick={onClose}
              className={cn(
                "absolute top-3.5 right-3.5 z-20 flex h-8 w-8 items-center justify-center",
                "rounded-lg text-muted-foreground transition-colors",
                "hover:bg-muted/70 hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
              )}
              aria-label="Close panel"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>

            {header}

            <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
