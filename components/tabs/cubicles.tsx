"use client";

import { useMemo, useState, useEffect } from "react";
import { useQueryState } from "nuqs";
import { cubicleParam } from "@/lib/navigation/panel-params";
import { SectionCard } from "@/components/shared/section-card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AgentLink } from "@/components/agent/agent-link";
import { CubiclePill } from "@/components/shared/cubicle-pill";
import { StatTile } from "@/components/charts/stat-tile";
import {
  CUBICLE_LEGEND_STEPS,
  CUBICLE_NEAR_CAP_THRESHOLD,
  cubicleBarColor,
  cubicleColor,
  cubicleOccupancyRatio,
  cubicleStatTone,
} from "@/lib/compute/colors";
import { DOW_LIST, type DOW, type Snapshot } from "@/lib/data/types";
import { Search, X, RotateCcw, Info, User, HelpCircle } from "lucide-react";

interface CubiclesTabProps {
  snapshot: Snapshot;
}

export function CubiclesTab({ snapshot }: CubiclesTabProps) {
  const [cubicleFilter, setCubicleFilter] = useQueryState("cubicle", cubicleParam);
  const cap = snapshot.cubicles.cap;
  const occ = snapshot.cubicles.occupancy_by_day_hour;

  // State for matrix cell hover highlighting
  const [hoveredHourIdx, setHoveredHourIdx] = useState<number | null>(null);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  // State for assignments table search and filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [selectedShift, setSelectedShift] = useState<string>("all");

  // State for tracking hovered cubicle globally to highlight all matching desks
  const [hoveredCubicle, setHoveredCubicle] = useState<string | null>(null);

  const peakOcc = useMemo(() => {
    let peak = 0;
    for (const d of DOW_LIST) {
      const row = occ[d] ?? [];
      for (const v of row) if (v > peak) peak = v;
    }
    return peak;
  }, [occ]);

  const nearCapThreshold = cap * CUBICLE_NEAR_CAP_THRESHOLD;

  const hoursNearCap = useMemo(() => {
    let count = 0;
    for (const d of DOW_LIST) {
      for (const v of occ[d] ?? []) {
        if (v >= nearCapThreshold) count += 1;
      }
    }
    return count;
  }, [occ, nearCapThreshold]);

  const dailyPeaks = useMemo(
    () =>
      DOW_LIST.map((d) => {
        const row = occ[d] ?? [];
        let peak = 0;
        for (const v of row) if (v > peak) peak = v;
        return { day: d, peak };
      }),
    [occ],
  );

  const occupants = useMemo(
    () =>
      snapshot.agents.filter(
        (a) => a.role !== "Supervisor" && a.cubicle_by_day,
      ),
    [snapshot.agents],
  );

  // Dynamically extract unique roles and shifts from actual occupants to prevent mismatches
  const roles = useMemo(() => {
    const r = new Set<string>();
    occupants.forEach((a) => {
      if (a.role) r.add(a.role);
    });
    return Array.from(r).sort();
  }, [occupants]);

  const shiftClasses = useMemo(() => {
    const classes = new Set<string>();
    occupants.forEach((a) => {
      if (a.shift_id) classes.add(a.shift_id);
    });
    return Array.from(classes).sort();
  }, [occupants]);

  // Robust multi-criteria search and filter logic
  const filteredOccupants = useMemo(() => {
    return occupants.filter((a) => {
      const matchesSearch =
        a.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.shift_name && a.shift_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        DOW_LIST.some((d) => {
          const cubicleVal = a.cubicle_by_day?.[d as DOW];
          return cubicleVal && String(cubicleVal).includes(searchQuery);
        });

      const matchesRole =
        selectedRole === "all" || a.role === selectedRole;

      const matchesShift =
        selectedShift === "all" || a.shift_id === selectedShift;

      const matchesCubicle =
        !cubicleFilter ||
        DOW_LIST.some((d) => String(a.cubicle_by_day?.[d as DOW] ?? "") === cubicleFilter);

      return matchesSearch && matchesRole && matchesShift && matchesCubicle;
    });
  }, [occupants, searchQuery, selectedRole, selectedShift, cubicleFilter]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedRole("all");
    setSelectedShift("all");
    setCubicleFilter(null);
  };

  useEffect(() => {
    if (cubicleFilter) setSearchQuery(cubicleFilter);
  }, [cubicleFilter]);

  return (
    <div className="space-y-5">
        <SectionCard
          title={`Cubicle occupancy · hard cap ${cap}`}
          description="Average concurrent occupants per hour. CSAs, NDS, and SDS share the cubicle pool. Supervisors are excluded (they float)."
          toolbar={
            <Badge
              variant={peakOcc >= nearCapThreshold ? "warning" : "secondary"}
              className="font-mono"
            >
              Week peak {peakOcc.toFixed(1)} / {cap}
            </Badge>
          }
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatTile
              label="Week peak occupancy"
              value={`${peakOcc.toFixed(1)} / ${cap}`}
              tone={cubicleStatTone(peakOcc, cap)}
              hint={`${Math.round(cubicleOccupancyRatio(peakOcc, cap) * 100)}% of cap`}
            />
            <StatTile
              label="Hours near cap"
              value={String(hoursNearCap)}
              tone={hoursNearCap > 0 ? cubicleStatTone(nearCapThreshold, cap) : undefined}
              hint={`≥ ${Math.round(CUBICLE_NEAR_CAP_THRESHOLD * 100)}% (${nearCapThreshold.toFixed(1)} seats)`}
            />
            <StatTile
              label="Physical cap"
              value={String(cap)}
              hint="Concurrent cubicle seats"
            />
            <StatTile
              label="Agents in pool"
              value={String(occupants.length)}
              hint="CSAs, NDS, SDS — supervisors excluded"
            />
          </div>

          <div className="mb-4 space-y-2">
            <p className="text-xs font-medium text-foreground">Daily peak occupancy</p>
            <div className="space-y-1.5">
              {dailyPeaks.map(({ day, peak }) => {
                const pct = Math.min(100, cubicleOccupancyRatio(peak, cap) * 100);
                return (
                  <div key={day} className="flex items-center gap-3 text-xs">
                    <span className="w-8 font-medium text-muted-foreground">{day}</span>
                    <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${cubicleBarColor(peak, cap)}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-16 text-right num tabular-nums text-muted-foreground">
                      {peak.toFixed(1)}/{cap}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="overflow-x-auto border rounded-md">
            <table className="text-xs border-separate border-spacing-0 min-w-full">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left p-2.5 sticky left-0 bg-muted/40 font-semibold border-b border-r z-20">Hour</th>
                  {DOW_LIST.map((d) => {
                    const isColHovered = hoveredDay === d;
                    return (
                      <th
                        key={d}
                        className={`text-center p-2.5 font-semibold border-b transition-colors duration-150 ${
                          isColHovered
                            ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200"
                            : "text-muted-foreground"
                        }`}
                      >
                        {d}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {snapshot.meta.hours.map((h, hi) => {
                  const isRowHovered = hoveredHourIdx === hi;
                  return (
                    <tr key={h} className="border-t hover:bg-muted/10">
                      <td
                        className={`p-2 font-mono font-medium sticky left-0 bg-card border-r transition-colors duration-150 border-b ${
                          isRowHovered
                            ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-semibold"
                            : "text-muted-foreground"
                        }`}
                      >
                        {h}
                      </td>
                      {DOW_LIST.map((d) => {
                        const v = occ[d]?.[hi] ?? 0;
                        const isColHovered = hoveredDay === d;
                        const isCellHovered = isRowHovered && isColHovered;
                        return (
                          <Tooltip key={d} delayDuration={100}>
                            <TooltipTrigger asChild>
                              <td
                                onMouseEnter={() => {
                                  setHoveredHourIdx(hi);
                                  setHoveredDay(d);
                                }}
                                onMouseLeave={() => {
                                  setHoveredHourIdx(null);
                                  setHoveredDay(null);
                                }}
                                className={`p-2 text-center num cursor-pointer border-r border-b transition-all duration-150 select-none ${cubicleColor(v, cap)} ${
                                  isCellHovered
                                    ? "ring-2 ring-indigo-500 scale-105 z-10 font-bold"
                                    : isRowHovered || isColHovered
                                    ? "brightness-95 dark:brightness-110"
                                    : ""
                                }`}
                              >
                                {v ? v.toFixed(1) : ""}
                              </td>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              {d} {h} · {v.toFixed(1)}/{cap}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-4 pt-3 border-t">
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Utilized Cubicles:</span>
              {CUBICLE_LEGEND_STEPS.map((step) => (
                <span key={step.label} className="inline-flex items-center gap-1.5">
                  <span className={`w-3 h-3 rounded ${step.className}`} />
                  {step.label}
                </span>
              ))}
            </div>

            <p className="text-[11px] text-muted-foreground max-w-lg leading-normal md:text-right">
              Red cells mark hours at or above {Math.round(CUBICLE_NEAR_CAP_THRESHOLD * 100)}% of the {cap}-seat cap ({nearCapThreshold.toFixed(1)}+ occupants).
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="Daily cubicle assignments"
          description="Per-agent cubicle number for each working day. Empty cells = off day. Drives the hot-desk assignment used in floor maps."
          toolbar={
            <Badge variant="outline" className="font-mono">
              Showing {filteredOccupants.length} of {occupants.length} agents
            </Badge>
          }
        >
          {/* Enhanced Filtering Control Bar */}
          <div className="flex flex-col sm:flex-row gap-3 pb-4 mb-4 border-b">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search agent ID or cubicle..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            
            <div className="flex gap-2">
              <div className="w-[130px]">
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {roles.map((r) => (
                      <SelectItem key={r} value={r || "default"}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-[140px]">
                <Select value={selectedShift} onValueChange={setSelectedShift}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="All Shifts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Shifts</SelectItem>
                    {shiftClasses.map((sc) => (
                      <SelectItem key={sc} value={sc || "default"}>
                        {sc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(searchQuery || selectedRole !== "all" || selectedShift !== "all" || cubicleFilter) && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleResetFilters}
                  className="h-9 w-9 shrink-0"
                  title="Reset filters"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {filteredOccupants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border rounded-md bg-muted/10">
              <Info className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium text-foreground">No matches found</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Try expanding the search query or adjusting filters.
              </p>
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                Clear all filters
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-136 border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 sticky top-0 z-10">
                  <tr className="border-b">
                    <th className="text-left p-2.5 sticky left-0 bg-muted z-20 border-r font-semibold">
                      Agent
                    </th>
                    <th className="text-left p-2.5 font-semibold">Role</th>
                    <th className="text-left p-2.5 font-semibold">Shift</th>
                    {DOW_LIST.map((d) => (
                      <th key={d} className="text-center p-2.5 font-mono font-semibold">
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredOccupants.map((a) => (
                    <tr key={a.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                      <td className="p-2 sticky left-0 bg-card z-10 border-r text-xs">
                        <AgentLink agentId={a.id} />
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {a.role} {a.position}
                      </td>
                      <td className="p-2 font-mono text-xs">{a.shift_id}</td>
                      {DOW_LIST.map((d) => {
                        const v = a.cubicle_by_day?.[d as DOW] ?? "";
                        const isCurrentCubicleHovered = hoveredCubicle && String(v) === hoveredCubicle;
                        return (
                          <td
                            key={d}
                            className="p-2 text-center font-mono text-xs"
                          >
                            {v ? (
                              <CubiclePill
                                number={v}
                                day={d}
                                agentId={a.id}
                                highlighted={Boolean(isCurrentCubicleHovered)}
                                onMouseEnter={() => setHoveredCubicle(String(v))}
                                onMouseLeave={() => setHoveredCubicle(null)}
                                onClick={() => setCubicleFilter(String(v))}
                              />
                            ) : (
                              <span className="text-muted-foreground/30 font-light">·</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center gap-2 mt-4 text-[11px] text-muted-foreground">
            <Info className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            <span>
              <strong>Tip:</strong> Hover over any assigned cubicle number (e.g., <span className="bg-indigo-50 dark:bg-indigo-950 px-1 py-0.5 rounded font-bold">5</span>) to instantly highlight and trace that cubicle across all agents and days of the week.
            </span>
          </div>
        </SectionCard>
      </div>
  );
}
