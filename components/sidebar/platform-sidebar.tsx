"use client";

import { useEffect } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useQueryState, parseAsStringEnum } from "nuqs";
import { Button } from "@/components/ui/button";
import { TAB_IDS, TAB_LABELS, type TabId } from "@/components/tab-ids";
import {
  OPTIMIZER_SECTIONS,
  OPTIMIZER_SECTION_LABELS,
  type OptimizerSection,
} from "@/components/nav/optimizer-section";
import { cn } from "@/lib/utils";

interface PlatformSidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

export function PlatformSidebar({
  activeTab,
  onTabChange,
  mobileOpen,
  onMobileOpenChange,
}: PlatformSidebarProps) {
  const [section, setSection] = useQueryState<OptimizerSection>(
    "section",
    parseAsStringEnum<OptimizerSection>([...OPTIMIZER_SECTIONS]).withDefault(
      "call-center",
    ),
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = () => {
      if (mq.matches) onMobileOpenChange(false);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [onMobileOpenChange]);

  const handleSectionChange = (next: OptimizerSection) => {
    void setSection(next);
    onMobileOpenChange(false);
  };

  const handleTabChange = (tab: TabId) => {
    onTabChange(tab);
    onMobileOpenChange(false);
  };

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => onMobileOpenChange(false)}
        />
      )}

      <aside
        className={cn(
          "platform-sidebar fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-zinc-800/80 bg-zinc-950 text-zinc-300 transition-transform duration-200 lg:static lg:translate-x-0 lg:shrink-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-zinc-800/80 px-4">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Optimizer
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 lg:hidden"
            onClick={() => onMobileOpenChange(false)}
            aria-label="Close sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-3">
          <div
            className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-900 p-1"
            role="tablist"
            aria-label="Optimizer section"
          >
            {OPTIMIZER_SECTIONS.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={section === id}
                onClick={() => handleSectionChange(id)}
                className={cn(
                  "rounded-md px-2 py-2 text-xs font-medium transition-colors",
                  section === id
                    ? "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200",
                )}
              >
                {OPTIMIZER_SECTION_LABELS[id]}
              </button>
            ))}
          </div>
        </div>

        {section === "call-center" && (
          <nav
            className="flex-1 overflow-y-auto px-2 pb-4"
            aria-label="Call center views"
          >
            <ul className="space-y-0.5">
              {TAB_IDS.map((id) => {
                const active = activeTab === id;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => handleTabChange(id)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex w-full items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-amber-500/10 text-amber-400 ring-1 ring-inset ring-amber-500/25"
                          : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
                      )}
                    >
                      {TAB_LABELS[id]}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

        {section === "drivers" && (
          <div className="flex-1 px-4 pb-4">
            <p className="text-xs leading-relaxed text-zinc-500">
              Driver scheduling tools will appear here when configured.
            </p>
          </div>
        )}
      </aside>
    </>
  );
}

export function SidebarToggle({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="h-9 w-9 shrink-0 lg:hidden"
      onClick={() => onOpenChange(!open)}
      aria-label={open ? "Close sidebar" : "Open sidebar"}
      aria-expanded={open}
    >
      {open ? (
        <PanelLeftClose className="h-4 w-4" />
      ) : (
        <PanelLeftOpen className="h-4 w-4" />
      )}
    </Button>
  );
}
