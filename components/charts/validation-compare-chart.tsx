// This component displays a comparison chart for staff distribution and call volumes over a 24-hour period.
// It uses Recharts for data visualization and allows comparing required, proposed, and current staffing levels
// alongside offered and abandoned calls.

"use client"; // Marks this component as a Client Component, necessary for interactivity in Next.js

import {
  Bar, // Used for displaying bar charts (e.g., staff numbers)
  CartesianGrid, // Grid lines for the chart background
  ComposedChart, // A flexible chart type that can combine multiple chart types (line, bar)
  Line, // Used for displaying line charts (e.g., call volumes)
  ResponsiveContainer, // Makes the chart responsive to its parent's size
  Tooltip, // Displays detailed information when hovering over chart elements
  XAxis, // X-axis for displaying time (hours)
  YAxis, // Y-axis for displaying numerical values (staff count, call count)
} from "recharts";
import type {
  DistributionViewMode, // Type defining how the data should be viewed (proposed, legacy, compare)
  HourDistributionRow, // Type defining the structure of data for each hour
} from "@/lib/compute/distribution";
import { formatClock24 } from "@/lib/compute/day-structure"; // Utility to format hour strings to 24-hour clock
import { fmtDuration } from "@/lib/utils"; // Utility to format a duration in seconds

// Constants defining the start and end hours for the chart display.
// The chart will display data from 1:00 AM to 11:00 PM.
const CHART_HOUR_START = 1;
const CHART_HOUR_END = 23;

/**
 * Props for the ValidationCompareChart component.
 */
interface ValidationCompareChartProps {
  rows: HourDistributionRow[]; // Array of data rows, each representing an hour's distribution
  viewMode: DistributionViewMode; // Determines which staffing levels (proposed, current) to display
  selectedHour?: string | null; // Optional prop to highlight a specific hour, not actively used in rendering here but could be for external control
  onHourSelect?: (hour: string) => void; // Optional callback when an hour is clicked on the chart
}

/**
 * Internal interface for chart data points, transformed from HourDistributionRow.
 * This structure is optimized for direct use with Recharts components.
 */
interface ChartPoint {
  hour: string; // The formatted hour string (e.g., "09")
  hourIndex: number; // The numerical index of the hour (e.g., 9)
  calls: number; // Number of offered calls
  abandoned: number; // Number of abandoned calls
  required: number; // Required staff count (calculated via Erlang C)
  proposed: number; // Proposed staff count
  current: number; // Legacy/current staff count
  manual: number; // Manual roster on-shift count (SDS + Next Day + Supervisor)
  shortfall: number; // Difference between required and proposed staff (if proposed < required)
  ahtSeconds: number; // Average Handling Time in seconds for the hour
}

/**
 * Props for the custom CompareTooltip component.
 */
interface CompareTooltipProps {
  active?: boolean; // True if the tooltip is active (hovering over a chart element)
  payload?: Array<{ dataKey?: string; value?: number; color?: string }>; // Data items for the current hovered point
  label?: string; // The label for the current hovered point (e.g., hour string)
}

/**
 * Custom tooltip component for the Recharts chart.
 * Displays detailed information about the hovered hour, including staff, calls, and AHT.
 */
