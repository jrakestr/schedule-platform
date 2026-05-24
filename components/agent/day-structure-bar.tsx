"use client";

import { useMemo } from "react";
import {
  SEGMENT_KINDS,
  catalogSegmentsToTimeline,
  formatClock24,
  formatSegmentLabel,
  structureToTimeline,
  timelineBoundaries,
  timelineSpan,
  type TimelineSegment,
} from "@/lib/compute/day-structure";
import { segmentKindColor } from "@/lib/navigation/panel-params";
import { cn } from "@/lib/utils";
import type { ShiftSegment } from "@/lib/data/types";

interface DayStructureBarProps {
  /** Agent day-structure string (HH:MM-HH:MM Kind | …). */
  structure?: string;
  /** Shift-template segments (minutes from shift start). */
  segments?: ShiftSegment[];
  /** Shift start clock when rendering catalog segments. */
  startClock?: string;
  /** Shift end clock — axis label fallback when segments are absent. */
  endClock?: string;
  /** Full layout includes clock axis, boundary ticks, and legend. */
  variant?: "full" | "compact";
  className?: string;
}

function resolveTimeline(props: DayStructureBarProps): TimelineSegment[] {
  if (props.structure) return structureToTimeline(props.structure);
  if (props.segments?.length && props.startClock) {
    return catalogSegmentsToTimeline(props.segments, props.startClock);
  }
  return [];
}

function SegmentLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-x-3 gap-y-1", className)}>
      {SEGMENT_KINDS.map((kind) => (
        <span
          key={kind}
          className="inline-flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground"
        >
          <span
            className="inline-block h-2 w-2 rounded-sm"
            style={{ backgroundColor: segmentKindColor(kind) }}
          />
          {kind}
        </span>
      ))}
    </div>
  );
}

function SegmentBar({
  segments,
  span,
  barClassName,
}: {
  segments: TimelineSegment[];
  span: number;
  barClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full overflow-hidden rounded-md border border-border/60 bg-muted/20 shadow-inner",
        barClassName,
      )}
      role="img"
      aria-label="Day structure timeline"
    >
      {segments.map((seg, i) => {
        const widthPct = ((seg.endMin - seg.startMin) / span) * 100;
        return (
          <div
            key={`${seg.startMin}-${seg.kind}-${i}`}
            className="h-full shrink-0 transition-opacity hover:opacity-90"
            style={{
              width: `${widthPct}%`,
              backgroundColor: segmentKindColor(seg.kind),
              opacity: seg.kind === "Voice" ? 1 : 0.9,
            }}
            title={formatSegmentLabel(seg.startMin, seg.endMin, seg.kind)}
          />
        );
      })}
    </div>
  );
}

function BoundaryTicks({
  segments,
  span,
  startMin,
}: {
  segments: TimelineSegment[];
  span: number;
  startMin: number;
}) {
  const boundaries = timelineBoundaries(segments);
  if (boundaries.length <= 2) return null;

  return (
    <div className="relative h-3 w-full" aria-hidden>
      {boundaries.map((min) => {
        const leftPct = ((min - startMin) / span) * 100;
        if (leftPct <= 0 || leftPct >= 100) return null;
        return (
          <div
            key={min}
            className="absolute top-0 flex flex-col items-center"
            style={{ left: `${leftPct}%`, transform: "translateX(-50%)" }}
          >
            <span className="h-1.5 w-px bg-border" />
            <span className="mt-0.5 text-[9px] text-muted-foreground/80 num tabular-nums whitespace-nowrap">
              {formatClock24(min)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Voice / Break / Lunch timeline with clock axis, legend, and segment tooltips. */
export function DayStructureBar({
  structure,
  segments: catalogSegments,
  startClock,
  endClock,
  variant = "full",
  className,
}: DayStructureBarProps) {
  const segments = useMemo(
    () => resolveTimeline({ structure, segments: catalogSegments, startClock, endClock }),
    [structure, catalogSegments, startClock, endClock],
  );

  const { startMin, endMin, span } = useMemo(() => timelineSpan(segments), [segments]);

  const axisStart =
    startClock ??
    (segments.length ? formatClock24(startMin) : "—");
  const axisEnd =
    endClock ??
    (segments.length ? formatClock24(endMin) : "—");

  if (!segments.length) {
    return (
      <p className={cn("text-xs text-muted-foreground italic", className)}>
        No day structure available
      </p>
    );
  }

  const barHeight = variant === "full" ? "h-4" : "h-2.5";

  if (variant === "compact") {
    return (
      <div className={cn("space-y-1", className)}>
        <div className="flex items-center justify-between text-[9px] text-muted-foreground num tabular-nums">
          <span>{axisStart}</span>
          <span>{axisEnd}</span>
        </div>
        <SegmentBar segments={segments} span={span} barClassName={barHeight} />
      </div>
    );
  }

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground num tabular-nums">
        <span>{axisStart}</span>
        <span>{axisEnd}</span>
      </div>

      <SegmentBar segments={segments} span={span} barClassName={barHeight} />
      <BoundaryTicks segments={segments} span={span} startMin={startMin} />
      <SegmentLegend />
    </div>
  );
}
