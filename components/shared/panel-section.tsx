import * as React from "react";
import { cn } from "@/lib/utils";

export const PANEL_SECTION_LABEL =
  "text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80 font-semibold";

export const ENTITY_CHIP_CLASS =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none transition-[background-color,box-shadow] hover:shadow-sm cursor-pointer";

interface PanelSectionProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

/** Small-caps section label + visual content — no nested form boxes. */
export function PanelSection({ label, children, className }: PanelSectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      <h3 className={PANEL_SECTION_LABEL}>{label}</h3>
      {children}
    </section>
  );
}
