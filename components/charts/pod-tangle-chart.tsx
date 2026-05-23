"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { parseSegs } from "@/lib/compute/supply";
import { POD_PALETTE, roleColor } from "@/lib/compute/colors";
import type { Agent, DOW, Snapshot } from "@/lib/data/types";

const ROLE_ORDER = ["CSA", "CSA Lead", "SDS", "NDS"] as const;
type RoleKey = (typeof ROLE_ORDER)[number];

const ROLE_COLORS: Record<RoleKey, string> = {
  CSA: roleColor("CSA"),
  "CSA Lead": roleColor("CSA Lead"),
  SDS: roleColor("SDS"),
  NDS: roleColor("NDS"),
};

const SUPERVISOR_COLOR = roleColor("Supervisor");

const NODE_RADIUS = 3.5;
const STROKE_WIDTH = 1.5;
const HALO_WIDTH = 4;

const DOW_IDX: Record<DOW, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

export interface PodTangleChartProps {
  snapshot: Snapshot;
  podOrder: string[];
  day: DOW;
}

interface TangleNode {
  id: string;
  parents?: string[] | TangleNode[];
  level?: number;
  x?: number;
  y?: number;
  height?: number;
  bundle?: TangleBundle;
  bundles?: (TangleBundle[] & { i?: number })[];
  bundles_index?: Record<string, TangleBundle[] & { i?: number }>;
}

interface TangleBundle {
  id: string;
  parents: TangleNode[];
  level: number;
  span?: number;
  i?: number;
  x?: number;
  y?: number;
  links?: TangleLink[];
}

interface TangleLink {
  source: TangleNode;
  target: TangleNode;
  bundle: TangleBundle;
  xt?: number;
  yt?: number;
  xb?: number;
  yb?: number;
  xs?: number;
  ys?: number;
  c1?: number;
  c2?: number;
  count?: number;
}

interface TangleLayoutResult {
  nodes: TangleNode[];
  bundles: TangleBundle[];
  links: TangleLink[];
  layout: {
    width: number;
    height: number;
    node_height: number;
    node_width: number;
    bundle_width: number;
    level_y_padding: number;
    metro_d: number;
  };
}

interface RoleFlow {
  nodeId: string;
  pod: string;
  role: RoleKey;
  count: number;
  window: string;
}

interface NodeMeta {
  label: string;
  sublabel?: string;
  color: string;
  levelKind: "supervisor" | "pod" | "role";
  pod?: string;
  role?: RoleKey;
  count?: number;
}

