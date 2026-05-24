"use client";

import { useEffect, useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TAB_IDS, TAB_LABELS, type TabId } from "@/components/tab-ids";

interface KeyboardShortcutsProps {
  onJump: (tab: TabId) => void;
  section?: "call-center" | "drivers";
}

// Helper extracted outside component to prevent redeclaration and allow testing
const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
};

// Simple utility to detect MacOS vs Windows/Linux
const getModifierKey = (): string => {
  if (typeof window === "undefined") return "Ctrl";
  return /(Mac|iPhone|iPad|iPod)/i.test(navigator.platform) ? "⌘" : "Ctrl";
};

export function KeyboardShortcuts({
  onJump,
  section = "call-center",
}: KeyboardShortcutsProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [modifierKey, setModifierKey] = useState("Ctrl");

  const onJumpRef = useRef(onJump);
  const sectionRef = useRef(section);
  useEffect(() => {
    onJumpRef.current = onJump;
  }, [onJump]);
  useEffect(() => {
    sectionRef.current = section;
  }, [section]);

  // Set the modifier key client-side only to prevent hydration mismatches
  useEffect(() => {
    setModifierKey(getModifierKey());
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore modified keystrokes (e.g. Cmd+1 should not trigger tab jumps)
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      // Toggle help modal
      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen((open) => !open);
        return;
      }

      // Handle numerical tab jumping safely (call center views only)
      if (/^[1-9]$/.test(e.key) && sectionRef.current === "call-center") {
        const index = parseInt(e.key, 10) - 1;
        if (index < TAB_IDS.length) {
          e.preventDefault();
          onJumpRef.current(TAB_IDS[index]);
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []); // Empty dependency array prevents listener churn

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Shortcuts work anywhere except in text inputs.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          {TAB_IDS.map((id, idx) => (
            <ShortcutRow
              key={id}
              shortcut={String(idx + 1)}
              label={`Go to ${TAB_LABELS[id]}`}
            />
          ))}
          <ShortcutRow shortcut={`${modifierKey}K`} label="Open command palette" />
          <ShortcutRow shortcut="?" label="Show this card" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ShortcutRowProps {
  shortcut: string;
  label: string;
}

function ShortcutRow({ shortcut, label }: ShortcutRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-muted-foreground">{label}</span>
      <kbd className="inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[11px] text-muted-foreground">
        {shortcut}
      </kbd>
    </div>
  );
}
