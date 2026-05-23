"use client";

import { useState, useEffect } from "react";
import { useQueryState, parseAsFloat, parseAsStringEnum } from "nuqs";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { SiteHeader } from "@/components/header/site-header";
import { CoverageTab } from "@/components/tabs/coverage";
import { ValidationTab } from "@/components/tabs/validation";
import { RaciTab } from "@/components/tabs/raci";
import { SupervisorTab } from "@/components/tabs/supervisor";
import { PodsTab } from "@/components/tabs/pods";
import { ShiftsTab } from "@/components/tabs/shifts";
import { CubiclesTab } from "@/components/tabs/cubicles";
import { RosterTab } from "@/components/tabs/roster";
import { OptimizerTab } from "@/components/tabs/optimizer";
import { TAB_IDS, TAB_LABELS, type TabId } from "@/components/tab-ids";
import type { Snapshot } from "@/lib/data/types";
import { cn } from "@/lib/utils";
import type { OptimizationMeta } from "@/lib/data/snapshot";

interface PlatformShellProps {
  snapshot: Snapshot;
  takenAt: string | null;
  optimizations: OptimizationMeta[];
}

export function PlatformShell({ snapshot, takenAt, optimizations }: PlatformShellProps) {
  // Local state to support mutations inside the OptimizerTab
  const [activeSnapshot, setActiveSnapshot] = useState<Snapshot>(snapshot);

  // Synchronize local state with server-side snapshot changes
  useEffect(() => {
    setActiveSnapshot(snapshot);
  }, [snapshot]);

  const [tab, setTab] = useQueryState<TabId>(
    "tab",
    parseAsStringEnum<TabId>([...TAB_IDS]).withDefault("coverage"),
  );

  const [rawLeadPct, setLeadPct] = useQueryState("lead", parseAsFloat);
  
  // Safeguard: Fallback to active snapshot meta default if lead query is empty
  const leadPct = rawLeadPct ?? activeSnapshot.meta.lead_on_work_default;

  return (
    <div className="min-h-screen bg-background">
      <KeyboardShortcuts onJump={setTab} />
      <SiteHeader
        snapshot={activeSnapshot}
        takenAt={takenAt}
        leadPct={leadPct}
        setLeadPct={setLeadPct}
        onJump={setTab}
        optimizations={optimizations}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
        {/* Changed from <nav> to <div> for ARIA landmark compliance */}
        <div className="sticky top-0 z-10 bg-card border-b">
          <div className="mx-auto max-w-7xl px-6">
            <TabsList className="bg-transparent gap-1 h-auto p-0">
              {TAB_IDS.map((id) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  className={cn(
                    "rounded-none border-b-2 border-transparent py-3",
                    "data-[state=active]:border-primary data-[state=active]:text-primary",
                    "data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  )}
                >
                  {TAB_LABELS[id]}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        {/* Conditional rendering of tab panels reduces layout/rendering overhead */}
        <main className="mx-auto max-w-7xl px-6 py-6">
          {tab === "coverage" && <CoverageTab snapshot={activeSnapshot} leadPct={leadPct} />}
          {tab === "validation" && <ValidationTab snapshot={activeSnapshot} leadPct={leadPct} />}
          {tab === "raci" && <RaciTab />}
          {tab === "supervisor" && <SupervisorTab snapshot={activeSnapshot} leadPct={leadPct} />}
          {tab === "pods" && <PodsTab snapshot={activeSnapshot} />}
          {tab === "shifts" && <ShiftsTab snapshot={activeSnapshot} />}
          {tab === "cubicles" && <CubiclesTab snapshot={activeSnapshot} />}
          {tab === "roster" && <RosterTab snapshot={activeSnapshot} />}
          {tab === "optimizer" && (
            <OptimizerTab snapshot={activeSnapshot} onUpdateSnapshot={setActiveSnapshot} optimizations={optimizations} />
          )}
        </main>
      </Tabs>

      <footer className="border-t bg-card mt-12">
        <div className="mx-auto max-w-7xl px-6 py-4 text-xs text-muted-foreground flex items-center justify-between">
          <span>MJM ParaTransit · Schedule Review · 24/7 staffing</span>
          <span className="num">
            source: {activeSnapshot.meta.source}
          </span>
        </div>
      </footer>
    </div>
  );
}
