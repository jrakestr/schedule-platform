"use client";

import { useMemo } from "react";
import { useQueryState, parseAsString } from "nuqs";
import { ArrowLeft, Clock, MapPin, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AgentLink } from "@/components/agent/agent-link";
import {
  agentOperationalRole,
  roleBadgeClass,
  shiftColor,
} from "@/lib/compute/colors";
import {
  agentDisplayName,
  agentPodInfo,
} from "@/lib/compute/agent-context";
import { rosterRowsFor } from "@/lib/compute/roster";
import { DOW_LIST, type Snapshot } from "@/lib/data/types";
import { cn } from "@/lib/utils";

interface AgentProfilePanelProps {
  snapshot: Snapshot;
}

export function AgentProfilePanel({ snapshot }: AgentProfilePanelProps) {
  const [agentId, setAgentId] = useQueryState("agent_id", parseAsString);

  const agent = useMemo(
    () => snapshot.agents.find((a) => a.id === agentId) ?? null,
    [snapshot.agents, agentId],
  );

  const podInfo = useMemo(
    () => (agentId ? agentPodInfo(agentId, snapshot.pods) : null),
    [agentId, snapshot.pods],
  );

  const scheduleRows = useMemo(
    () =>
      agent
        ? rosterRowsFor(agent, snapshot.pods, snapshot.supervisor_schedule)
        : [],
    [agent, snapshot.pods, snapshot.supervisor_schedule],
  );

  const shiftEntry = useMemo(
    () =>
      agent
        ? snapshot.shift_catalog.find((s) => s.shift_id === agent.shift_id)
        : undefined,
    [agent, snapshot.shift_catalog],
  );

  const open = Boolean(agentId);

  const close = () => setAgentId(null);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent
        className={cn(
          "fixed inset-y-0 right-0 left-auto top-0 h-full w-full max-w-md",
          "translate-x-0 translate-y-0 rounded-none border-l sm:rounded-l-lg sm:max-h-full",
          "overflow-y-auto p-0 gap-0",
        )}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {!agent ? (
          <div className="p-6 space-y-4">
            <DialogHeader>
              <DialogTitle>Agent not found</DialogTitle>
              <DialogDescription>
                {agentId
                  ? `No roster entry matches ${agentId} in this snapshot.`
                  : "Select an agent ID to view their profile."}
              </DialogDescription>
            </DialogHeader>
            <Button variant="outline" size="sm" onClick={close}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back
            </Button>
          </div>
        ) : (
          <>
            <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur px-5 py-4">
              <div className="flex items-start gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 mt-0.5"
                  onClick={close}
                  aria-label="Close profile"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0 flex-1">
                  <DialogHeader className="space-y-1 text-left">
                    <DialogTitle className="text-base leading-snug">
                      {agentDisplayName(agent)}
                    </DialogTitle>
                    <DialogDescription className="font-mono text-xs">
                      {agent.id}
                    </DialogDescription>
                  </DialogHeader>
                  {(() => {
                    const label = agentOperationalRole(agent);
                    return label ? (
                      <Badge
                        variant="outline"
                        className={cn("mt-2 text-[10px]", roleBadgeClass(label))}
                      >
                        {label}
                      </Badge>
                    ) : null;
                  })()}
                </div>
              </div>
            </div>

            <div className="px-5 py-4 space-y-5">
              <ProfileSection title="Team">
                <ProfileRow label="Pod" value={podInfo?.podName ?? "—"} />
                <ProfileRow
                  label="Supervisor"
                  value={
                    podInfo && agent.role !== "Supervisor" ? (
                      <AgentLink agentId={podInfo.supervisorId} />
                    ) : agent.role === "Supervisor" ? (
                      "Operations"
                    ) : (
                      "—"
                    )
                  }
                />
                {podInfo?.leadId && podInfo.leadId !== agent.id && (
                  <ProfileRow
                    label="Team lead"
                    value={<AgentLink agentId={podInfo.leadId} />}
                  />
                )}
                {podInfo?.pod.coverage_window && (
                  <ProfileRow
                    label="Coverage window"
                    value={
                      <span className="font-mono text-xs">
                        {podInfo.pod.coverage_window}
                      </span>
                    }
                  />
                )}
              </ProfileSection>

              <Separator />

              <ProfileSection title="Shift template">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ background: shiftColor(agent.shift_id) }}
                  />
                  <span className="font-mono text-sm font-medium">
                    {agent.shift_id}
                  </span>
                  {shiftEntry?.label && (
                    <span className="text-xs text-muted-foreground">
                      {shiftEntry.label}
                    </span>
                  )}
                </div>
                <ProfileRow
                  label="Hours"
                  value={
                    <span className="font-mono text-xs">
                      {agent.start_clock} – {agent.end_clock}
                    </span>
                  }
                />
                <ProfileRow
                  label="Shift class"
                  value={agent.shift_class}
                />
                {agent.off_pair && (
                  <ProfileRow label="Off pair" value={agent.off_pair} />
                )}
                {typeof agent.effective_hours_per_week === "number" && (
                  <ProfileRow
                    label="Effective hours / week"
                    value={
                      <span className="num tabular-nums">
                        {agent.effective_hours_per_week.toFixed(1)}
                      </span>
                    }
                  />
                )}
              </ProfileSection>

              <Separator />

              <ProfileSection title="Weekly schedule">
                {scheduleRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No schedule rows in this snapshot.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {scheduleRows.map((row) => (
                      <div
                        key={row.key}
                        className={cn(
                          "rounded-md border px-3 py-2 text-sm",
                          row.isContinuation && "bg-muted/30 border-dashed",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{row.shift || "—"}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {row.start} – {row.end}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {row.day_label}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ProfileSection>

              {agent.cubicle_by_day &&
                Object.keys(agent.cubicle_by_day).length > 0 && (
                  <>
                    <Separator />
                    <ProfileSection title="Cubicle assignments">
                      <div className="grid grid-cols-7 gap-1.5">
                        {DOW_LIST.map((d) => {
                          const cubicle = agent.cubicle_by_day?.[d];
                          return (
                            <div
                              key={d}
                              className="rounded border px-1.5 py-2 text-center"
                            >
                              <div className="text-[10px] uppercase text-muted-foreground">
                                {d}
                              </div>
                              <div className="font-mono text-sm font-semibold mt-0.5">
                                {cubicle ?? "·"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ProfileSection>
                  </>
                )}

              {agent.structure && (
                <>
                  <Separator />
                  <ProfileSection title="Day structure">
                    <p className="text-xs font-mono text-muted-foreground leading-relaxed break-words">
                      {agent.structure.split("|").join(" · ")}
                    </p>
                  </ProfileSection>
                </>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProfileSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        {title === "Team" && <User className="h-3.5 w-3.5" />}
        {title === "Shift template" && <Clock className="h-3.5 w-3.5" />}
        {title === "Cubicle assignments" && <MapPin className="h-3.5 w-3.5" />}
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function ProfileRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
