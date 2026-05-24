import type { ShiftSegment } from "@/lib/data/types";

export const SEGMENT_KINDS = ["Voice", "Break", "Lunch"] as const;

export interface TimelineSegment {
  startMin: number;
  endMin: number;
  kind: string;
}

export function parseClock(t: string): number | null {
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Wall-clock label in 24-hour HH:MM (wraps past midnight). */
export function formatClock24(minutesOrClock: number | string): string {
  const minutes =
    typeof minutesOrClock === "string"
      ? (parseClock(minutesOrClock) ?? 0)
      : minutesOrClock;
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const min = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function formatSegmentRange(startMin: number, endMin: number, kind: string): string {
  return `${formatClock24(startMin)}–${formatClock24(endMin)} · ${kind}`;
}

/** Segment hover label — clock window and block type only. */
export function formatSegmentLabel(startMin: number, endMin: number, kind: string): string {
  return formatSegmentRange(startMin, endMin, kind);
}

/** Agent structure string → absolute-minute segments. */
export function structureToTimeline(structure: string): TimelineSegment[] {
  if (!structure) return [];
  if (!structure.includes("|") && !structure.includes("Voice")) return [];

  const out: TimelineSegment[] = [];
  let prevEnd: number | null = null;

  for (const raw of structure.split("|")) {
    const s = raw.trim();
    if (!s) continue;
    const spaceIdx = s.lastIndexOf(" ");
    if (spaceIdx === -1) continue;
    const range = s.slice(0, spaceIdx).trim();
    const kind = s.slice(spaceIdx + 1).trim();
    const [a, b] = range.split("-");
    if (!a || !b) continue;

    let startMin = parseClock(a) ?? 0;
    let endMin = parseClock(b) ?? startMin;
    if (prevEnd !== null) {
      while (startMin < prevEnd) {
        startMin += 1440;
        endMin += 1440;
      }
    }
    if (endMin <= startMin) endMin += 1440;
    out.push({ startMin, endMin, kind });
    prevEnd = endMin;
  }

  return out;
}

/** Shift-catalog segments (shift-relative minutes) → absolute-minute segments. */
export function catalogSegmentsToTimeline(
  segments: ShiftSegment[],
  startClock: string,
): TimelineSegment[] {
  const base = parseClock(startClock);
  if (base === null || !segments.length) return [];

  return segments.map((seg) => ({
    startMin: base + seg.start_min,
    endMin: base + seg.start_min + seg.duration_min,
    kind: seg.kind,
  }));
}

export function timelineSpan(segments: TimelineSegment[]): {
  startMin: number;
  endMin: number;
  span: number;
} {
  if (!segments.length) return { startMin: 0, endMin: 1, span: 1 };
  const startMin = segments[0]!.startMin;
  const endMin = segments[segments.length - 1]!.endMin;
  return { startMin, endMin, span: Math.max(endMin - startMin, 1) };
}

/** Unique boundary minutes for tick marks (includes shift start and end). */
export function timelineBoundaries(segments: TimelineSegment[]): number[] {
  if (!segments.length) return [];
  const points = new Set<number>();
  for (const seg of segments) {
    points.add(seg.startMin);
    points.add(seg.endMin);
  }
  return [...points].sort((a, b) => a - b);
}
