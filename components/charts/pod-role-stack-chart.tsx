"use client";

import { useMemo, useState } from "react";
import { useQueryState } from "nuqs";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  POD_PALETTE,
  POD_ROLE_KEYS,
  agentPodRoleKey,
  roleColor,
  type PodRoleKey,
} from "@/lib/compute/colors";
import {
  agentIdParam,
  roleFilterKey,
  teamParam,
  teamRoleParam,
} from "@/lib/navigation/panel-params";
import { parseSegs } from "@/lib/compute/supply";
import type { Agent, DOW, Snapshot } from "@/lib/data/types";

const ROLE_DISPLAY: Record<PodRoleKey, string> = {
  "CSA Lead": "CSA Lead",
  "CSA Line": "CSA",
  NDS: "NDS",
  "SDS Lead": "SDS Lead",
  "SDS Line": "SDS",
};

export interface PodRoleStackChartProps {
  snapshot: Snapshot;
  podOrder: string[];
  day: DOW;
}

interface PodRoleRow {
  pod: string;
  podIndex: number;
  total: number;
  supervisor: string;
  [key: string]: string | number;
}

function agentWorksDay(agent: Agent, day: DOW): boolean {
  if (!agent.works_days?.includes(day)) return false;
  if (agent.role === "NDS" || agent.role === "SDS") return true;
  return parseSegs(agent.structure).some((seg) => seg.kind === "Voice");
}

function buildPodRoleRows(
  snapshot: Snapshot,
  podOrder: string[],
  day: DOW,
): { rows: PodRoleRow[]; dayTotal: number; roleTotals: Record<PodRoleKey, number> } {
  const rows: PodRoleRow[] = [];
  let dayTotal = 0;
  const roleTotals = Object.fromEntries(
    POD_ROLE_KEYS.map((k) => [k, 0]),
  ) as Record<PodRoleKey, number>;

  podOrder.forEach((podName, podIndex) => {
    const pod = snapshot.pods[podName];
    if (!pod) return;

    const counts = Object.fromEntries(
      POD_ROLE_KEYS.map((k) => [k, 0]),
    ) as Record<PodRoleKey, number>;

    for (const id of pod.members) {
      const agent = snapshot.agents.find((a) => a.id === id);
      if (!agent || !agentWorksDay(agent, day)) continue;
      const roleKey = agentPodRoleKey(agent);
      if (!roleKey) continue;
      counts[roleKey] += 1;
      roleTotals[roleKey] += 1;
      dayTotal += 1;
    }

    const total = POD_ROLE_KEYS.reduce((sum, key) => sum + counts[key], 0);
    if (total === 0) return;

    rows.push({
      pod: podName,
      podIndex,
      total,
      supervisor: pod.supervisor_id,
      ...counts,
    });
  });

  return { rows, dayTotal, roleTotals };
}

interface TooltipPayloadItem {
  dataKey?: string;
  value?: number;
  color?: string;
  payload?: PodRoleRow;
}

function RoleTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;

  const row = payload[0]?.payload;
  if (!row) return null;

  const hovered = payload.find((p) => Number(p.value) > 0);
  const roleKey = hovered?.dataKey as PodRoleKey | undefined;
  const roleCount = roleKey ? Number(row[roleKey]) : 0;

  if (roleKey && roleCount > 0) {
    return (
      <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
        {label} · {roleCount} {ROLE_DISPLAY[roleKey]}
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      {label} · {row.total} on duty
    </div>
  );
}

