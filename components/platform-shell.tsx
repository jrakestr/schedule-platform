"use client";

import { useState, useEffect } from "react";
import { LayoutGroup, motion } from "framer-motion";
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
  const [activeSnapshot, setActiveSnapshot] = useState<Snapshot>(snapshot);

  useEffect(() => {
    setActiveSnapshot(snapshot);
  }, [snapshot]);

  const [tab, setTab] = useQueryState<TabId>(
    "tab",
    parseAsStringEnum<TabId>([...TAB_IDS]).withDefault("coverage"),
  );

  const [rawLeadPct, setLeadPct] = useQueryState("lead", parseAsFloat);

  const leadPct = rawLeadPct ?? activeSnapshot.meta.lead_on_work_default;

  return (
    <div className="min-h-screen page-shell">
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
        <div className="sticky top-0 z-10 tab-rail">
          <div className="mx-auto max-w-7xl px-6">
            <TabsList className="bg-transparent gap-0.5 h-auto p-0 w-full justify-start overflow-x-auto">
              <LayoutGroup>
                {TAB_IDS.map((id) => (
                  <TabsTrigger
                    key={id}
                    value={id}
                    className={cn(
                      "relative rounded-none border-b-2 border-transparent py-3 px-4 text-sm font-medium",
                      "text-muted-foreground hover:text-foreground transition-colors",
                      "data-[state=active]:border-transparent data-[state=active]:bg-transparent",
                      "data-[state=active]:shadow-none data-[state=active]:text-primary",
                    )}
                  >
                    {TAB_LABELS[id]}
                    {tab === id && (
                      <motion.span
                        layoutId="platform-tab-indicator"
                        className="absolute left-3 right-3 bottom-0 h-0.5 rounded-full bg-primary"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                  </TabsTrigger>
                ))}
              </LayoutGroup>
            </TabsList>
          </div>
        </div>

        <main className="mx-auto max-w-7xl px-6 py-6">
          <div className="rounded-2xl surface-inset p-6 min-h-[60vh]">
          {tab === "coverage" && <CoverageTab snapshot={activeSnapshot} leadPct={leadPct} />}
          {tab === "validation" && <ValidationTab snapshot={activeSnapshot} leadPct={leadPct} />}
          {tab === "raci" && <RaciTab snapshot={activeSnapshot} />}
          {tab === "supervisor" && <SupervisorTab snapshot={activeSnapshot} leadPct={leadPct} />}
          {tab === "pods" && <PodsTab snapshot={activeSnapshot} />}
          {tab === "shifts" && <ShiftsTab snapshot={activeSnapshot} />}
          {tab === "cubicles" && <CubiclesTab snapshot={activeSnapshot} />}
          {tab === "roster" && <RosterTab snapshot={activeSnapshot} />}
          {tab === "optimizer" && (
            <OptimizerTab snapshot={activeSnapshot} onUpdateSnapshot={setActiveSnapshot} optimizations={optimizations} />
          )}
          </div>
        </main>
      </Tabs>

      <footer className="border-t surface-panel mt-12">
        <div className="mx-auto max-w-7xl px-6 py-4 text-xs text-muted-foreground flex items-center justify-between">
          <span>
            MJM ParaTransit · 53 roster · 6 Supervisor · 6 teams · 24/7 staffing
          </span>
          <span className="num font-mono text-[11px]">
            source: {activeSnapshot.meta.source}
          </span>
        </div>
      </footer>
    </div>
  );
}