/** Ported from @nitaku/tangled-tree-visualization-ii */
function constructTangleLayout(
  levels: TangleNode[][],
  options: { c?: number; bigc?: number } = {},
): TangleLayoutResult {
  levels.forEach((l, i) => l.forEach((n) => (n.level = i)));

  const nodes = levels.reduce<TangleNode[]>((a, x) => a.concat(x), []);
  const nodesIndex: Record<string, TangleNode> = {};
  nodes.forEach((d) => {
    nodesIndex[d.id] = d;
  });

  nodes.forEach((d) => {
    const parentIds = d.parents as string[] | undefined;
    d.parents = (parentIds === undefined ? [] : parentIds).map(
      (p) => nodesIndex[p as string],
    );
  });

  levels.forEach((l, i) => {
    const index: Record<string, TangleBundle> = {};
    l.forEach((n) => {
      const parents = n.parents as TangleNode[] | undefined;
      if (!parents || parents.length === 0) return;

      const id = parents
        .map((d) => d.id)
        .sort()
        .join("-X-");
      if (id in index) {
        index[id].parents = index[id].parents.concat(parents);
      } else {
        index[id] = {
          id,
          parents: parents.slice(),
          level: i,
          span: i - d3.min(parents, (p) => p.level ?? 0)!,
        };
      }
      n.bundle = index[id];
    });
    const bundles = Object.keys(index).map((k) => index[k]);
    bundles.forEach((b, bi) => (b.i = bi));
    (l as TangleNode[] & { bundles?: TangleBundle[] }).bundles = bundles;
  });

  const links: TangleLink[] = [];
  nodes.forEach((d) => {
    (d.parents as TangleNode[] | undefined)?.forEach((p) =>
      links.push({ source: d, bundle: d.bundle!, target: p }),
    );
  });

  const bundles = levels.reduce<TangleBundle[]>((a, x) => {
    const levelBundles = (x as TangleNode[] & { bundles?: TangleBundle[] })
      .bundles;
    return levelBundles ? a.concat(levelBundles) : a;
  }, []);

  bundles.forEach((b) =>
    b.parents.forEach((p) => {
      if (p.bundles_index === undefined) p.bundles_index = {};
      if (!(b.id in p.bundles_index)) p.bundles_index[b.id] = [];
      p.bundles_index[b.id].push(b);
    }),
  );

  nodes.forEach((n) => {
    if (n.bundles_index !== undefined) {
      n.bundles = Object.keys(n.bundles_index).map((k) => n.bundles_index![k]);
    } else {
      n.bundles_index = {};
      n.bundles = [];
    }
    n.bundles.sort((a, b) =>
      d3.descending(
        d3.max(a, (d) => d.span ?? 0) ?? 0,
        d3.max(b, (d) => d.span ?? 0) ?? 0,
      ),
    );
    n.bundles.forEach((b, i) => {
      (b as TangleBundle[] & { i?: number }).i = i;
    });
  });

  links.forEach((l) => {
    if (l.bundle.links === undefined) l.bundle.links = [];
    l.bundle.links.push(l);
  });

  const padding = 8;
  const node_height = 22;
  const node_width = 70;
  const bundle_width = 14;
  const level_y_padding = 16;
  const metro_d = 4;
  const min_family_height = 22;

  options.c ??= 16;
  const c = options.c;
  options.bigc ??= node_width + c;

  nodes.forEach(
    (n) => (n.height = (Math.max(1, n.bundles?.length ?? 0) - 1) * metro_d),
  );

  let x_offset = padding;
  let y_offset = padding;
  levels.forEach((l) => {
    const levelBundles = (l as TangleNode[] & { bundles?: TangleBundle[] })
      .bundles;
    x_offset += (levelBundles?.length ?? 0) * bundle_width;
    y_offset += level_y_padding;
    l.forEach((n) => {
      n.x = (n.level ?? 0) * node_width + x_offset;
      n.y = node_height + y_offset + (n.height ?? 0) / 2;
      y_offset += node_height + (n.height ?? 0);
    });
  });

  let row = 0;
  levels.forEach((l) => {
    const levelBundles = (l as TangleNode[] & { bundles?: TangleBundle[] })
      .bundles;
    levelBundles?.forEach((b) => {
      b.x =
        d3.max(b.parents, (d) => d.x ?? 0)! +
        node_width +
        ((levelBundles.length ?? 0) - 1 - (b.i ?? 0)) * bundle_width;
      b.y = row * node_height;
    });
    row += l.length;
  });

  links.forEach((l) => {
    const bundleIdx =
      (l.target.bundles_index?.[l.bundle.id] as { i?: number } | undefined)
        ?.i ?? 0;
    const bundleCount = l.target.bundles?.length ?? 0;
    l.xt = l.target.x;
    l.yt =
      (l.target.y ?? 0) +
      bundleIdx * metro_d -
      (bundleCount * metro_d) / 2 +
      metro_d / 2;
    l.xb = l.bundle.x;
    l.yb = l.bundle.y;
    l.xs = l.source.x;
    l.ys = l.source.y;
  });

  let y_negative_offset = 0;
  levels.forEach((l) => {
    const levelBundles = (l as TangleNode[] & { bundles?: TangleBundle[] })
      .bundles;
    y_negative_offset +=
      -min_family_height +
        (d3.min(levelBundles ?? [], (b) =>
          d3.min(b.links ?? [], (link) =>
            (link.ys ?? 0) - 2 * c - ((link.yt ?? 0) + c),
          ),
        ) ?? 0);
    l.forEach((n) => (n.y = (n.y ?? 0) - y_negative_offset));
  });

  links.forEach((l) => {
    const bundleIdx =
      (l.target.bundles_index?.[l.bundle.id] as { i?: number } | undefined)
        ?.i ?? 0;
    const bundleCount = l.target.bundles?.length ?? 0;
    l.yt =
      (l.target.y ?? 0) +
      bundleIdx * metro_d -
      (bundleCount * metro_d) / 2 +
      metro_d / 2;
    l.ys = l.source.y;
    l.c1 =
      (l.source.level ?? 0) - (l.target.level ?? 0) > 1
        ? Math.min(
            options.bigc!,
            (l.xb ?? 0) - (l.xt ?? 0),
            (l.yb ?? 0) - (l.yt ?? 0),
          ) - c
        : c;
    l.c2 = c;
  });

  const layout = {
    width: d3.max(nodes, (n) => n.x ?? 0)! + node_width + 2 * padding,
    height: d3.max(nodes, (n) => n.y ?? 0)! + node_height / 2 + 2 * padding,
    node_height,
    node_width,
    bundle_width,
    level_y_padding,
    metro_d,
  };

  return { nodes, bundles, links, layout };
}

