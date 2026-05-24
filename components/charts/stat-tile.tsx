import * as React from "react";
import { Card } from "@/components/ui/card";
import { LabelWithHelp } from "@/components/shared/metric-help";
import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  /** Rich tooltip on the label (data source / definition). */
  tooltip?: React.ReactNode;
  tone?: string;
  className?: string;
}

export function StatTile({
  label,
  value,
  hint,
  tooltip,
  tone,
  className,
}: StatTileProps) {
  return (
    <Card
      className={cn("px-3 py-3 shadow-none", className)}
      title={tooltip ? undefined : hint}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {tooltip ? (
          <LabelWithHelp label={label} help={tooltip} helpLabel={`${label} definition`} />
        ) : (
          label
        )}
      </div>
      <div className={cn("text-lg font-semibold num leading-tight", tone)}>
        {value}
      </div>
      {hint && (
        <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>
      )}
    </Card>
  );
}
