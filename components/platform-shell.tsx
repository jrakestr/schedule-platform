"use client";

import { useState, useEffect, useCallback } from "react";
import { useQueryState, parseAsFloat, parseAsStringEnum } from "nuqs";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { SiteHeader } from "@/components/header/site-header";
import {
  PlatformSidebar,
  SidebarToggle,
} from "@/components/sidebar/platform-sidebar";
import { CoverageTab } from "@/components/tabs/coverage";
import { ValidationTab } from "@/components/tabs/validation";
import { RaciTab } from "@/components/tabs/raci";
import { SupervisorTab } from "@/components/tabs/supervisor";
import { PodsTab } from "@/components/tabs/pods";
import { ShiftsTab } from "@/components/tabs/shifts";
import { CubiclesTab } from "@/components/tabs/cubicles";
import { RosterTab } from "@/components/tabs/roster";
import { OptimizerTab } from "@/components/tabs/optimizer";
import { DriversPlaceholder } from "@/components/tabs/drivers-placeholder";
import { AgentProfilePanel } from "@/components/agent/agent-profile-panel";
import { TeamProfilePanel } from "@/components/team/team-profile-panel";
import { TAB_IDS, type TabId } from "@/components/tab-ids";
import {
  OPTIMIZER_SECTIONS,
  type OptimizerSection,
} from "@/components/nav/optimizer-section";
import type { Snapshot } from "@/lib/data/types";
import type { OptimizationMeta } from "@/lib/data/snapshot";

interface PlatformShellProps {
  snapshot: Snapshot;
  optimizations: OptimizationMeta[];
}

export function PlatformShell({ snapshot, optimizations }: PlatformShellProps) {
  const [activeSnapshot, setActiveSnapshot] = useState<Snapshot>(snapshot);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setActiveSnapshot(snapshot);
  }, [snapshot]);

  const [tab, setTab] = useQueryState<TabId>(
    "tab",
    parseAsStringEnum<TabId>([...TAB_IDS]).withDefault("raci"),
  );

  const [section, setSection] = useQueryState<OptimizerSection>(
    "section",
    parseAsStringEnum<OptimizerSection>([...OPTIMIZER_SECTIONS]).withDefault(
      "call-center",
    ),
  );

  const [rawLeadPct, setLeadPct] = useQueryState("lead", parseAsFloat);

  const leadPct = rawLeadPct ?? activeSnapshot.meta.lead_on_work_default;

  const jumpToTab = useCallback(
    (nextTab: TabId) => {
      void setTab(nextTab);
      if (section !== "call-center") {
        void setSection("call-center");
      }
    },
    [section, setSection, setTab],
  );

  return (
    <div className="min-h-screen page-shell flex">
      <KeyboardShortcuts onJump={jumpToTab} section={section} />

      <PlatformSidebar
        activeTab={tab}
        onTabChange={jumpToTab}
        mobileOpen={sidebarOpen}
        onMobileOpenChange={setSidebarOpen}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <SiteHeader
          snapshot={activeSnapshot}
          leadPct={leadPct}
          setLeadPct={setLeadPct}
          onJump={jumpToTab}
          optimizations={optimizations}
          sidebarToggle={
            <SidebarToggle open={sidebarOpen} onOpenChange={setSidebarOpen} />
          }
        />

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          <div className="min-h-[60vh] rounded-2xl surface-inset p-6">
            {section === "drivers" ? (
              <DriversPlaceholder />
            ) : (
              <>
                {tab === "coverage" && (
                  <CoverageTab snapshot={activeSnapshot} leadPct={leadPct} />
                )}
                {tab === "validation" && (
                  <ValidationTab snapshot={activeSnapshot} leadPct={leadPct} />
                )}
                {tab === "raci" && <RaciTab snapshot={activeSnapshot} />}
                {tab === "supervisor" && (
                  <SupervisorTab snapshot={activeSnapshot} leadPct={leadPct} />
                )}
                {tab === "pods" && <PodsTab snapshot={activeSnapshot} />}
                {tab === "shifts" && <ShiftsTab snapshot={activeSnapshot} />}
                {tab === "cubicles" && (
                  <CubiclesTab snapshot={activeSnapshot} />
                )}
                {tab === "roster" && <RosterTab snapshot={activeSnapshot} />}
                {tab === "optimizer" && (
                  <OptimizerTab
                    snapshot={activeSnapshot}
                    onUpdateSnapshot={setActiveSnapshot}
                    optimizations={optimizations}
                  />
                )}
              </>
            )}
          </div>
        </main>

        <AgentProfilePanel snapshot={activeSnapshot} onJump={jumpToTab} />
        <TeamProfilePanel snapshot={activeSnapshot} onJump={jumpToTab} />

        <footer className="mt-auto border-t surface-panel">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 text-xs text-muted-foreground sm:px-6">
            <span>
              MJM Brokerage Scheduling Application · 53 roster · 6 Supervisor · 6
              teams · 24/7 staffing
            </span>
            <span className="num font-mono text-[11px]">
              source: {activeSnapshot.meta.source}
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