function CompareTooltip({ active, payload, label }: CompareTooltipProps) {
  // If the tooltip is not active, or there's no data/label, don't render anything.
  if (!active || !payload?.length || !label) return null;

  // Extract relevant values from the payload array based on their dataKey.
  // Default to 0 if a value is not found.
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
  // Calculate shortfall: the positive difference if required staff is more than proposed.
  const shortfall = Math.max(0, required - proposed);
  const aht = payload.find((p) => p.dataKey === "ahtSeconds")?.value;

  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      {/* Display the formatted hour at the top */}
      <div className="font-medium">{formatClock24(label)}</div>
      {/* Display calls and abandoned calls */}
      <div className="text-muted-foreground">
        {Math.round(calls)} calls · {Math.round(abandoned)} abandoned
      </div>
      {/* Display required and proposed staff, and any shortfall */}
      <div className="text-muted-foreground">
        Req {required.toFixed(1)} · Prop {proposed.toFixed(1)}
        {shortfall > 0 ? ` · Gap ${shortfall.toFixed(1)}` : ""}
      </div>
      {/* Display current staff if it's a positive value */}
      {current > 0 && (
        <div className="text-muted-foreground">Current {current.toFixed(1)}</div>
      )}
      {(() => {
        const manual = Number(payload.find((p) => p.dataKey === "manual")?.value ?? 0);
        return manual > 0 ? (
          <div className="text-muted-foreground">Schedulers + Sup {manual.toFixed(1)}</div>
        ) : null;
      })()}
      {/* Display AHT if available and positive */}
      {typeof aht === "number" && aht > 0 && (
        <div className="text-muted-foreground">AHT {fmtDuration(aht)} (handled talk+wrap)</div>
      )}
      {/* Disclaimer and data source information */}
      <div className="mt-1.5 border-t border-border/60 pt-1 text-[10px] text-muted-foreground/90 leading-snug">
        Req = Erlang C from forecast offered × AHT. Prop = Voice headcount scheduled. Source: call_segments_cleaned.csv.
      </div>
    </div>
  );
}

/**
 * Main component for rendering the staff validation comparison chart.
 *
 * @param {ValidationCompareChartProps} props - The props for the component.
 * @returns {JSX.Element} The rendered chart.
 */