/** Ported from @nitaku/tangled-tree-visualization-ii renderChart cell. */
function bundlePath(links: TangleLink[]): string {
  return links
    .map((l) => {
      const xt = l.xt ?? 0;
      const yt = l.yt ?? 0;
      const xb = l.xb ?? 0;
      const yb = l.yb ?? 0;
      const xs = l.xs ?? 0;
      const ys = l.ys ?? 0;
      const c1 = l.c1 ?? 16;
      const c2 = l.c2 ?? 16;
      return [
        `M${xt} ${yt}`,
        `L${xb - c1} ${yt}`,
        `A${c1} ${c1} 90 0 1 ${xb} ${yt + c1}`,
        `L${xb} ${ys - c2}`,
        `A${c2} ${c2} 90 0 0 ${xb + c2} ${ys}`,
        `L${xs} ${ys}`,
      ].join(" ");
    })
    .join("");
}

function agentWorksDay(agent: Agent, day: DOW): boolean {
  if (!agent.works_days?.includes(day)) return false;
  if (agent.role === "NDS" || agent.role === "SDS") return true;
  return parseSegs(agent.structure).some((seg) => seg.kind === "Voice");
}

function agentRoleKey(agent: Agent): RoleKey | null {
  if (agent.role === "CSA") {
    return agent.position === "Lead" ? "CSA Lead" : "CSA";
  }
  if (agent.role === "SDS") return "SDS";
  if (agent.role === "NDS") return "NDS";
  return null;
}

function roleNodeId(pod: string, role: RoleKey): string {
  return `${pod}::${role}`;
}

function supervisorShiftForDay(
  snapshot: Snapshot,
  supId: string,
  day: DOW,
): string | null {
  const sched = snapshot.supervisor_schedule.supervisors.find(
    (s) => s.id === supId,
  );
  const assignment = sched?.assignments.find(
    (a) => a.weekday_idx === DOW_IDX[day],
  );
  return assignment?.hours ?? null;
}

function supervisorWorksDay(snapshot: Snapshot, supId: string, day: DOW): boolean {
  const agent = snapshot.agents.find((a) => a.id === supId);
  return agent?.works_days?.includes(day) ?? false;
}

function cohortWindow(agents: Agent[]): string {
  if (agents.length === 0) return "off";
  const starts = agents.map((a) => a.start_clock).filter(Boolean);
  const ends = agents.map((a) => a.end_clock).filter(Boolean);
  if (starts.length === 0 || ends.length === 0) return "varies";
  const minStart = starts.sort()[0];
  const maxEnd = ends.sort().reverse()[0];
  if (minStart === maxEnd) return minStart;
  return `${minStart}–${maxEnd}`;
}

