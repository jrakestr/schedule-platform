"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Save, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type Day = (typeof DAYS)[number];
const SHIFT_RE = /^(?:OFF|([01]?\d|2[0-3]):[0-5]\d-([01]?\d|2[0-3]):[0-5]\d)$/;

type Role = "SDS" | "Next Day" | "Supervisor";

type ManualScheduleRow = {
  agent_id: string;
  name: string;
  role: Role;
  schedule: Record<Day, string>;
  updated_at: string | null;
  updated_by: string | null;
};

const ROLE_ORDER: Role[] = ["SDS", "Next Day", "Supervisor"];

const ROLE_TONE: Record<Role, string> = {
  SDS: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  "Next Day": "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  Supervisor: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

function isValidShift(val: string): boolean {
  return SHIFT_RE.test(val.trim());
}

export function ManualSchedulesTab() {
  const [rows, setRows] = useState<ManualScheduleRow[]>([]);
  const [draft, setDraft] = useState<Record<string, Record<Day, string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/manual-schedules", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const loaded: ManualScheduleRow[] = body.rows ?? [];
      setRows(loaded);
      const initialDraft: Record<string, Record<Day, string>> = {};
      for (const row of loaded) {
        initialDraft[row.agent_id] = { ...row.schedule };
      }
      setDraft(initialDraft);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirtyIds = useMemo(() => {
    const ids: string[] = [];
    for (const row of rows) {
      const d = draft[row.agent_id];
      if (!d) continue;
      for (const day of DAYS) {
        if (d[day] !== row.schedule[day]) {
          ids.push(row.agent_id);
          break;
        }
      }
    }
    return ids;
  }, [rows, draft]);

  const invalidIds = useMemo(() => {
    const bad: string[] = [];
    for (const id of Object.keys(draft)) {
      const s = draft[id];
      for (const day of DAYS) {
        if (!isValidShift(s[day] ?? "")) {
          bad.push(id);
          break;
        }
      }
    }
    return bad;
  }, [draft]);

  const onCellChange = (agentId: string, day: Day, value: string) => {
    setDraft((prev) => ({
      ...prev,
      [agentId]: { ...prev[agentId], [day]: value },
    }));
  };

  const onSave = async () => {
    if (saving || dirtyIds.length === 0) return;
    if (invalidIds.length > 0) {
      setError(
        `Fix invalid shifts before saving (${invalidIds.length} agent${
          invalidIds.length === 1 ? "" : "s"
        } have malformed times)`,
      );
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updates = dirtyIds.map((id) => ({
        agent_id: id,
        schedule: draft[id],
      }));
      const res = await fetch("/api/manual-schedules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setNotice(`Saved ${body.updated} schedule${body.updated === 1 ? "" : "s"}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const onImport = async (file: File) => {
    setImporting(true);
    setError(null);
    setNotice(null);
    try {
      const csv = await file.text();
      const res = await fetch("/api/manual-schedules/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        const detail = Array.isArray(body.details) ? `: ${body.details.slice(0, 3).join("; ")}` : "";
        throw new Error(`${body.error ?? `HTTP ${res.status}`}${detail}`);
      }
      setNotice(
        `Imported ${body.updated} of ${body.submitted} row${body.submitted === 1 ? "" : "s"}.`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  };

  const ordered = useMemo(() => {
    return [...rows].sort((a, b) => {
      const ra = ROLE_ORDER.indexOf(a.role);
      const rb = ROLE_ORDER.indexOf(b.role);
      if (ra !== rb) return ra - rb;
      return a.agent_id.localeCompare(b.agent_id);
    });
  }, [rows]);

  return (
    <div className="space-y-4 p-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Manual Schedules</h2>
          <p className="text-xs text-muted-foreground max-w-xl">
            SDS, Next Day, and Supervisor schedules are maintained here, not by the
            CSA optimizer. Use <span className="font-mono">HH:MM-HH:MM</span> or{" "}
            <span className="font-mono">OFF</span> per day. Changes overlay onto
            the Coverage and Validation charts after saving.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading || saving}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            <span className="ml-1.5">Reload</span>
          </Button>
          <label className="inline-flex">
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              disabled={importing || saving}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImport(f);
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" asChild disabled={importing || saving}>
              <span className="cursor-pointer">
                {importing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                <span className="ml-1.5">Import CSV</span>
              </span>
            </Button>
          </label>
          <Button
            size="sm"
            onClick={onSave}
            disabled={saving || loading || dirtyIds.length === 0 || invalidIds.length > 0}
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            <span className="ml-1.5">
              Save{dirtyIds.length > 0 ? ` (${dirtyIds.length})` : ""}
            </span>
          </Button>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/5 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
          {notice}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 bg-card">Role</TableHead>
              <TableHead className="sticky left-[64px] z-10 bg-card">Agent</TableHead>
              {DAYS.map((d) => (
                <TableHead key={d} className="text-center">{d}</TableHead>
              ))}
              <TableHead className="text-right text-[10px] text-muted-foreground">
                Updated
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={DAYS.length + 3} className="text-center text-muted-foreground py-6">
                  <Loader2 className="inline h-4 w-4 animate-spin" />
                  <span className="ml-2">Loading…</span>
                </TableCell>
              </TableRow>
            )}
            {ordered.map((row) => {
              const isDirty = dirtyIds.includes(row.agent_id);
              const d = draft[row.agent_id] ?? row.schedule;
              return (
                <TableRow key={row.agent_id} className={cn(isDirty && "bg-amber-500/5")}>
                  <TableCell className="sticky left-0 z-10 bg-inherit">
                    <Badge className={cn("text-[10px]", ROLE_TONE[row.role])} variant="outline">
                      {row.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="sticky left-[64px] z-10 bg-inherit whitespace-nowrap">
                    <div className="font-medium text-xs">{row.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {row.agent_id}
                    </div>
                  </TableCell>
                  {DAYS.map((day) => {
                    const val = d[day] ?? "";
                    const bad = !isValidShift(val);
                    return (
                      <TableCell key={day} className="p-1">
                        <Input
                          value={val}
                          onChange={(e) => onCellChange(row.agent_id, day, e.target.value)}
                          placeholder="OFF or 08:00-16:00"
                          className={cn(
                            "h-7 w-28 font-mono text-[11px] tabular-nums",
                            bad && "border-red-500 text-red-700 dark:text-red-300",
                            val === "OFF" && "text-muted-foreground",
                          )}
                          aria-invalid={bad}
                        />
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right text-[10px] text-muted-foreground whitespace-nowrap">
                    {row.updated_at ? new Date(row.updated_at).toLocaleString() : "—"}
                    {row.updated_by && (
                      <div className="text-[9px] opacity-70">{row.updated_by}</div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-[10px] text-muted-foreground">
        CSV import header:{" "}
        <span className="font-mono">agent_id,Mon,Tue,Wed,Thu,Fri,Sat,Sun</span>. Only
        SDS / Next Day / Supervisor rows are accepted; out-of-scope agent_ids are
        silently ignored by the database.
      </p>
    </div>
  );
}
