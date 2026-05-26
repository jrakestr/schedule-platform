"use client";

import { useMemo, useState } from "react";
import { useQueryState, parseAsStringEnum } from "nuqs";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TAB_IDS, type TabId } from "@/components/tab-ids";
import { cn } from "@/lib/utils";
import type { Snapshot } from "@/lib/data/types";

interface RaciTabProps {
  snapshot: Snapshot;
}

// ─── Source data ────────────────────────────────────────────────────────────
// The RACI assignments below are kept verbatim from the prior version. They
// belong in the platform snapshot or a dedicated table; until that wiring
// exists they live here as the source of truth for this view.

interface RaciRow {
  task: string;
  csa: string;
  sds: string;
  nds: string;
  csaLead: string;
  supervisor: string;
  schedTrainingManager: string;
  gm: string;
}

const RACI_ROWS: RaciRow[] = [
  {
    task: "Inbound Call Taking & Reservations",
    csa: "Responsible",
    sds: "Not Involved",
    nds: "Not Involved",
    csaLead: "Accountable",
    supervisor: "Consulted",
    schedTrainingManager: "Not Involved",
    gm: "Informed",
  },
  {
    task: "First-Line Agent Inquiries & Questions",
    csa: "Responsible (Raise)",
    sds: "Not Involved",
    nds: "Not Involved",
    csaLead: "Responsible (Resolve)",
    supervisor: "Accountable",
    schedTrainingManager: "Consulted",
    gm: "Informed",
  },
  {
    task: "First-Line Agent Inquiries & ETAs",
    csa: "Responsible (Raise)",
    sds: "Consulted",
    nds: "Not Involved",
    csaLead: "Informed",
    supervisor: "Accountable",
    schedTrainingManager: "Not Involved",
    gm: "Informed",
  },
  {
    task: "Same-Day Trip Routing & Re-allocations",
    csa: "Involved (ETA Calls)",
    sds: "Resp + Acc",
    nds: "Not Involved",
    csaLead: "Consulted",
    supervisor: "Informed",
    schedTrainingManager: "Not Involved",
    gm: "Informed",
  },
  {
    task: "Next-Day Route Optimization & Prep",
    csa: "Involved (Reservations)",
    sds: "Informed",
    nds: "Resp + Acc",
    csaLead: "Not Involved",
    supervisor: "Informed",
    schedTrainingManager: "Consulted",
    gm: "Informed",
  },
  {
    task: "Pending Reassignment Status Updates",
    csa: "Responsible (Initial & Transfer)",
    sds: "Responsible (Resolve)",
    nds: "Not Involved",
    csaLead: "Informed",
    supervisor: "Accountable",
    schedTrainingManager: "Informed",
    gm: "Informed",
  },
  {
    task: "Provider OTP Data Audits & Validation",
    csa: "Not Involved",
    sds: "Consulted",
    nds: "Responsible (Validation)",
    csaLead: "Not Involved",
    supervisor: "Responsible (Incentives)",
    schedTrainingManager: "Not Involved",
    gm: "Accountable (Revenue)",
  },
  {
    task: "E-Wallet Customer Outreach",
    csa: "Not Involved",
    sds: "Consulted",
    nds: "Not Involved",
    csaLead: "Responsible",
    supervisor: "Accountable",
    schedTrainingManager: "Not Involved",
    gm: "Informed",
  },
  {
    task: "PCI-DSS Credit Card Compliance (April 2026 Valley Metro Rule)",
    csa: "Responsible (Compliance)",
    sds: "Not Involved",
    nds: "Not Involved",
    csaLead: "Responsible (Resolve)",
    supervisor: "Responsible (Audit)",
    schedTrainingManager: "Responsible (Training)",
    gm: "Accountable (Attest)",
  },
  {
    task: "Inbound Queue Surge Overflow Support",
    csa: "Responsible",
    sds: "Not Involved",
    nds: "Not Involved",
    csaLead: "Responsible",
    supervisor: "Involved (Last Resort)",
    schedTrainingManager: "Consulted",
    gm: "Accountable",
  },
  {
    task: "Critical Incident Escalations (Injury/etc.)",
    csa: "Responsible (Capture/Handoff)",
    sds: "Responsible (Dispatch)",
    nds: "Informed",
    csaLead: "Consulted",
    supervisor: "Responsible (Triage)",
    schedTrainingManager: "Informed",
    gm: "Accountable (Final Report)",
  },
  {
    task: "Escalated Passenger Call Resolution",
    csa: "Responsible (Initial & Transfer)",
    sds: "Not Involved",
    nds: "Not Involved",
    csaLead: "Responsible",
    supervisor: "Accountable",
    schedTrainingManager: "Informed",
    gm: "Informed",
  },
  {
    task: "Overtime & Cleanup Shift Authorization",
    csa: "Not Involved",
    sds: "Not Involved",
    nds: "Not Involved",
    csaLead: "Not Involved",
    supervisor: "Responsible",
    schedTrainingManager: "Accountable",
    gm: "Informed",
  },
];

