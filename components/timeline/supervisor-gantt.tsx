"use client";

import { parseSegs } from "@/lib/compute/supply";
import { shiftColorForAgent } from "@/lib/compute/colors";
import { shiftLengthLabel } from "@/lib/compute/agent-context";
import type { Agent, DOW, Pod, Snapshot } from "@/lib/data/types";

interface SupervisorGanttProps {
  snapshot: Snapshot;
  day: DOW;
  podNames: string[];
  callVolumeHour: number[];
  scheduledHour: number[];
}

export function SupervisorGantt({
  snapshot,
  day,
  podNames,
  callVolumeHour,
  scheduledHour,
}: SupervisorGanttProps) {
  const LABEL_W = 150;
  const HOUR_W = 40;
  const TOP_PAD = 24;
  const RIBBON_H = 9;
  const RIBBON_GAP = 2;
  const POD_HEAD = 26;
  const POD_GAP = 10;
  const PANEL_H = 130;

  const lanes = podNames.map((name) => {
    const pod = snapshot.pods[name];
    const agents = pod.members
      .map((id) => snapshot.agents.find((a) => a.id === id))
      .filter((a): a is Agent => !!a && (a.works_days?.includes(day) ?? false));
    return { name, pod, agents };
  });

  let cursor = TOP_PAD;
  const podYs: Record<string, number> = {};
  for (const lane of lanes) {
    podYs[lane.name] = cursor;
    cursor +=
      POD_HEAD +
      Math.max(1, lane.agents.length) * (RIBBON_H + RIBBON_GAP) +
      POD_GAP;
  }
  const lanesEnd = cursor;
  const totalH = lanesEnd + PANEL_H + 12;
  const totalW = LABEL_W + 24 * HOUR_W + 24;

  const timeX = (min: number): number => LABEL_W + (min / 60) * HOUR_W;
  const callTotal = callVolumeHour.reduce((s, v) => s + v, 0) || 1;
  const staffTotal = scheduledHour.reduce((s, v) => s + v, 0) || 1;
  const callShare = callVolumeHour.map((v) => (v / callTotal) * 100);
  const staffShare = scheduledHour.map((v) => (v / staffTotal) * 100);
  const yMax = Math.max(...callShare, ...staffShare, 1);
  const yScaled = Math.ceil(yMax * 10) / 10;
  const panelTop = lanesEnd + 26;
  const panelBot = panelTop + (PANEL_H - 26);
  const panelH = panelBot - panelTop;
  const yScale = (v: number): number => panelBot - (v / yScaled) * panelH;

  return (
    <div className="overflow-x-auto border rounded-md bg-card">
      <svg
        width={totalW}
        height={totalH}
        viewBox={`0 0 ${totalW} ${totalH}`}
        style={{ minWidth: `${totalW}px` }}
      >
        {Array.from({ length: 25 }, (_, h) => {
          const x = LABEL_W + h * HOUR_W;
          return (
            <g key={`grid-${h}`}>
              <line
                x1={x}
                y1={TOP_PAD - 6}
                x2={x}
                y2={lanesEnd - POD_GAP}
                stroke={h % 6 === 0 ? "#cbd5e1" : "#eef2f7"}
                strokeWidth={h % 6 === 0 ? 1 : 0.5}
              />
              {h < 24 && (
                <text
                  x={x + 4}
                  y={TOP_PAD - 8}
                  fontSize={10}
                  fontFamily="ui-monospace, Menlo, monospace"
                  fill="#64748b"
                >
                  {String(h).padStart(2, "0")}
                </text>
              )}
            </g>
          );
        })}

        {lanes.map((lane) => {
          const py = podYs[lane.name];
          const laneH =
            POD_HEAD +
            Math.max(1, lane.agents.length) * (RIBBON_H + RIBBON_GAP);
          return (
            <g key={`lane-${lane.name}`}>
              <rect
                x={0}
                y={py}
                width={totalW}
                height={laneH}
                fill="#f8fafc"
              />
              <rect
                x={0}
                y={py}
                width={LABEL_W}
                height={laneH}
                fill="#ffffff"
                stroke="#e5e7eb"
                strokeWidth={0.5}
              />
              <text
                x={10}
                y={py + 16}
                fontSize={12}
                fontWeight={600}
                fill="#0f172a"
              >
                {lane.name}
              </text>
              <text
                x={10}
                y={py + 30}
                fontSize={9}
                fontFamily="ui-monospace, Menlo, monospace"
                fill="#64748b"
              >
                {`${lane.pod.supervisor_id} · ${lane.agents.length} on duty`}
              </text>
              {lane.agents.length === 0 ? (
                <text
                  x={LABEL_W + 8}
                  y={py + POD_HEAD + RIBBON_H}
                  fontSize={10}
                  fill="#94a3b8"
                >
                  No coverage scheduled for {day}
                </text>
              ) : (
                lane.agents.map((agent, idx) => {
                  const ry = py + POD_HEAD + idx * (RIBBON_H + RIBBON_GAP);
                  const color = shiftColorForAgent(agent);
                  const segs = parseSegs(agent.structure).filter(
                    (s) => s.kind === "Voice",
                  );
                  return (
                    <g key={`agent-${agent.id}-${idx}`}>
                      {segs.map((seg, sIdx) => {
                        const ribbons: React.ReactElement[] = [];
                        if (seg.end > 24 * 60) {
                          const x1 = timeX(seg.start);
                          const x2 = timeX(24 * 60);
                          ribbons.push(
                            <rect
                              key={`seg-${sIdx}-a`}
                              x={x1}
                              y={ry}
                              width={Math.max(2, x2 - x1)}
                              height={RIBBON_H}
                              rx={2}
                              fill={color}
                              opacity={0.9}
                            >
                              <title>{`${agent.id} · ${shiftLengthLabel(agent) ?? agent.shift_id} ${agent.start_clock}-${agent.end_clock} · ${agent.role} ${agent.position}`}</title>
                            </rect>,
                          );
                          const wx1 = timeX(0);
                          const wx2 = timeX(seg.end - 24 * 60);
                          ribbons.push(
                            <rect
                              key={`seg-${sIdx}-b`}
                              x={wx1}
                              y={ry}
                              width={Math.max(2, wx2 - wx1)}
                              height={RIBBON_H}
                              rx={2}
                              fill={color}
                              opacity={0.9}
                            >
                              <title>{`${agent.id} (continues) · ${shiftLengthLabel(agent) ?? agent.shift_id}`}</title>
                            </rect>,
                          );
                        } else {
                          const x1 = timeX(seg.start);
                          const x2 = timeX(seg.end);
                          ribbons.push(
                            <rect
                              key={`seg-${sIdx}`}
                              x={x1}
                              y={ry}
                              width={Math.max(2, x2 - x1)}
                              height={RIBBON_H}
                              rx={2}
                              fill={color}
                              opacity={0.9}
                            >
                              <title>{`${agent.id} · ${shiftLengthLabel(agent) ?? agent.shift_id} ${agent.start_clock}-${agent.end_clock} · ${agent.role} ${agent.position}`}</title>
                            </rect>,
                          );
                        }
                        return ribbons;
                      })}
                      <text
                        x={LABEL_W - 6}
                        y={ry + RIBBON_H - 1}
                        fontSize={9}
                        fontFamily="ui-monospace, Menlo, monospace"
                        fill="#475569"
                        textAnchor="end"
                      >
                        {agent.id}
                      </text>
                    </g>
                  );
                })
              )}
            </g>
          );
        })}

        <text
          x={10}
          y={lanesEnd + 16}
          fontSize={12}
          fontWeight={600}
          fill="#0f172a"
        >
          Call volume shape vs scheduled staff shape (% of day)
        </text>
        <line
          x1={LABEL_W}
          y1={panelBot}
          x2={LABEL_W + 24 * HOUR_W}
          y2={panelBot}
          stroke="#cbd5e1"
        />

        {Array.from({ length: 24 }, (_, h) => {
          const x = LABEL_W + h * HOUR_W;
          const csY = yScale(callShare[h]);
          const ssY = yScale(staffShare[h]);
          return (
            <g key={`panel-${h}`}>
              <rect
                x={x + 2}
                y={csY}
                width={HOUR_W - 4}
                height={Math.max(0, panelBot - csY)}
                fill="#94a3b8"
                opacity={0.3}
              />
              <rect
                x={x + 2 + (HOUR_W - 4) / 4}
                y={ssY}
                width={(HOUR_W - 4) / 2}
                height={Math.max(0, panelBot - ssY)}
                fill="#4f46e5"
                opacity={0.65}
              />
              {h % 3 === 0 && (
                <text
                  x={x + HOUR_W / 2}
                  y={panelBot + 12}
                  fontSize={9}
                  fontFamily="ui-monospace, Menlo, monospace"
                  textAnchor="middle"
                  fill="#64748b"
                >
                  {String(h).padStart(2, "0")}
                </text>
              )}
            </g>
          );
        })}

        {Array.from({ length: 5 }, (_, k) => {
          const v = (yScaled * k) / 4;
          const y = yScale(v);
          return (
            <g key={`yt-${k}`}>
              <line
                x1={LABEL_W - 4}
                y1={y}
                x2={LABEL_W}
                y2={y}
                stroke="#cbd5e1"
              />
              <text
                x={LABEL_W - 6}
                y={y + 3}
                fontSize={9}
                textAnchor="end"
                fill="#64748b"
              >
                {v.toFixed(1)}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
