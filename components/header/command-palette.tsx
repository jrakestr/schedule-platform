"use client";

import { useEffect, useState } from "react";
import { useQueryState } from "nuqs";
import { agentIdParam, teamParam, teamRoleParam } from "@/lib/navigation/panel-params";
import { Search, User, Briefcase, Building2, Shield, Clock } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import type { Snapshot } from "@/lib/data/types";
import type { TabId } from "@/components/tab-ids";

interface CommandPaletteProps {
  snapshot: Snapshot;
  onJump: (tab: TabId) => void;
}

export function CommandPalette({ snapshot, onJump }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [, setAgentId] = useQueryState("agent_id", agentIdParam);
  const [, setTeam] = useQueryState("team", teamParam);
  const [, setTeamRole] = useQueryState("team_role", teamRoleParam);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        if (e.target instanceof HTMLInputElement) return;
        if (e.target instanceof HTMLTextAreaElement) return;
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const run = (tab: TabId) => {
    setOpen(false);
    onJump(tab);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground"
      >
        <Search className="mr-2 h-3 w-3" />
        Search
        <kbd className="ml-2 hidden md:inline-flex pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-[11px]">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search agents, shifts, pods, supervisors…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>

          <CommandGroup heading="Tabs">
            {(
              [
                ["Coverage", "coverage"],
                ["Validation", "validation"],
                ["Supervisor", "supervisor"],
                ["Pods", "pods"],
                ["Shifts", "shifts"],
                ["Cubicles", "cubicles"],
                ["Roster", "roster"],
              ] as Array<[string, TabId]>
            ).map(([label, id]) => (
              <CommandItem
                key={id}
                value={`tab ${label}`}
                onSelect={() => run(id)}
              >
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                {label}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="People">
            {snapshot.agents.map((a) => (
              <CommandItem
                key={a.id}
                value={`${a.id} ${a.role} ${a.position} ${a.shift_class}`}
                onSelect={() => {
                  setOpen(false);
                  setAgentId(a.id);
                }}
              >
                {a.role === "Supervisor" ? (
                  <Shield className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <User className="h-4 w-4 text-muted-foreground" />
                )}
                <span>{a.id}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {a.role} · {a.shift_class}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Pods">
            {Object.keys(snapshot.pods).map((name) => (
              <CommandItem
                key={name}
                value={`pod ${name}`}
                onSelect={() => {
                  setOpen(false);
                  setAgentId(null);
                  setTeamRole(null);
                  setTeam(name);
                  onJump("pods");
                }}
              >
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {name}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Shifts">
            {snapshot.shift_catalog.map((s) => (
              <CommandItem
                key={s.shift_id}
                value={`shift ${s.shift_id} ${s.label}`}
                onSelect={() => run("shifts")}
              >
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{s.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {s.start_clock}–{s.end_clock}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
