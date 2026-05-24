"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  DistributionViewMode,
  HourDistributionRow,
} from "@/lib/compute/distribution";
import { formatClock24 } from "@/lib/compute/day-structure";
import { fmtDuration } from "@/lib/utils";

const CHART_HOUR_START = 7;
const CHART_HOUR_END = 22;

interface ValidationCompareChartProps {
  rows: HourDistributionRow[];
  viewMode: DistributionViewMode;
  selectedHour?: string | null;
  onHourSelect?: (hour: string) => void;
}

interface ChartPoint {
  hour: string;
  hourIndex: number;
  calls: number;
  abandoned: number;
  required: number;
  proposed: number;
  current: number;
  shortfall: number;
  ahtSeconds: number;
}

interface CompareTooltipProps {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number; color?: string }>;
  label?: string;
}

function CompareTooltip({ active, payload, label }: CompareTooltipProps) {
  if (!active || !payload?.length || !label) return null;

  const proposed = Number(
    payload.find((p) => p.dataKey === "proposed")?.value ?? 0,
  );
  const required = Number(
    payload.find((p) => p.dataKey === "required")?.value ?? 0,
  );
  const current = Number(
    payload.find((p) => p.dataKey === "current")?.value ?? 0,
  );
  const calls = Number(payload.find((p) => p.dataKey === "calls")?.value ?? 0);
  const abandoned = Number(
    payload.find((p) => p.dataKey === "abandoned")?.value ?? 0,
  );
  const shortfall = Math.max(0, required - proposed);
  const aht = payload.find((p) => p.dataKey === "ahtSeconds")?.value;

  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <div className="font-medium">{formatClock24(label)}</div>
      <div className="text-muted-foreground">
        {Math.round(calls)} calls · {Math.round(abandoned)} abandoned
      </div>
      <div className="text-muted-foreground">
        Req {required.toFixed(1)} · Prop {proposed.toFixed(1)}
        {shortfall > 0 ? ` · Gap ${shortfall.toFixed(1)}` : ""}
      </div>
      {current > 0 && (
        <div className="text-muted-foreground">Current {current.toFixed(1)}</div>
      )}
      {typeof aht === "number" && aht > 0 && (
        <div className="text-muted-foreground">AHT {fmtDuration(aht)} (handled talk+wrap)</div>
      )}
      <div className="mt-1.5 border-t border-border/60 pt-1 text-[10px] text-muted-foreground/90 leading-snug">
        Req = Erlang C from forecast offered × AHT. Prop = Voice headcount scheduled. Source: call_segments_cleaned.csv.
      </div>
    </div>
  );
}

export function ValidationCompareChart({
  rows,
  viewMode,
  onHourSelect,
}: ValidationCompareChartProps) {
  const data: ChartPoint[] = rows
    .filter(
      (row) =>
        row.hourIndex >= CHART_HOUR_START && row.hourIndex <= CHART_HOUR_END,
    )
    .map((row) => ({
      hour: row.hour,
      hourIndex: row.hourIndex,
      calls: row.calls,
      abandoned: row.abandoned,
      required: row.requiredStaff,
      proposed: row.proposedStaff,
      current: row.legacyStaff,
      shortfall: Math.max(0, row.requiredStaff - row.proposedStaff),
      ahtSeconds: row.ahtSeconds ?? 0,
    }));

  const maxStaff = Math.max(
    1,
    ...data.flatMap((d) => [d.proposed, d.required, d.current]),
  );
  const staffCeiling = Math.ceil(maxStaff * 1.15);
  const maxCalls = Math.max(1, ...data.flatMap((d) => [d.calls, d.abandoned]));

  const showProposed = viewMode === "proposed" || viewMode === "compare";
  const showCurrent = viewMode === "legacy" || viewMode === "compare";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500/80" />
          Required CSAs
        </span>
        {showProposed && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-indigo-500" />
            Proposed CSAs
          </span>
        )}
        {showCurrent && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-orange-500" />
            Current CSAs
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-slate-500" />
          Offered calls
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-rose-500" />
          Abandoned
        </span>
        <span className="ml-auto num tabular-nums">
          Hours {String(CHART_HOUR_START).padStart(2, "0")}:00–
          {String(CHART_HOUR_END).padStart(2, "0")}:00
        </span>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 44, left: 8, bottom: 4 }}
            onClick={(state) => {
              const hour = state?.activeLabel;
              if (typeof hour === "string" && onHourSelect) {
                onHourSelect(hour);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => formatClock24(String(v))}
              interval={1}
              angle={-45}
              textAnchor="end"
              height={52}
            />
            <YAxis
              yAxisId="staff"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => String(Number(v).toFixed(0))}
              domain={[0, staffCeiling]}
              width={36}
            />
            <YAxis
              yAxisId="calls"
              orientation="right"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => String(Math.round(Number(v)))}
              domain={[0, Math.ceil(maxCalls * 1.1)]}
              width={40}
            />
            <Tooltip content={<CompareTooltip />} cursor={{ fillOpacity: 0.08 }} />
            <Bar
              dataKey="required"
              name="Required"
              fill="#d97706"
              fillOpacity={0.35}
              stroke="#d97706"
              strokeWidth={1}
              yAxisId="staff"
              radius={[3, 3, 0, 0]}
              maxBarSize={28}
            />
            {showProposed && (
              <Bar
                dataKey="proposed"
                name="Proposed"
                fill="#4f46e5"
                yAxisId="staff"
                radius={[3, 3, 0, 0]}
                maxBarSize={viewMode === "compare" ? 18 : 28}
              />
            )}
            {showCurrent && (
              <Bar
                dataKey="current"
                name="Current"
                fill="#ea580c"
                yAxisId="staff"
                radius={[3, 3, 0, 0]}
                maxBarSize={viewMode === "compare" ? 18 : 28}
              />
            )}
            <Line
              type="monotone"
              dataKey="calls"
              name="Calls"
              stroke="#64748b"
              strokeWidth={2}
              dot={false}
              yAxisId="calls"
            />
            <Line
              type="monotone"
              dataKey="abandoned"
              name="Abandoned"
              stroke="#e11d48"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              yAxisId="calls"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
