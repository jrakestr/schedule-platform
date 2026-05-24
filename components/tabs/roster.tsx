"use client";

import { useMemo, useState, useEffect } from "react";
import { useQueryState, parseAsString } from "nuqs";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import Papa from "papaparse";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Columns,
  Download,
  Search,
  X,
} from "lucide-react";
import { AgentLink } from "@/components/agent/agent-link";
import { TeamLink } from "@/components/team/team-link";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  shiftColor,
  roleBadgeClass,
} from "@/lib/compute/colors";
import { rosterRowsFor, type RosterRow } from "@/lib/compute/roster";
import { cn } from "@/lib/utils";
import { type Snapshot } from "@/lib/data/types";

interface RosterTabProps {
  snapshot: Snapshot;
}

const ROLES = ["All", "Supervisor", "CSA", "NDS", "SDS"] as const;
const POSITIONS = ["All", "Lead", "Line", "Supervisor"] as const;
type RoleFilter = (typeof ROLES)[number];
type PositionFilter = (typeof POSITIONS)[number];

function parseClock(t: string): number | null {
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function shiftCoversHour(
  startClock: string,
  endClock: string,
  hour: number,
): boolean {
  const s = parseClock(startClock);
  let e = parseClock(endClock);
  if (s === null || e === null) return false;
  if (e <= s) e += 24 * 60;
  const target = hour * 60;
  const targetWrapped = target + 24 * 60;
  return (
    (target >= s && target < e) ||
    (targetWrapped >= s && targetWrapped < e)
  );
}

function rosterOperationalRole(role: string, position: string): string | null {
  if (!role) return null;
  if (role === "Supervisor") return "Supervisor";
  if (role === "CSA") return position === "Lead" ? "CSA Lead" : "CSA";
  if (role === "SDS") return position === "Lead" ? "SDS Lead" : "SDS";
  if (role === "NDS") return "NDS";
  return role;
}

export function RosterTab({ snapshot }: RosterTabProps) {
  const [roleParam] = useQueryState("role", parseAsString);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("All");
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("All");

  useEffect(() => {
    if (!roleParam) return;
    if (roleParam === "Lead") {
      setRoleFilter("All");
      setPositionFilter("Lead");
      return;
    }
    const match = ROLES.find((r) => r === roleParam);
    if (match) {
      setRoleFilter(match);
      if (roleParam !== "Supervisor") setPositionFilter("All");
    }
  }, [roleParam]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalSearch, setGlobalSearch] = useQueryState(
    "search",
    parseAsString.withDefault(""),
  );
  const [onShift, setOnShift] = useQueryState("onShift");

  const onShiftHour = onShift !== null ? Number(onShift) : null;
  const hourFilterActive =
    onShiftHour !== null &&
    Number.isInteger(onShiftHour) &&
    onShiftHour >= 0 &&
    onShiftHour < 24;

  const rows = useMemo<RosterRow[]>(() => {
    const out: RosterRow[] = [];
    for (const agent of snapshot.agents) {
      const matchesRole =
        roleFilter === "All" || agent.role === roleFilter;
      const matchesPosition =
        positionFilter === "All" || agent.position === positionFilter;
      if (!matchesRole || !matchesPosition) continue;
      const agentRows = rosterRowsFor(
        agent,
        snapshot.pods,
        snapshot.supervisor_schedule,
      );
      for (const r of agentRows) {
        if (hourFilterActive) {
          if (r.start === "—" || r.end === "—") continue;
          if (!shiftCoversHour(r.start, r.end, onShiftHour!)) continue;
        }
        out.push(r);
      }
    }
    return out;
  }, [snapshot, roleFilter, positionFilter, hourFilterActive, onShiftHour]);

  const columns = useMemo<ColumnDef<RosterRow>[]>(
    () => [
      {
        accessorKey: "id",
        header: "Agent",
        cell: ({ row }) =>
          row.original.id ? (
            <AgentLink
              agentId={row.original.id}
              className={cn(
                row.original.isContinuation && "text-muted-foreground/60",
              )}
            />
          ) : (
            <span className="text-muted-foreground/60 text-xs">↳</span>
          ),
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => {
          const label = rosterOperationalRole(
            row.original.role,
            row.original.position,
          );
          if (!label) return null;
          return (
            <Badge variant="outline" className={roleBadgeClass(label)}>
              {label}
            </Badge>
          );
        },
      },
      {
        accessorKey: "position",
        header: "Position",
        cell: ({ row }) =>
          row.original.position === "Line" ? (
            <span className="text-sm text-muted-foreground">{row.original.position}</span>
          ) : row.original.position === "Supervisor" ? (
            <Badge variant="outline" className={roleBadgeClass("Supervisor")}>
              Supervisor
            </Badge>
          ) : row.original.position === "Lead" ? (
            <span className="text-sm text-muted-foreground">Lead</span>
          ) : null,
      },
      {
        accessorKey: "shift",
        header: "Shift",
        cell: ({ row }) => {
          const v = row.original.shift;
          if (!v) return null;
          const isSplitIncentive =
            v.startsWith("WKND_") ||
            v.startsWith("OVERNIGHT_") ||
            v.startsWith("TWILIGHT_") ||
            v.includes("SPLIT");

          return (
            <div className="inline-flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs inline-flex items-center gap-1.5">
                <span
                  className="inline-block w-2 h-2 rounded-sm"
                  style={{ background: shiftColor(v) }}
                />
                {v}
              </span>
              {isSplitIncentive && (
                <div className="inline-flex gap-1">
                  <Badge
                    variant="outline"
                    className="text-[9px] h-4 px-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40"
                  >
                    WFH
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[9px] h-4 px-1 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40"
                  >
                    +$20/Day
                  </Badge>
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "start",
        header: "Start",
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.start}</span>
        ),
      },
      {
        accessorKey: "end",
        header: "End",
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.end}</span>
        ),
      },
      {
        accessorKey: "day_label",
        header: "Days",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.day_label}
          </span>
        ),
      },
      {
        accessorKey: "pod",
        header: "Team",
        cell: ({ row }) =>
          row.original.pod && row.original.pod !== "—" ? (
            <TeamLink teamName={row.original.pod} className="text-sm font-normal" />
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "reports_to",
        header: "Reports to",
        cell: ({ row }) =>
          row.original.reports_to && row.original.reports_to !== "—" ? (
            <AgentLink agentId={row.original.reports_to} />
          ) : (
            <span className="font-mono text-xs text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "hours",
        header: () => <span className="text-right block">Hrs/wk</span>,
        cell: ({ row }) => {
          const h = row.original.hours;
          return (
            <span className="num text-right block tabular-nums text-sm">
              {typeof h === "number" ? h.toFixed(1) : h || ""}
            </span>
          );
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnFilters, columnVisibility, globalFilter: globalSearch },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalSearch,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: "includesString",
  });

  const filteredCount = table.getFilteredRowModel().rows.length;
  const supervisorExpansions = rows.filter((r) => r.isContinuation).length;
  const distinctAgents = new Set(
    rows.filter((r) => !r.isContinuation).map((r) => r.key.split("-")[0]),
  ).size;

  const exportCsv = () => {
    const data = table.getFilteredRowModel().rows.map((r) => ({
      agent: r.original.id,
      role: r.original.role,
      position: r.original.position,
      shift: r.original.shift,
      start: r.original.start,
      end: r.original.end,
      days: r.original.day_label,
      pod: r.original.pod,
      reports_to: r.original.reports_to,
      hours_per_week:
        typeof r.original.hours === "number"
          ? r.original.hours.toFixed(2)
          : r.original.hours,
    }));
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `roster-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <SectionCard
      title={`Roster · ${distinctAgents} people · ${supervisorExpansions} supervisor shift rows`}
      description={`${filteredCount} of ${rows.length} rows after filters.`}
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search…"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="pl-7 h-8 w-44 text-sm"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs">
                <Columns className="h-3 w-3 mr-1" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              {table
                .getAllColumns()
                .filter((c) => c.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(v) => column.toggleVisibility(!!v)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            className="text-xs"
          >
            <Download className="h-3 w-3 mr-1" />
            CSV
          </Button>
        </div>
      }
    >
      {hourFilterActive && (
        <div className="flex items-center gap-2 mb-3 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
          <span className="text-muted-foreground text-xs uppercase tracking-wider">
            Time filter
          </span>
          <span>
            Showing only people on shift at{" "}
            <span className="font-mono font-semibold">
              {String(onShiftHour).padStart(2, "0")}:00
            </span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 text-xs"
            onClick={() => setOnShift(null)}
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs uppercase text-muted-foreground tracking-wider mr-1">
          Role
        </span>
        {ROLES.map((r) => (
          <Button
            key={r}
            variant={roleFilter === r ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setRoleFilter(r)}
          >
            {r}
          </Button>
        ))}
        <span className="text-xs uppercase text-muted-foreground tracking-wider ml-3 mr-1">
          Position
        </span>
        {POSITIONS.map((p) => (
          <Button
            key={p}
            variant={positionFilter === p ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setPositionFilter(p)}
          >
            {p}
          </Button>
        ))}
      </div>

      <div className="border rounded-md max-h-136 overflow-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      header.column.getCanSort() &&
                        "cursor-pointer select-none",
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <span className="inline-flex items-center gap-1">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                      {header.column.getCanSort() && (
                        <SortIcon
                          state={header.column.getIsSorted()}
                        />
                      )}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center text-muted-foreground py-10"
                >
                  No matching rows.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    row.original.isContinuation && "bg-muted/30",
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}

function SortIcon({ state }: { state: false | "asc" | "desc" }) {
  if (state === "asc") return <ArrowUp className="h-3 w-3" />;
  if (state === "desc") return <ArrowDown className="h-3 w-3" />;
  return <ChevronsUpDown className="h-3 w-3 text-muted-foreground/60" />;
}
