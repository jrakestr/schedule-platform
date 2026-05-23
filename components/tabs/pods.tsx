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
import { GripVertical, RefreshCw, Users } from "lucide-react";
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
import type { Agent, Pod, Snapshot } from "@/lib/data/types";

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