const ROLE_COLS: Array<{ key: keyof Omit<RaciRow, "task">; label: string; filterRole?: string }> = [
  { key: "csa", label: "CSA", filterRole: "CSA" },
  { key: "sds", label: "SDS", filterRole: "SDS" },
  { key: "nds", label: "NDS", filterRole: "NDS" },
  { key: "csaLead", label: "CSA Lead", filterRole: "Lead" },
  { key: "supervisor", label: "Supervisor", filterRole: "Supervisor" },
  { key: "schedTrainingManager", label: "Sched / Training Mgr" },
  { key: "gm", label: "GM / PM" },
];

// ─── Parsing ────────────────────────────────────────────────────────────────

type Code = "R" | "A" | "C" | "I";

interface ParsedCell {
  codes: Code[]; // empty = not involved
  note?: string;
}

function classifyWord(word: string): Code | null {
  const w = word.trim().toLowerCase();
  if (w.startsWith("responsible")) return "R";
  if (w.startsWith("accountable")) return "A";
  if (w === "consulted") return "C";
  if (w === "informed") return "I";
  if (w === "involved") return "C"; // operational alias used in source data
  return null;
}

function parseCell(text: string): ParsedCell {
  const t = text.trim();
  if (!t || t === "Not Involved") return { codes: [] };
  if (t === "Resp + Acc") return { codes: ["R", "A"] };

  // "Word" or "Word (note)"
  const m = t.match(/^([^(]+?)(?:\s*\(([^)]+)\))?$/);
  if (!m) return { codes: [] };
  const code = classifyWord(m[1]!);
  if (!code) return { codes: [] };
  return { codes: [code], note: m[2]?.trim() };
}

// ─── Display tokens ─────────────────────────────────────────────────────────

const CODE_TONE: Record<Code, { chip: string; label: string }> = {
  R: {
    chip: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-500/40",
    label: "Responsible",
  },
  A: {
    chip: "bg-sky-100 text-sky-900 ring-1 ring-sky-500/30 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-500/40",
    label: "Accountable",
  },
  C: {
    chip: "bg-amber-100 text-amber-900 ring-1 ring-amber-500/40 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-500/40",
    label: "Consulted",
  },
  I: {
    chip: "bg-slate-100 text-slate-700 ring-1 ring-slate-400/30 dark:bg-slate-800/60 dark:text-slate-300 dark:ring-slate-500/30",
    label: "Informed",
  },
};

const CODE_ORDER: Code[] = ["R", "A", "C", "I"];

// ─── Components ─────────────────────────────────────────────────────────────

function RaciChip({ cell }: { cell: ParsedCell }) {
  if (cell.codes.length === 0) {
    return <span aria-hidden className="inline-block" />;
  }
  return (
    <span className="inline-flex flex-col items-center gap-0.5">
      <span className="inline-flex gap-0.5">
        {cell.codes.map((code) => (
          <span
            key={code}
            className={cn(
              "inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold",
              CODE_TONE[code].chip,
            )}
            title={`${CODE_TONE[code].label}${cell.note ? ` — ${cell.note}` : ""}`}
          >
            {code}
          </span>
        ))}
      </span>
      {cell.note && (
        <span className="max-w-[120px] text-[9px] leading-tight text-muted-foreground">
          {cell.note}
        </span>
      )}
    </span>
  );
}

function RoleColumnHeader({
  label,
  filterRole,
}: {
  label: string;
  filterRole?: string;
}) {
  const [, setTab] = useQueryState(
    "tab",
    parseAsStringEnum<TabId>([...TAB_IDS]).withDefault("raci"),
  );
  const [, setRole] = useQueryState("role", { defaultValue: "", clearOnDefault: true });

  if (!filterRole) {
    return <span className="text-foreground">{label}</span>;
  }
  return (
    <button
      type="button"
      onClick={() => {
        setRole(filterRole);
        setTab("roster");
      }}
      className="text-foreground transition-colors hover:text-primary"
    >
      {label}
    </button>
  );
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-end justify-between gap-3 border-b border-border/40 pb-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/70">
        {title}
      </h2>
      {hint && (
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {hint}
        </span>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
      {CODE_ORDER.map((code) => (
        <div key={code} className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold",
              CODE_TONE[code].chip,
            )}
          >
            {code}
          </span>
          <span className="text-foreground">{CODE_TONE[code].label}</span>
        </div>
      ))}
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span className="inline-block h-5 w-5 rounded border border-dashed border-border/60" />
        <span>Not involved</span>
      </div>
    </div>
  );
}

