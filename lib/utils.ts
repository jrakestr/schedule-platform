import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function pct(v: number, d = 1): string {
  return `${(v * 100).toFixed(d)}%`;
}

export function f0(v: number): string {
  return Math.round(v).toLocaleString();
}

export function f1(v: number): string {
  return Number(v).toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function sum(a: number[]): number {
  return a.reduce((x, y) => x + y, 0);
}

export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
