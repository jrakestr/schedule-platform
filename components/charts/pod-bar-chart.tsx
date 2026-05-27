"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { Button } from "@/components/ui/button";
import { agentSupply } from "@/lib/compute/supply";
import { POD_PALETTE } from "@/lib/compute/colors";
import type { Agent, DOW, Snapshot } from "@/lib/data/types";

const DEFAULT_CUBICLE_CAP = 34;

export interface PodBarChartProps {
  snapshot: Snapshot;
  podOrder: string[];
  day: DOW;
}

type LayoutMode = "stacked" | "grouped";

interface HourRow {
  hour: number;
  label: string;
  [podName: string]: number | string;
}

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return raw ? `hsl(${raw})` : fallback;
}

function computePodHourly(
  snapshot: Snapshot,
  podOrder: string[],
  day: DOW,
): { podHourly: Record<string, number[]>; colTotals: number[] } {
  const podHourly: Record<string, number[]> = {};
  for (const podName of podOrder) {
    const pod = snapshot.pods[podName];
    if (!pod) continue;
    const members = pod.members
      .map((id) => snapshot.agents.find((a) => a.id === id))
      .filter((a): a is Agent => !!a);
    const supply = agentSupply(members, day, 1.0);
    podHourly[podName] = Array.from({ length: 24 }, (_, h) =>
      Number(((supply[h * 2] + supply[h * 2 + 1]) / 2).toFixed(2)),
    );
  }
  const colTotals = Array.from({ length: 24 }, (_, h) =>
    Number(
      podOrder.reduce((s, p) => s + (podHourly[p]?.[h] ?? 0), 0).toFixed(2),
    ),
  );
  return { podHourly, colTotals };
}