function FocusedRoleView({ col }: { col: (typeof ROLE_COLS)[number] }) {
  const rows = RACI_ROWS.map((row) => ({
    task: row.task,
    cell: parseCell(row[col.key]),
  }));

  const grouped: Record<Code, Array<{ task: string; note?: string }>> = {
    R: [],
    A: [],
    C: [],
    I: [],
  };
  const notInvolved: string[] = [];

  for (const r of rows) {
    if (r.cell.codes.length === 0) {
      notInvolved.push(r.task);
      continue;
    }
    for (const code of r.cell.codes) {
      grouped[code].push({ task: r.task, note: r.cell.note });
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-lg border border-border/70 bg-card px-4 py-3 shadow-sm">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {rows.filter((r) => r.cell.codes.length > 0).length} of {RACI_ROWS.length} tasks
          </span>
        </div>
      </div>

      {CODE_ORDER.map((code) => {
        const items = grouped[code];
        if (items.length === 0) return null;
        const tone = CODE_TONE[code];
        return (
          <div
            key={code}
            className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm"
          >
            <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-4 py-2">
              <span
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold",
                  tone.chip,
                )}
              >
                {code}
              </span>
              <span className="text-sm font-semibold text-foreground">{tone.label}</span>
              <span className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">
                {items.length} {items.length === 1 ? "task" : "tasks"}
              </span>
            </div>
            <ul className="divide-y divide-border/30">
              {items.map(({ task, note }) => (
                <li
                  key={task}
                  className="flex items-baseline justify-between gap-3 px-4 py-2 text-xs transition-colors hover:bg-muted/20"
                >
                  <span className="text-foreground">{task}</span>
                  {note && (
                    <span className="text-[10px] italic text-muted-foreground">— {note}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {notInvolved.length > 0 && (
        <details className="rounded-lg border border-border/40 bg-muted/10 px-4 py-2">
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Not involved in {notInvolved.length} task{notInvolved.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
            {notInvolved.map((task) => (
              <li key={task}>· {task}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// ─── Tab root ───────────────────────────────────────────────────────────────

type RoleFilter = "all" | keyof Omit<RaciRow, "task">;

export function RaciTab(_props: RaciTabProps) {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const selectedCol = roleFilter !== "all" ? ROLE_COLS.find((c) => c.key === roleFilter) : null;

  // Validation: count Accountables per task. The RACI rule of thumb is exactly one.
  const validation = useMemo(() => {
    const issues: Array<{ task: string; accountables: number }> = [];
    for (const row of RACI_ROWS) {
      const accountables = ROLE_COLS.reduce((sum, col) => {
        const parsed = parseCell(row[col.key]);
        return sum + (parsed.codes.includes("A") ? 1 : 0);
      }, 0);
      if (accountables !== 1) {
        issues.push({ task: row.task, accountables });
      }
    }
    return issues;
  }, []);

  return (
    <div className="space-y-10">
      {/* ─── RACI matrix ─────────────────────────────────────────── */}
      <section>
        <SectionHeader
          title="Operations RACI"
          hint={`${RACI_ROWS.length} tasks · ${ROLE_COLS.length} roles`}
        />

        {/* Validation strip */}
        <div className="mt-5">
          {validation.length === 0 ? (
            <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                All {RACI_ROWS.length} tasks have exactly one Accountable.
              </span>
            </div>
          ) : (
            <div className="space-y-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  {validation.length} task{validation.length === 1 ? "" : "s"} need exactly one Accountable.
                </span>
              </div>
              <ul className="ml-6 list-disc space-y-0.5 text-[11px]">
                {validation.map((v) => (
                  <li key={v.task}>
                    <span className="text-foreground">{v.task}</span>
                    <span className="ml-1 font-mono text-amber-700 dark:text-amber-400">
                      ({v.accountables} A)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Filter + Legend */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="raci-role-filter" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Filter by role
            </label>
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
              <SelectTrigger id="raci-role-filter" className="h-8 w-[210px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All roles (matrix view)</SelectItem>
                {ROLE_COLS.map((col) => (
                  <SelectItem key={col.key} value={col.key} className="text-xs">
                    {col.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Legend />
        </div>

        {/* Either the full matrix or a focused single-role view */}
        {selectedCol ? (
          <FocusedRoleView col={selectedCol} />
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead className="bg-muted/30 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="sticky left-0 z-10 min-w-[280px] border-b border-border/60 bg-muted/30 px-4 py-2.5">
                      Task
                    </th>
                    {ROLE_COLS.map((col) => (
                      <th
                        key={col.key}
                        className="min-w-[96px] border-b border-border/60 px-2 py-2.5 text-center"
                      >
                        <RoleColumnHeader label={col.label} filterRole={col.filterRole} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RACI_ROWS.map((row, idx) => {
                    const isAlt = idx % 2 === 1;
                    return (
                      <tr key={row.task} className="group">
                        <td
                          className={cn(
                            "sticky left-0 z-10 min-w-[280px] border-b border-border/30 px-4 py-2.5 text-xs font-medium text-foreground transition-colors group-hover:bg-muted/20",
                            isAlt ? "bg-muted/10" : "bg-card",
                          )}
                        >
                          {row.task}
                        </td>
                        {ROLE_COLS.map((col) => {
                          const cell = parseCell(row[col.key]);
                          return (
                            <td
                              key={col.key}
                              className={cn(
                                "border-b border-border/30 px-2 py-2 text-center align-middle transition-colors group-hover:bg-muted/20",
                                isAlt ? "bg-muted/10" : "bg-card",
                              )}
                            >
                              <RaciChip cell={cell} />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