export function PodRoleStackChart({
  snapshot,
  podOrder,
  day,
}: PodRoleStackChartProps) {
  const [, setTeam] = useQueryState("team", teamParam);
  const [, setTeamRole] = useQueryState("team_role", teamRoleParam);
  const [, setAgentId] = useQueryState("agent_id", agentIdParam);

  const [hoverPod, setHoverPod] = useState<string | null>(null);
  const [hoverRole, setHoverRole] = useState<PodRoleKey | null>(null);

  const { rows, dayTotal, roleTotals } = useMemo(
    () => buildPodRoleRows(snapshot, podOrder, day),
    [snapshot, podOrder, day],
  );

  const xMax = useMemo(() => {
    const peak = Math.max(1, ...rows.map((r) => r.total));
    return Math.ceil(peak * 1.12);
  }, [rows]);

  const openTeam = (podName: string, roleKey?: PodRoleKey) => {
    setAgentId(null);
    setTeamRole(roleKey ? roleFilterKey(ROLE_DISPLAY[roleKey]) : null);
    setTeam(podName);
  };

  const activeRoles = POD_ROLE_KEYS.filter((key) => roleTotals[key] > 0);

  const chartHeight = Math.max(280, 52 + rows.length * 44);

  if (rows.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        No on-duty members for {day}.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="w-full" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 4, right: 36, left: 4, bottom: 4 }}
            barCategoryGap="22%"
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              stroke="hsl(var(--border))"
            />
            <XAxis
              type="number"
              domain={[0, xMax]}
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={{ stroke: "hsl(var(--border))" }}
            />
            <YAxis
              type="category"
              dataKey="pod"
              width={128}
              tick={({ x, y, payload }) => {
                const podName = String(payload.value);
                const row = rows.find((r) => r.pod === podName);
                const accent = POD_PALETTE[(row?.podIndex ?? 0) % POD_PALETTE.length];
                const dimmed = hoverPod && hoverPod !== podName;
                return (
                  <g transform={`translate(${x},${y})`}>
                    <rect
                      x={-118}
                      y={-8}
                      width={3}
                      height={16}
                      rx={1}
                      fill={accent}
                      opacity={dimmed ? 0.25 : 1}
                    />
                    <text
                      x={-108}
                      y={0}
                      dy={4}
                      textAnchor="start"
                      fill={
                        dimmed
                          ? "hsl(var(--muted-foreground))"
                          : "hsl(var(--foreground))"
                      }
                      fontSize={11}
                      fontWeight={600}
                      style={{ cursor: "pointer" }}
                      onClick={() => openTeam(podName)}
                      onMouseEnter={() => setHoverPod(podName)}
                      onMouseLeave={() => setHoverPod(null)}
                    >
                      {podName.length > 14 ? `${podName.slice(0, 12)}…` : podName}
                    </text>
                  </g>
                );
              }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }}
              content={<RoleTooltip />}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="square"
              iconSize={10}
              wrapperStyle={{ fontSize: 11, paddingBottom: 8 }}
              formatter={(value) => (
                <span className="text-muted-foreground">{String(value)}</span>
              )}
            />
            {activeRoles.map((roleKey, idx) => (
              <Bar
                key={roleKey}
                dataKey={roleKey}
                name={ROLE_DISPLAY[roleKey]}
                stackId="roles"
                radius={
                  idx === activeRoles.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]
                }
                maxBarSize={28}
                onMouseEnter={() => setHoverRole(roleKey)}
                onMouseLeave={() => setHoverRole(null)}
                onClick={(data) => {
                  const row = data.payload as PodRoleRow;
                  if (!row?.pod) return;
                  openTeam(row.pod, roleKey);
                }}
                style={{ cursor: "pointer" }}
              >
                {rows.map((row) => {
                  const count = Number(row[roleKey]) || 0;
                  const podDimmed = hoverPod && hoverPod !== row.pod;
                  const roleDimmed = hoverRole && hoverRole !== roleKey;
                  const opacity =
                    count === 0 ? 0 : podDimmed || roleDimmed ? 0.28 : 0.92;
                  return (
                    <Cell
                      key={`${row.pod}-${roleKey}`}
                      fill={roleColor(roleKey)}
                      opacity={opacity}
                    />
                  );
                })}
                {idx === activeRoles.length - 1 && (
                  <LabelList
                    dataKey="total"
                    position="right"
                    className="fill-muted-foreground"
                    fontSize={10}
                    formatter={(value: number) =>
                      value > 0 ? String(value) : ""
                    }
                  />
                )}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground border-t pt-3">
        {activeRoles.map((roleKey) => (
          <span key={roleKey} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: roleColor(roleKey) }}
            />
            {ROLE_DISPLAY[roleKey]}
            <span className="num tabular-nums">({roleTotals[roleKey]})</span>
          </span>
        ))}
        <span className="w-full sm:w-auto sm:ml-auto num tabular-nums">
          {dayTotal} on duty · {day}
        </span>
      </div>
    </div>
  );
}