export function PodBarChart({ snapshot, podOrder, day }: PodBarChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<LayoutMode>("stacked");
  const [size, setSize] = useState({ width: 800, height: 360 });

  const cubicleCap =
    snapshot.cubicles?.cap ?? snapshot.meta?.cubicle_cap ?? DEFAULT_CUBICLE_CAP;

  const { podHourly, colTotals, podColors, chartData, yMax } = useMemo(() => {
    const { podHourly: hourly, colTotals: totals } = computePodHourly(
      snapshot,
      podOrder,
      day,
    );
    const colors = Object.fromEntries(
      podOrder.map((name, i) => [
        name,
        POD_PALETTE[i % POD_PALETTE.length],
      ]),
    );
    const data: HourRow[] = Array.from({ length: 24 }, (_, h) => {
      const row: HourRow = {
        hour: h,
        label: snapshot.meta.hours[h] ?? `${String(h).padStart(2, "0")}:00`,
      };
      for (const pod of podOrder) {
        row[pod] = hourly[pod]?.[h] ?? 0;
      }
      return row;
    });
    const peak = Math.max(
      cubicleCap,
      ...totals,
      ...Object.values(hourly).flat(),
      1,
    );
    return {
      podHourly: hourly,
      colTotals: totals,
      podColors: colors,
      chartData: data,
      yMax: Math.ceil(peak * 1.08),
    };
  }, [snapshot, podOrder, day, cubicleCap]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 800;
      setSize({ width: Math.max(320, w), height: 360 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    if (!svgRef.current || podOrder.length === 0) return;

    const margin = { top: 16, right: 16, bottom: 36, left: 44 };
    const width = size.width;
    const height = size.height;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const muted = cssVar("--muted-foreground", "#64748b");
    const border = cssVar("--border", "#e2e8f0");
    const capColor = cssVar("--destructive", "#dc2626");

    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x0 = d3
      .scaleBand<number>()
      .domain(chartData.map((d) => d.hour))
      .range([0, innerW])
      .padding(layout === "stacked" ? 0.12 : 0.18);

    const x1 = d3
      .scaleBand<string>()
      .domain(podOrder)
      .range([0, x0.bandwidth()])
      .padding(0.08);

    const y = d3.scaleLinear().domain([0, yMax]).range([innerH, 0]).nice();

    const stackGen = d3
      .stack<HourRow>()
      .keys(podOrder)
      .value((d, key) => Number(d[key]) || 0);

    const stacked = stackGen(chartData);

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(x0)
          .tickFormat((h) => {
            const row = chartData[h as number];
            return row ? row.label : String(h);
          })
          .tickValues(
            chartData.filter((_, i) => i % 2 === 0).map((d) => d.hour),
          ),
      )
      .call((sel) => sel.selectAll("text").attr("fill", muted).attr("font-size", 10))
      .call((sel) => sel.selectAll("line, path").attr("stroke", border));

    g.append("g")
      .call(d3.axisLeft(y).ticks(6))
      .call((sel) => sel.selectAll("text").attr("fill", muted).attr("font-size", 10))
      .call((sel) => sel.selectAll("line, path").attr("stroke", border));

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerH / 2)
      .attr("y", -36)
      .attr("text-anchor", "middle")
      .attr("fill", muted)
      .attr("font-size", 11)
      .text("Scheduled headcount (avg)");

    if (colTotals.some((v) => v > 0)) {
      g.append("line")
        .attr("x1", 0)
        .attr("x2", innerW)
        .attr("y1", y(cubicleCap))
        .attr("y2", y(cubicleCap))
        .attr("stroke", capColor)
        .attr("stroke-dasharray", "5,4")
        .attr("stroke-opacity", 0.75);

      g.append("text")
        .attr("x", innerW - 4)
        .attr("y", y(cubicleCap) - 4)
        .attr("text-anchor", "end")
        .attr("fill", capColor)
        .attr("font-size", 10)
        .text(`${cubicleCap} cubicle cap`);
    }

    const tooltip = d3
      .select(containerRef.current)
      .selectAll<HTMLDivElement, null>(".pod-bar-tooltip")
      .data([null])
      .join("div")
      .attr("class", "pod-bar-tooltip pointer-events-none absolute z-20 hidden rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md");

    const showTip = (html: string, event: MouseEvent) => {
      const box = containerRef.current?.getBoundingClientRect();
      if (!box) return;
      tooltip
        .classed("hidden", false)
        .html(html)
        .style("left", `${event.clientX - box.left + 12}px`)
        .style("top", `${event.clientY - box.top - 8}px`);
    };

    const hideTip = () => tooltip.classed("hidden", true);

    interface BarDatum {
      key: string;
      hour: number;
      y0: number;
      y1: number;
      value: number;
    }

    const barData: BarDatum[] = stacked.flatMap((series) =>
      series.map((point) => ({
        key: series.key,
        hour: point.data.hour as number,
        y0: point[0],
        y1: point[1],
        value: Number(point.data[series.key]) || 0,
      })),
    );

    const bars = g
      .selectAll<SVGRectElement, BarDatum>(".pod-bar")
      .data(barData, (d) => `${d.key}-${d.hour}`);

    const barsEnter = bars
      .enter()
      .append("rect")
      .attr("class", "pod-bar")
      .attr("rx", 2)
      .attr("opacity", 0.92)
      .attr("fill", (d) => podColors[d.key] ?? "#64748b");

    bars
      .merge(barsEnter)
      .on("mousemove", (event, d) => {
        showTip(
          `${d.key} · ${chartData[d.hour]?.label ?? `${String(d.hour).padStart(2, "0")}:00`} · ${d.value.toFixed(1)} CSA`,
          event,
        );
      })
      .on("mouseleave", hideTip)
      .transition()
      .duration(750)
      .ease(d3.easeCubicInOut)
      .attr("fill", (d) => podColors[d.key] ?? "#64748b")
      .attr("x", (d) => {
        if (layout === "stacked") return x0(d.hour) ?? 0;
        return (x0(d.hour) ?? 0) + (x1(d.key) ?? 0);
      })
      .attr("y", (d) => (layout === "stacked" ? y(d.y1) : y(d.value)))
      .attr("height", (d) =>
        layout === "stacked"
          ? Math.max(0, y(d.y0) - y(d.y1))
          : Math.max(0, y(0) - y(d.value)),
      )
      .attr("width", () =>
        layout === "stacked" ? x0.bandwidth() : x1.bandwidth(),
      );

    bars.exit().remove();

    return () => {
      hideTip();
    };
  }, [chartData, colTotals, cubicleCap, layout, podColors, podOrder, size, yMax]);

  const peakHour = useMemo(() => {
    let best = 0;
    let bestH = 0;
    colTotals.forEach((v, h) => {
      if (v > best) {
        best = v;
        bestH = h;
      }
    });
    return { hour: bestH, total: best };
  }, [colTotals]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border bg-muted/30 p-0.5">
          <Button
            type="button"
            variant={layout === "stacked" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setLayout("stacked")}
          >
            Stacked
          </Button>
          <Button
            type="button"
            variant={layout === "grouped" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setLayout("grouped")}
          >
            Grouped
          </Button>
        </div>
        <span className="text-xs text-muted-foreground">
          {layout === "stacked"
            ? "System staffing shape — pod layers sum to hourly total."
            : "Side-by-side pod comparison at each hour."}
        </span>
        {peakHour.total > 0 && (
          <span className="text-xs text-muted-foreground ml-auto num tabular-nums">
            Peak {String(peakHour.hour).padStart(2, "0")}:00 ·{" "}
            {peakHour.total.toFixed(1)} scheduled
          </span>
        )}
      </div>

      <div ref={containerRef} className="relative w-full">
        <svg ref={svgRef} className="w-full" role="img" aria-label="Pod hourly staffing bar chart" />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground border-t pt-3">
        {podOrder.map((name) => (
          <span key={name} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ background: podColors[name] }}
            />
            {name}
            <span className="num tabular-nums">
              ({Object.values(podHourly[name] ?? []).reduce((s, v) => s + v, 0).toFixed(0)} h·agents)
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