export function ValidationCompareChart({
  rows,
  viewMode,
  onHourSelect,
}: ValidationCompareChartProps) {
  // Transform raw data rows into a format suitable for Recharts.
  // Filters data to include only hours within the defined CHART_HOUR_START and CHART_HOUR_END.
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
      manual: row.manualStaff,
      shortfall: Math.max(0, row.requiredStaff - row.proposedStaff), // Calculate shortfall, ensuring it's never negative
      ahtSeconds: row.ahtSeconds ?? 0, // Default AHT to 0 if not provided
    }));

  // Determine the maximum staff value for setting the Y-axis domain for staff.
  // Ensures the axis scales dynamically based on the data.
  const maxStaff = Math.max(
    1, // Minimum of 1 to prevent division by zero or overly small scales
    ...data.flatMap((d) => [d.proposed, d.required, d.current, d.manual]),
  );
  // Calculate a ceiling for the staff Y-axis to provide some padding above the max value.
  const staffCeiling = Math.ceil(maxStaff * 1.15);

  // Determine the maximum call volume for setting the Y-axis domain for calls.
  const maxCalls = Math.max(1, ...data.flatMap((d) => [d.calls, d.abandoned]));

  // Flags to conditionally show or hide 'Proposed CSAs' and 'Current CSAs' based on the viewMode.
  const showProposed = viewMode === "proposed" || viewMode === "compare";
  const showCurrent = viewMode === "legacy" || viewMode === "compare";

  return (
    <div className="space-y-2">
      {/* Chart Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {/* Required CSAs legend item */}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500/80" />
          Required CSAs
        </span>
        {/* Proposed CSAs legend item, shown conditionally */}
        {showProposed && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-indigo-500" />
            Proposed CSAs
          </span>
        )}
        {/* Current CSAs legend item, shown conditionally */}
        {showCurrent && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-orange-500" />
            Current CSAs
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-emerald-500" />
          Schedulers + Supervisors (manual)
        </span>
        {/* Offered calls legend item */}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-slate-500" />
          Offered calls
        </span>
        {/* Abandoned calls legend item */}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-rose-500" />
          Abandoned
        </span>
        {/* Display the hour range covered by the chart */}
        <span className="ml-auto num tabular-nums">
          Hours {String(CHART_HOUR_START).padStart(2, "0")}:00–
          {String(CHART_HOUR_END).padStart(2, "0")}:00
        </span>
      </div>

      {/* Chart Container */}
      <div className="h-[300px] w-full">
        {/* ResponsiveContainer ensures the chart scales with its parent */}
        <ResponsiveContainer width="100%" height="100%">
          {/* ComposedChart allows combining bar and line charts */}
          <ComposedChart
            data={data} // The data array for the chart
            margin={{ top: 8, right: 44, left: 8, bottom: 4 }} // Chart margins
            onClick={(state) => {
              // Handle click events on the chart, e.g., to select an hour
              const hour = state?.activeLabel;
              if (typeof hour === "string" && onHourSelect) {
                onHourSelect(hour);
              }
            }}
          >
            {/* Background grid for the chart */}
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            {/* X-axis for hours */}
            <XAxis
              dataKey="hour" // Data key for the hour value
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} // Styling for tick labels
              tickFormatter={(v) => formatClock24(String(v))} // Format hour labels to 24-hour clock
              interval={1} // Show every hour tick
              angle={-45} // Rotate tick labels for readability
              textAnchor="end" // Anchor text to the end of the tick mark
              height={52} // Height of the X-axis area
            />
            {/* Left Y-axis for staff counts */}
            <YAxis
              yAxisId="staff" // Unique ID for this Y-axis
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => String(Number(v).toFixed(0))} // Format staff numbers as integers
              domain={[0, staffCeiling]} // Dynamic domain based on max staff + padding
              width={36} // Width of the Y-axis area
            />
            {/* Right Y-axis for call volumes */}
            <YAxis
              yAxisId="calls" // Unique ID for this Y-axis
              orientation="right" // Position on the right side of the chart
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => String(Math.round(Number(v)))} // Format call numbers as rounded integers
              domain={[0, Math.ceil(maxCalls * 1.1)]} // Dynamic domain based on max calls + padding
              width={40} // Width of the Y-axis area
            />
            {/* Tooltip component for hover details */}
            <Tooltip content={<CompareTooltip />} cursor={{ fillOpacity: 0.08 }} />
            {/* Bar chart for Required CSAs */}
            <Bar
              dataKey="required" // Data key for required staff
              name="Required" // Name displayed in tooltip
              fill="#d97706" // Bar fill color
              fillOpacity={0.35} // Reduced opacity for required staff
              stroke="#d97706" // Border color
              strokeWidth={1} // Border width
              yAxisId="staff" // Associate with the 'staff' Y-axis
              radius={[3, 3, 0, 0]} // Rounded top corners
              maxBarSize={28} // Maximum width of the bars
            />
            {/* Bar chart for Proposed CSAs, shown conditionally */}
            {showProposed && (
              <Bar
                dataKey="proposed" // Data key for proposed staff
                name="Proposed"
                fill="#4f46e5"
                yAxisId="staff"
                radius={[3, 3, 0, 0]}
                maxBarSize={viewMode === "compare" ? 18 : 28} // Smaller bar size in 'compare' mode
              />
            )}
            {/* Bar chart for Current CSAs, shown conditionally */}
            {showCurrent && (
              <Bar
                dataKey="current" // Data key for current staff
                name="Current"
                fill="#ea580c"
                yAxisId="staff"
                radius={[3, 3, 0, 0]}
                maxBarSize={viewMode === "compare" ? 18 : 28} // Smaller bar size in 'compare' mode
              />
            )}
            <Line
              type="monotone"
              dataKey="manual"
              name="Schedulers + Supervisors (manual)"
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
              yAxisId="staff"
            />
            {/* Line chart for Offered Calls */}
            <Line
              type="monotone" // Smooth line type
              dataKey="calls" // Data key for offered calls
              name="Calls"
              stroke="#64748b" // Line color
              strokeWidth={2} // Line thickness
              dot={false} // Don't show individual dots on the line
              yAxisId="calls" // Associate with the 'calls' Y-axis
            />
            {/* Line chart for Abandoned Calls */}
            <Line
              type="monotone"
              dataKey="abandoned" // Data key for abandoned calls
              name="Abandoned"
              stroke="#e11d48"
              strokeWidth={1.5}
              strokeDasharray="4 3" // Dashed line for abandoned calls
              dot={false}
              yAxisId="calls"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