function buildLevels(
  snapshot: Snapshot,
  podOrder: string[],
  day: DOW,
): {
  levels: TangleNode[][];
  flows: RoleFlow[];
  nodeMeta: Record<string, NodeMeta>;
  podColors: Record<string, string>;
  dayTotal: number;
} {
  const podColors: Record<string, string> = {};
  podOrder.forEach((name, i) => {
    podColors[name] = POD_PALETTE[i % POD_PALETTE.length];
  });

  const supervisorOrder: string[] = [];
  for (const podName of podOrder) {
    const supId = snapshot.pods[podName]?.supervisor_id;
    if (supId && !supervisorOrder.includes(supId)) {
      supervisorOrder.push(supId);
    }
  }

  const flows: RoleFlow[] = [];
  const roleNodes: TangleNode[] = [];
  const nodeMeta: Record<string, NodeMeta> = {};
  let dayTotal = 0;

  for (const supId of supervisorOrder) {
    const shift = supervisorShiftForDay(snapshot, supId, day);
    const onDuty = supervisorWorksDay(snapshot, supId, day);
    nodeMeta[supId] = {
      label: supId,
      sublabel: onDuty ? (shift ?? undefined) : "OFF",
      color: SUPERVISOR_COLOR,
      levelKind: "supervisor",
    };
  }

  for (const podName of podOrder) {
    const pod = snapshot.pods[podName];
    if (!pod) continue;

    nodeMeta[podName] = {
      label: podName,
      color: podColors[podName],
      levelKind: "pod",
      pod: podName,
    };

    const counts = new Map<RoleKey, Agent[]>();
    for (const id of pod.members) {
      const agent = snapshot.agents.find((a) => a.id === id);
      if (!agent || !agentWorksDay(agent, day)) continue;
      const role = agentRoleKey(agent);
      if (!role) continue;
      dayTotal += 1;
      const bucket = counts.get(role) ?? [];
      bucket.push(agent);
      counts.set(role, bucket);
    }

    for (const role of ROLE_ORDER) {
      const agents = counts.get(role);
      if (!agents?.length) continue;
      const nodeId = roleNodeId(podName, role);
      const window = cohortWindow(agents);
      flows.push({
        nodeId,
        pod: podName,
        role,
        count: agents.length,
        window,
      });
      roleNodes.push({ id: nodeId, parents: [podName] });
      nodeMeta[nodeId] = {
        label: `${role} (${agents.length})`,
        color: ROLE_COLORS[role],
        levelKind: "role",
        pod: podName,
        role,
        count: agents.length,
      };
    }
  }

  const levels: TangleNode[][] = [
    supervisorOrder.map((id) => ({ id })),
    podOrder
      .filter((name) => snapshot.pods[name])
      .map((name) => ({
        id: name,
        parents: [snapshot.pods[name].supervisor_id],
      })),
    roleNodes,
  ];

  return { levels, flows, nodeMeta, podColors, dayTotal };
}

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return raw ? `hsl(${raw})` : fallback;
}

