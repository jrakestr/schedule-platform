"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, RefreshCw, Users, ShieldAlert } from "lucide-react";
import { SectionCard } from "@/components/shared/section-card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { shiftColor } from "@/lib/compute/colors";
import type { Agent, Pod, Snapshot, DOW } from "@/lib/data/types";
import { agentSupply } from "@/lib/compute/supply";
import { DayTabs } from "@/components/shared/day-tabs";

interface PodsTabProps {
  snapshot: Snapshot;
}

const STORAGE_KEY = "schedule-platform.pod-order";

export function PodsTab({ snapshot }: PodsTabProps) {
  const canonicalOrder = useMemo(() => Object.keys(snapshot.pods), [snapshot.pods]);
  const [order, setOrder] = useState<string[]>(canonicalOrder);

  useEffect(() => {
    try {
      const raw =
        typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (!raw) return;
      const parsed = JSON.parse(raw) as string[];
      if (
        Array.isArray(parsed) &&
        parsed.length === canonicalOrder.length &&
        parsed.every((p) => canonicalOrder.includes(p))
      ) {
        setOrder(parsed);
      }
    } catch {
      // ignore
    }
  }, [canonicalOrder]);

  const persist = (next: string[]) => {
    setOrder(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = order.indexOf(String(active.id));
    const newIdx = order.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    persist(arrayMove(order, oldIdx, newIdx));
  };

  const reset = () => persist(canonicalOrder);
  const isReordered =
    order.join("|") !== canonicalOrder.join("|");

  return (
    <div className="space-y-5">
      <SectionCard
        title="Why pods?"
        description="Each pod has one assigned supervisor. Pod windows show the earliest start and latest end among members, so leaders can see the span they own."
        bgImage="/28.jpg"
        bgImageOpacity={0.06}
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          Drag the handle to re-order pods. Order is saved locally in this
          browser and never written back to the database.
          {isReordered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              className="ml-auto text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Reset to canonical order
            </Button>
          )}
        </div>
      </SectionCard>

      <PodHourGapMatrix snapshot={snapshot} order={order} />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={order} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {order.map((name) => (
              <PodCard
                key={name}
                name={name}
                pod={snapshot.pods[name]}
                agents={snapshot.pods[name].members
                  .map((id) => snapshot.agents.find((a) => a.id === id))
                  .filter((a): a is Agent => !!a)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function PodCard({
  name,
  pod,
  agents,
}: {
  name: string;
  pod: Pod;
  agents: Agent[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: name });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const csaCount = agents.filter((a) => a.role === "CSA").length;
  const ndsCount = agents.filter((a) => a.role === "NDS").length;
  const sdsCount = agents.filter((a) => a.role === "SDS").length;
  const leadCount = agents.filter((a) => a.position === "Lead").length;

  return (
    <Card ref={setNodeRef} style={style} className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{name}</CardTitle>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground cursor-grab touch-none"
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${name}`}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </div>
        <div className="text-xs text-muted-foreground">
          {pod.type} · Supervisor:{" "}
          <span className="font-mono text-foreground">{pod.supervisor_id}</span>
          {pod.lead_id !== "Coached by Supervisor" && (
            <>
              {" "}
              · Lead:{" "}
              <span className="font-mono text-foreground">{pod.lead_id}</span>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Badge variant="secondary">
            {agents.length} {agents.length === 1 ? "member" : "members"}
          </Badge>
          {csaCount > 0 && <Badge variant="success">{csaCount} CSA</Badge>}
          {ndsCount > 0 && <Badge variant="info">{ndsCount} NDS</Badge>}
          {sdsCount > 0 && (
            <Badge
              variant="outline"
              className="text-violet-700 border-violet-200 dark:text-violet-300 dark:border-violet-800"
            >
              {sdsCount} SDS
            </Badge>
          )}
          {leadCount > 0 && (
            <Badge variant="warning">{leadCount} Lead</Badge>
          )}
        </div>
        <div className="text-xs font-medium pt-1">
          Coverage window:{" "}
          <span className="font-mono">{pod.coverage_window || "varies"}</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Accordion type="single" collapsible defaultValue="members">
          <AccordionItem value="members" className="border-b-0">
            <AccordionTrigger className="text-xs uppercase tracking-wider text-muted-foreground py-2">
              Members
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-1 text-sm">
                {agents.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-2 py-1"
                  >
                    <span className="font-mono text-xs">{m.id}</span>
                    <span className="flex items-center gap-1.5 text-xs">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-sm"
                        style={{ background: shiftColor(m.shift_id) }}
                      />
                      {m.role} {m.position}
                    </span>
                    <span className="num text-xs text-muted-foreground tabular-nums">
                      {m.start_clock}–{m.end_clock}
                    </span>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}

function PodHourGapMatrix({
  snapshot,
  order,
}: {
  snapshot: Snapshot;
  order: string[];
}) {
  const [day, setDay] = useState<DOW>("Mon");

  const matrixData = useMemo(() => {
    const podHourly: Record<string, number[]> = {};
    for (const podName of order) {
      const pod = snapshot.pods[podName];
      if (!pod) continue;
      const members = pod.members
        .map((id) => snapshot.agents.find((a) => a.id === id))
        .filter((a): a is Agent => !!a);
      const supply = agentSupply(members, day, 1.0);
      podHourly[podName] = Array.from({ length: 24 }, (_, h) =>
        Number(((supply[h * 2] + supply[h * 2 + 1]) / 2).toFixed(2))
      );
    }

    const systemRequiredCombined = Array.from({ length: 24 }, (_, h) => {
      const req = snapshot.volume.required_on_phones.Combined[day] || [];
      return ((req[h * 2] || 0) + (req[h * 2 + 1] || 0)) / 2;
    });

    return {
      podHourly,
      systemRequiredCombined,
    };
  }, [snapshot, day, order]);

  function getGapCellClass(gap: number): string {
    if (gap === 0) {
      return "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-150 dark:border-emerald-900/40 font-medium";
    } else if (gap < 0) {
      const val = Math.abs(gap);
      if (val >= 1.5) {
        return "bg-rose-950/90 text-rose-200 border border-rose-800 font-bold";
      } else if (val >= 0.5) {
        return "bg-rose-900/50 text-rose-200 border border-rose-900/60 font-medium";
      } else {
        return "bg-rose-900/20 text-rose-300 border border-rose-900/30";
      }
    } else {
      if (gap >= 1.5) {
        return "bg-blue-950/90 text-blue-200 border border-blue-800 font-bold";
      } else if (gap >= 0.5) {
        return "bg-blue-900/50 text-blue-200 border border-blue-900/60 font-medium";
      } else {
        return "bg-blue-900/20 text-blue-300 border border-blue-900/30";
      }
    }
  }

  return (
    <SectionCard
      title="Pod x Hour Staffing Gap Matrix"
      description="Compare pod schedule coverage against their 1/6 share of system Erlang required. Dynamic gradient shows: Deep Red (Under), Sage Green (Optimal), Deep Blue (Over)."
      toolbar={<DayTabs day={day} onChange={setDay} />}
    >
      <div className="overflow-x-auto">
        <table className="text-xs border-separate border-spacing-px min-w-full font-sans">
          <thead>
            <tr>
              <th className="text-left p-2 sticky left-0 bg-card font-semibold text-muted-foreground border-b min-w-[140px]">Pod</th>
              {snapshot.meta.hours.map((h) => (
                <th
                  key={h}
                  className="p-1.5 text-center text-[10px] text-muted-foreground font-mono border-b w-8"
                >
                  {h.slice(0, 2)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {order.map((podName) => {
              const hourly = matrixData.podHourly[podName] || new Array(24).fill(0);
              return (
                <tr key={podName} className="hover:bg-muted/30">
                  <td className="p-2 sticky left-0 bg-card border-r font-medium text-foreground text-xs">
                    {podName}
                  </td>
                  {hourly.map((val, h) => {
                    const reqShare = matrixData.systemRequiredCombined[h] / 6;
                    const gap = val - reqShare;
                    return (
                      <td
                        key={h}
                        className={`p-1.5 text-center num text-[10px] rounded-sm tabular-nums ${getGapCellClass(gap)}`}
                        title={`${podName} Hour ${h.toString().padStart(2, "0")}:00 | Supply: ${val.toFixed(1)} | Share: ${reqShare.toFixed(1)} | Gap: ${gap.toFixed(1)}`}
                      >
                        {gap > 0 ? `+${gap.toFixed(1)}` : gap < 0 ? gap.toFixed(1) : "0.0"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground mt-3 pt-2 border-t border-border">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3.5 h-3.5 bg-rose-950/90 border border-rose-800 rounded-sm" />
          Severe Under (&lt; -1.5)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3.5 h-3.5 bg-rose-900/50 border border-rose-900/60 rounded-sm" />
          Mild Under (-1.5 to -0.5)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3.5 h-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-150 dark:border-emerald-900/40 rounded-sm" />
          Optimal Coverage (0.0)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3.5 h-3.5 bg-blue-900/50 border border-blue-900/60 rounded-sm" />
          Mild Over (0.5 to 1.5)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3.5 h-3.5 bg-blue-950/90 border border-blue-800 rounded-sm" />
          Severe Over (&gt; 1.5)
        </span>
      </div>
    </SectionCard>
  );
}
