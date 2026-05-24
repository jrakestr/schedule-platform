"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WeekGroupMode, WeekSortKey } from "@/lib/compute/week-schedule";
import { cn } from "@/lib/utils";

function SortButton({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] font-medium uppercase tracking-wider",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      {active ? (
        direction === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ChevronsUpDown className="h-3 w-3 opacity-50" />
      )}
    </button>
  );
}

interface ScheduleViewControlsProps {
  groupMode: WeekGroupMode;
  onGroupModeChange: (mode: WeekGroupMode) => void;
  sortKey: WeekSortKey;
  sortDesc: boolean;
  onSortChange: (key: WeekSortKey) => void;
  showGroupToggle?: boolean;
  className?: string;
}

export function ScheduleViewControls({
  groupMode,
  onGroupModeChange,
  sortKey,
  sortDesc,
  onSortChange,
  showGroupToggle = true,
  className,
}: ScheduleViewControlsProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {showGroupToggle ? (
        <div className="flex rounded-md border border-border/60 p-0.5">
          <Button
            type="button"
            variant={groupMode === "flat" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => onGroupModeChange("flat")}
          >
            Flat list
          </Button>
          <Button
            type="button"
            variant={groupMode === "team" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => onGroupModeChange("team")}
          >
            By team
          </Button>
        </div>
      ) : null}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <SortButton
          label="Name"
          active={sortKey === "name"}
          direction={sortDesc ? "desc" : "asc"}
          onClick={() => onSortChange("name")}
        />
        <SortButton
          label="Start"
          active={sortKey === "start"}
          direction={sortDesc ? "desc" : "asc"}
          onClick={() => onSortChange("start")}
        />
        <SortButton
          label="Shift"
          active={sortKey === "shift"}
          direction={sortDesc ? "desc" : "asc"}
          onClick={() => onSortChange("shift")}
        />
        <SortButton
          label="Hours"
          active={sortKey === "hours"}
          direction={sortDesc ? "desc" : "asc"}
          onClick={() => onSortChange("hours")}
        />
      </div>
    </div>
  );
}
