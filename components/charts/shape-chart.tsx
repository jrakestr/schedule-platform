"use client";

import {
  Area,
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ShapeChartProps {
  offered: number[];
  supplied: number[];
  legacySupplied?: number[];
  viewMode?: "proposed" | "legacy" | "compare";
  intervals: string[];
  metricMode: "share" | "raw";
}

export function ShapeChart({
  offered,
  supplied,
  legacySupplied,
  viewMode = "proposed",
  intervals,
  metricMode,
}: ShapeChartProps) {
  const offTotal = offered.reduce((s, v) => s + v, 0) || 1;
  const supTotal = supplied.reduce((s, v) => s + v, 0) || 1;
  const legacyTotal = legacySupplied ? legacySupplied.reduce((s, v) => s + v, 0) || 1 : 1;

  const data = intervals.map((label, i) => ({
    interval: label,
    volume: (offered[i] / offTotal) * 100,
    staff: (supplied[i] / supTotal) * 100,
    legacyStaff: legacySupplied ? (legacySupplied[i] / legacyTotal) * 100 : 0,
    rawVolume: offered[i],
    rawStaff: supplied[i],
    rawLegacyStaff: legacySupplied ? legacySupplied[i] : 0,
  }));

  const ticks = ["00:00", "03:00", "06:00", "09:00", "12:00", "15:00", "18:00", "21:00"];
  // Uniform reference: a perfectly flat 24h schedule would put 1/48 = ~2.08%
  // of staff into each 30-min interval. Drawing this as a dashed line lets
  // reviewers see at a glance which hours are above/below "evenly spread."
  const uniformShare = 100 / 48;

  return (
    <div className="h-[330px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 12, right: 48, left: 24, bottom: 8 }}
        >
          <defs>
            <linearGradient id="vol-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="interval"
            ticks={ticks}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            interval={5}
          />
          {metricMode === "share" ? (
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => `${Number(v).toFixed(1)}%`}
              width={56}
            />
          ) : (
            <>
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v) => String(Math.round(v))}
                width={40}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v) => String(Number(v).toFixed(1))}
                width={40}
              />
            </>
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 6,
              fontSize: 12,
            }}
            formatter={(value: number, name: string, props: any) => {
              const key = props?.dataKey;
              if (metricMode === "share") {
                if (key === "volume") return [`${value.toFixed(2)}%`, "Call volume share"];
                if (key === "staff") return [`${value.toFixed(2)}%`, "Proposed Scheduled CSA share"];
                if (key === "legacyStaff") return [`${value.toFixed(2)}%`, "Current/Legacy Scheduled CSA share"];
                return [`${value.toFixed(2)}%`, name];
              } else {
                if (key === "rawVolume") return [`${Math.round(value)} calls`, "Call volume"];
                if (key === "rawStaff") return [`${value.toFixed(1)} agents`, "Proposed Scheduled CSAs"];
                if (key === "rawLegacyStaff") return [`${value.toFixed(1)} agents`, "Current/Legacy Scheduled CSAs"];
                return [value, name];
              }
            }}
            labelFormatter={(label) => `Interval ${label}`}
          />
          {metricMode === "share" && (
            <ReferenceLine
              y={uniformShare}
              yAxisId="left"
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 4"
              strokeOpacity={0.5}
              label={{
                value: "Uniform",
                position: "insideBottomRight",
                fill: "hsl(var(--muted-foreground))",
                fontSize: 10,
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey={metricMode === "share" ? "volume" : "rawVolume"}
            name={metricMode === "share" ? "Call volume share" : "Call volume"}
            stroke="#475569"
            strokeWidth={2}
            fill="url(#vol-fill)"
            yAxisId="left"
          />
          {(viewMode === "proposed" || viewMode === "compare") && (
            <Line
              type="monotone"
              dataKey={metricMode === "share" ? "staff" : "rawStaff"}
              name={metricMode === "share" ? "Proposed Scheduled CSA share" : "Proposed Scheduled CSAs"}
              stroke="#4f46e5"
              strokeWidth={2}
              dot={false}
              yAxisId={metricMode === "raw" ? "right" : "left"}
            />
          )}
          {(viewMode === "legacy" || viewMode === "compare") && (
            <Line
              type="monotone"
              dataKey={metricMode === "share" ? "legacyStaff" : "rawLegacyStaff"}
              name={metricMode === "share" ? "Current/Legacy Scheduled CSA share" : "Current/Legacy Scheduled CSAs"}
              stroke="#ea580c"
              strokeWidth={2}
              dot={false}
              yAxisId={metricMode === "raw" ? "right" : "left"}
            />
          )}
          <Brush
            dataKey="interval"
            height={22}
            travellerWidth={8}
            stroke="#4f46e5"
            fill="hsl(var(--muted))"
            tickFormatter={() => ""}
            y={290}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
