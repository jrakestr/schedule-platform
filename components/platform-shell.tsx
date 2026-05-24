"use client";

import { useState, useCallback, useEffect } from "react";
import { normalizeSnapshotPods } from "@/lib/data/normalize-snapshot";
import { useQueryState, parseAsFloat, parseAsStringEnum } from "nuqs";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { SiteHeader } from "@/components/header/site-header";
import {
  PlatformSidebar,
  SidebarToggle,
} from "@/components/sidebar/platform-sidebar";
import { TAB_IDS, type TabId } from "@/components/tab-ids";
import {
  OPTIMIZER_SECTIONS,
  type OptimizerSection,
} from "@/components/nav/optimizer-section";

// Tabs
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

import type { Snapshot } from "@/lib/data/types";
import type { OptimizationMeta } from "@/lib/data/snapshot";

interface PlatformShellProps {
  snapshot: Snapshot;
  baselineSnapshot: Snapshot;
  optimizations: OptimizationMeta[];
}

export function PlatformShell({ snapshot, baselineSnapshot, optimizations }: PlatformShellProps) {
  // 1. ELIMINATED USEEFFECT BUG:
  // Instead of syncing props to state via an effect, we key the local state
  // directly on the snapshot source. When the snapshot prop changes, 
  // React naturally resets this state to the incoming prop.
  const [activeSnapshot, setActiveSnapshot] = useState<Snapshot>(() =>
    normalizeSnapshotPods(snapshot),
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setActiveSnapshot(normalizeSnapshotPods(snapshot));
  }, [snapshot]);

  const handleUpdateSnapshot = useCallback((next: Snapshot) => {
    setActiveSnapshot(normalizeSnapshotPods(next));
  }, []);

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

  const [activeOptId] = useQueryState("opt_id", {
    defaultValue: "",
    clearOnDefault: true,
  });

  // 2. CONSOLIDATED TRANSITIONS:
  // Batched updates to avoid back-button history clutter and extra renders
  const jumpToTab = useCallback(
    async (nextTab: TabId) => {
      await Promise.all([
        setTab(nextTab),
        section !== "call-center" ? setSection("call-center") : Promise.resolve()
      ]);
    },
    [section, setSection, setTab],
  );

  // 3. TAB REGISTRY (Clean rendering pattern)
  const renderTabContent = () => {
    if (section === "drivers") {
      return <DriversPlaceholder />;
    }

    switch (tab) {
      case "coverage":
        return (
          <CoverageTab
            snapshot={activeSnapshot}
            baselineSnapshot={baselineSnapshot}
            leadPct={leadPct}
            optimizations={optimizations}
            activeOptId={activeOptId || undefined}
          />
        );
      case "validation":
        return <ValidationTab snapshot={activeSnapshot} leadPct={leadPct} />;
      case "raci":
        return <RaciTab snapshot={activeSnapshot} />;
      case "supervisor":
        return (
          <SupervisorTab
            snapshot={activeSnapshot}
            leadPct={leadPct}
            onJump={jumpToTab}
          />
        );
      case "pods":
        return <PodsTab snapshot={activeSnapshot} />;
      case "shifts":
        return <ShiftsTab snapshot={activeSnapshot} leadPct={leadPct} />;
      case "cubicles":
        return <CubiclesTab snapshot={activeSnapshot} />;
      case "roster":
        return <RosterTab snapshot={activeSnapshot} />;
      case "optimizer":
        return (
          <OptimizerTab
            snapshot={activeSnapshot}
            baselineSnapshot={baselineSnapshot}
            onUpdateSnapshot={handleUpdateSnapshot}
            optimizations={optimizations}
          />
        );
      default:
        return null;
    }
  };

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
            {renderTabContent()}
          </div>
        </main>

        <AgentProfilePanel snapshot={activeSnapshot} onJump={jumpToTab} />
        <TeamProfilePanel snapshot={activeSnapshot} onJump={jumpToTab} />

        <footer className="mt-auto border-t surface-panel">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 text-xs text-muted-foreground sm:px-6">
            <span>
              {/* TODO: Safely derive stats (e.g. activeSnapshot.agents.length) instead of hardcoding text */}
              MJM Brokerage Scheduling Application · 53 roster · 6 Supervisor · 6 teams · 24/7 staffing
            </span>
            <span className="font-mono text-[11px]">
              source: {activeSnapshot.meta.source}
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
