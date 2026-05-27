"use client";

import { useCallback, useMemo, useState } from "react";
import {
  mergeBaselineSupervisors,
  normalizeSnapshotPods,
} from "@/lib/data/normalize-snapshot";
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
import { ManualSchedulesTab } from "@/components/tabs/manual-schedules";
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

export function PlatformShell({
  snapshot,
  baselineSnapshot,
  optimizations,
}: PlatformShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [activeOptId] = useQueryState("opt_id", {
    defaultValue: "",
    clearOnDefault: true,
  });

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

  // Derive directly from props so every server-side run switch (?opt_id=)
  // flows to all tabs in the same render — no intermediate useState that
  // would lag a tick behind the new snapshot.
  // Supervisors are not part of CP-SAT overlays — always pull baseline rows.
  const displaySnapshot = useMemo(
    () => mergeBaselineSupervisors(normalizeSnapshotPods(snapshot), baselineSnapshot),
    [snapshot, baselineSnapshot],
  );

  const leadPct = rawLeadPct ?? displaySnapshot.meta.lead_on_work_default;

  const jumpToTab = useCallback(
    async (nextTab: TabId) => {
      await Promise.all([
        setTab(nextTab),
        section !== "call-center" ? setSection("call-center") : Promise.resolve(),
      ]);
    },
    [section, setSection, setTab],
  );

  const renderTabContent = () => {
    if (section === "drivers") {
      return <DriversPlaceholder />;
    }

    switch (tab) {
      case "coverage":
        return (
          <CoverageTab
            snapshot={displaySnapshot}
            baselineSnapshot={baselineSnapshot}
            leadPct={leadPct}
            optimizations={optimizations}
            activeOptId={activeOptId || undefined}
          />
        );
      case "validation":
        return <ValidationTab snapshot={displaySnapshot} leadPct={leadPct} />;
      case "raci":
        return <RaciTab snapshot={displaySnapshot} />;
      case "supervisor":
        return (
          <SupervisorTab
            snapshot={displaySnapshot}
            leadPct={leadPct}
            onJump={jumpToTab}
          />
        );
      case "pods":
        return <PodsTab snapshot={displaySnapshot} />;
      case "shifts":
        return <ShiftsTab snapshot={displaySnapshot} leadPct={leadPct} />;
      case "cubicles":
        return <CubiclesTab snapshot={displaySnapshot} />;
      case "roster":
        return <RosterTab snapshot={displaySnapshot} />;
      case "optimizer":
        return (
          <OptimizerTab
            snapshot={displaySnapshot}
            baselineSnapshot={baselineSnapshot}
            optimizations={optimizations}
          />
        );
      case "manual-schedules":
        return <ManualSchedulesTab />;
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
          snapshot={displaySnapshot}
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

        <AgentProfilePanel snapshot={displaySnapshot} onJump={jumpToTab} />
        <TeamProfilePanel snapshot={displaySnapshot} onJump={jumpToTab} />

        <footer className="mt-auto border-t surface-panel">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 text-xs text-muted-foreground sm:px-6">
            <span>
              MJM Brokerage Scheduling Application · 53 roster · 6 Supervisor · 6 teams · 24/7 staffing
            </span>
            <span className="font-mono text-[11px]">
              {activeOptId
                ? `run: ${activeOptId.slice(0, 8)}…`
                : `source: ${displaySnapshot.meta.source}`}
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