export function PodTangleChart({ snapshot, podOrder, day }: PodTangleChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 480 });

  const model = useMemo(
    () => buildLevels(snapshot, podOrder, day),
    [snapshot, podOrder, day],
  );

  const tangle = useMemo(() => {
    const cloned: TangleNode[][] = model.levels.map((level) =>
      level.map((n) => ({
        id: n.id,
        parents: n.parents
          ? [...(n.parents as string[])].filter(
              (p): p is string => typeof p === "string",
            )
          : undefined,
      })),
    );
    return constructTangleLayout(cloned);
  }, [model.levels]);

  const chartHeight = useMemo(() => {
    return Math.max(380, Math.min(780, tangle.layout.height + 72));
  }, [tangle.layout.height]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 800;
      setSize({ width: Math.max(320, w), height: chartHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [chartHeight]);

  useEffect(() => {
    setSize((prev) => ({ ...prev, height: chartHeight }));
  }, [chartHeight]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    if (!svgRef.current) return;

    const margin = { top: 28, right: 120, bottom: 20, left: 88 };
    const width = size.width;
    const height = size.height;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const muted = cssVar("--muted-foreground", "#64748b");
    const foreground = cssVar("--foreground", "#0f172a");
    const card = cssVar("--card", "#ffffff");

    const scale = Math.min(
      innerW / tangle.layout.width,
      innerH / tangle.layout.height,
    );
    const offsetX =
      margin.left + (innerW - tangle.layout.width * scale) / 2;
    const offsetY =
      margin.top + (innerH - tangle.layout.height * scale) / 2;

    const flowByNode = new Map(model.flows.map((f) => [f.nodeId, f]));
    for (const link of tangle.links) {
      link.count = flowByNode.get(link.source.id)?.count ?? 0;
    }

    const bundleColor = (b: TangleBundle) => {
      const source = b.links?.[0]?.source;
      if (!source) return "#64748b";
      const meta = model.nodeMeta[source.id];
      if (meta?.levelKind === "role" && meta.role) {
        return ROLE_COLORS[meta.role];
      }
      if (meta?.levelKind === "pod") {
        return model.podColors[source.id] ?? "#64748b";
      }
      return model.podColors[source.id] ?? "#64748b";
    };

    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const root = svg.append("g");
    const g = root
      .append("g")
      .attr("transform", `translate(${offsetX},${offsetY}) scale(${scale})`);

    const tooltip = d3
      .select(containerRef.current)
      .selectAll<HTMLDivElement, null>(".pod-tangle-tooltip")
      .data([null])
      .join("div")
      .attr(
        "class",
        "pod-tangle-tooltip pointer-events-none absolute z-20 hidden rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md",
      );

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

    type Highlight = {
      supervisor: string | null;
      pod: string | null;
      roleNode: string | null;
    };

    const setHighlight = (next: Highlight) => {
      const active =
        next.supervisor ?? next.pod ?? next.roleNode ?? null;
      const linkHit = (l: TangleLink) => {
        if (!active) return true;
        if (next.roleNode) {
          return l.source.id === next.roleNode || l.target.id === next.pod;
        }
        if (next.pod) {
          return (
            l.source.id === next.pod ||
            l.target.id === next.pod ||
            l.source.id.startsWith(`${next.pod}::`) ||
            model.nodeMeta[l.target.id]?.pod === next.pod
          );
        }
        if (next.supervisor) {
          const ownedPods = podOrder.filter(
            (p) => snapshot.pods[p]?.supervisor_id === next.supervisor,
          );
          return (
            l.target.id === next.supervisor ||
            ownedPods.includes(l.source.id) ||
            ownedPods.some((p) => l.source.id.startsWith(`${p}::`)) ||
            (l.source.level === 1 && ownedPods.includes(l.source.id))
          );
        }
        return false;
      };

      g.selectAll<SVGPathElement, TangleBundle>(".pod-tangle-link-halo").attr(
        "opacity",
        (b) => {
          if (!active) return 1;
          return b.links?.some(linkHit) ? 1 : 0.1;
        },
      );
      g.selectAll<SVGPathElement, TangleBundle>(".pod-tangle-link").attr(
        "opacity",
        (b) => {
          if (!active) return 0.9;
          return b.links?.some(linkHit) ? 1 : 0.12;
        },
      );
      g.selectAll<SVGCircleElement, TangleNode>(".pod-tangle-node").attr(
        "opacity",
        (d) => {
          if (!active) return 1;
          if (next.roleNode) {
            return d.id === next.roleNode ||
              d.id === model.nodeMeta[next.roleNode]?.pod
              ? 1
              : 0.3;
          }
          if (next.pod) {
            return d.id === next.pod ||
              d.id.startsWith(`${next.pod}::`) ||
              snapshot.pods[next.pod]?.supervisor_id === d.id
              ? 1
              : 0.3;
          }
          if (next.supervisor) {
            const ownedPods = podOrder.filter(
              (p) => snapshot.pods[p]?.supervisor_id === next.supervisor,
            );
            return d.id === next.supervisor ||
              ownedPods.includes(d.id) ||
              ownedPods.some((p) => d.id.startsWith(`${p}::`))
              ? 1
              : 0.3;
          }
          return 0.3;
        },
      );
    };

    const linkLayer = g.append("g").attr("class", "pod-tangle-links");

    linkLayer
      .selectAll<SVGPathElement, TangleBundle>(".pod-tangle-link-halo")
      .data(tangle.bundles.filter((b) => (b.links?.length ?? 0) > 0))
      .join("path")
      .attr("class", "pod-tangle-link-halo")
      .attr("fill", "none")
      .attr("stroke", card)
      .attr("stroke-width", HALO_WIDTH / scale)
      .attr("stroke-linecap", "round")
      .attr("d", (b) => bundlePath(b.links ?? []));

    linkLayer
      .selectAll<SVGPathElement, TangleBundle>(".pod-tangle-link")
      .data(tangle.bundles.filter((b) => (b.links?.length ?? 0) > 0))
      .join("path")
      .attr("class", "pod-tangle-link")
      .attr("fill", "none")
      .attr("stroke", (b) => bundleColor(b))
      .attr("stroke-width", STROKE_WIDTH / scale)
      .attr("stroke-linecap", "round")
      .attr("opacity", 0.9)
      .attr("d", (b) => bundlePath(b.links ?? []))
      .style("cursor", "pointer")
      .on("mousemove", (event, b) => {
        const first = b.links?.[0];
        if (!first) return;
        const flow = flowByNode.get(first.source.id);
        if (flow) {
          setHighlight({ supervisor: null, pod: flow.pod, roleNode: flow.nodeId });
          showTip(
            `<div class="font-semibold">${flow.pod} · ${flow.role} ×${flow.count}</div>` +
              `<div class="text-muted-foreground">${flow.window}</div>`,
            event,
          );
          return;
        }
        const podName = first.source.level === 1 ? first.source.id : undefined;
        if (podName) {
          setHighlight({ supervisor: null, pod: podName, roleNode: null });
          showTip(
            `<div class="font-semibold">${podName}</div>` +
              `<div class="text-muted-foreground">${snapshot.pods[podName]?.supervisor_id ?? ""}</div>`,
            event,
          );
        }
      })
      .on("mouseleave", () => {
        setHighlight({ supervisor: null, pod: null, roleNode: null });
        hideTip();
      });

    g.selectAll<SVGCircleElement, TangleNode>(".pod-tangle-node")
      .data(tangle.nodes, (d) => d.id)
      .join("circle")
      .attr("class", "pod-tangle-node")
      .attr("cx", (d) => d.x ?? 0)
      .attr("cy", (d) => d.y ?? 0)
      .attr("r", NODE_RADIUS / scale)
      .attr("fill", (d) => model.nodeMeta[d.id]?.color ?? "#64748b")
      .attr("stroke", card)
      .attr("stroke-width", 1.25 / scale)
      .style("cursor", "pointer")
      .on("mouseenter", (_event, d) => {
        const meta = model.nodeMeta[d.id];
        if (meta?.levelKind === "supervisor") {
          setHighlight({ supervisor: d.id, pod: null, roleNode: null });
        } else if (meta?.levelKind === "pod") {
          setHighlight({ supervisor: null, pod: d.id, roleNode: null });
        } else if (meta?.levelKind === "role") {
          setHighlight({
            supervisor: null,
            pod: meta.pod ?? null,
            roleNode: d.id,
          });
        }
      })
      .on("mousemove", (event, d) => {
        const meta = model.nodeMeta[d.id];
        if (!meta) return;
        if (meta.levelKind === "role") {
          const flow = flowByNode.get(d.id);
          if (!flow) return;
          showTip(
            `<div class="font-semibold">${flow.pod} · ${flow.role} ×${flow.count}</div>` +
              `<div class="text-muted-foreground">${flow.window}</div>`,
            event,
          );
          return;
        }
        if (meta.levelKind === "pod") {
          const sup = snapshot.pods[d.id]?.supervisor_id;
          showTip(
            `<div class="font-semibold">${d.id}</div>` +
              `<div class="text-muted-foreground">${sup ?? ""}</div>`,
            event,
          );
          return;
        }
        showTip(
          `<div class="font-semibold">${meta.label}</div>` +
            (meta.sublabel
              ? `<div class="text-muted-foreground">${meta.sublabel}</div>`
              : ""),
          event,
        );
      })
      .on("mouseleave", () => {
        setHighlight({ supervisor: null, pod: null, roleNode: null });
        hideTip();
      });

    const labelFor = (d: TangleNode) => model.nodeMeta[d.id]?.label ?? d.id;

    tangle.nodes.forEach((n) => {
      const meta = model.nodeMeta[n.id];
      if (!meta) return;
      const level = n.level ?? 0;
      const x = n.x ?? 0;
      const y = n.y ?? 0;

      if (level === 0) {
        g.append("text")
          .attr("x", x - 8)
          .attr("y", y)
          .attr("text-anchor", "end")
          .attr("dominant-baseline", "middle")
          .attr("fill", foreground)
          .attr("font-size", 10)
          .attr("font-weight", 600)
          .text(meta.label);
        if (meta.sublabel) {
          g.append("text")
            .attr("x", x - 8)
            .attr("y", y + 11)
            .attr("text-anchor", "end")
            .attr("fill", muted)
            .attr("font-size", 8)
            .text(meta.sublabel);
        }
        return;
      }

      if (level === 1) {
        g.append("text")
          .attr("x", x)
          .attr("y", y - 10)
          .attr("text-anchor", "middle")
          .attr("fill", foreground)
          .attr("font-size", 9)
          .attr("font-weight", 600)
          .text(
            meta.label.length > 16
              ? `${meta.label.slice(0, 14)}…`
              : meta.label,
          );
        return;
      }

      g.append("text")
        .attr("x", x + 8)
        .attr("y", y)
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "middle")
        .attr("fill", foreground)
        .attr("font-size", 9)
        .attr("font-weight", 500)
        .text(labelFor(n));
    });

    const colXs = [0, 1, 2].map((lvl) => {
      const nodesAtLevel = tangle.nodes.filter((n) => n.level === lvl);
      const avg =
        nodesAtLevel.reduce((s, n) => s + (n.x ?? 0), 0) /
        Math.max(1, nodesAtLevel.length);
      return offsetX + avg * scale;
    });

    const headers = ["Supervisors", "Pods", "Roles"];
    headers.forEach((text, i) => {
      root
        .append("text")
        .attr("x", colXs[i])
        .attr("y", margin.top - 10)
        .attr("text-anchor", i === 0 ? "start" : i === 2 ? "end" : "middle")
        .attr("fill", muted)
        .attr("font-size", 10)
        .attr("font-weight", 600)
        .text(text);
    });

    return () => {
      hideTip();
    };
  }, [day, model, podOrder, size, snapshot.pods, tangle]);

  const activeRoles = ROLE_ORDER.filter((role) =>
    model.flows.some((f) => f.role === role),
  );

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="relative w-full">
        <svg
          ref={svgRef}
          className="w-full"
          role="img"
          aria-label={`Team structure tangle for ${day}`}
        />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground border-t pt-3">
        {activeRoles.map((role) => (
          <span key={role} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ background: ROLE_COLORS[role] }}
            />
            {role}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ background: SUPERVISOR_COLOR }}
          />
          Supervisor
        </span>
        <span className="w-full sm:w-auto sm:ml-auto num tabular-nums">
          {model.dayTotal} on duty · {day}
        </span>
      </div>
    </div>
  );
}
