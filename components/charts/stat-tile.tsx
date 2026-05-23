import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: string;
  className?: string;
}

export function StatTile({
  label,
  value,
  hint,
  tone,
  className,
}: StatTileProps) {
  return (
    <Card
      className={cn("px-3 py-3 shadow-none", className)}
      title={hint}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={cn("text-lg font-semibold num leading-tight", tone)}>
        {value}
      </div>
    </Card>
  );
}
