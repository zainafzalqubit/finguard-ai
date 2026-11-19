import type { CSSProperties } from "react";

import type { Severity } from "@/domain/types";

/** 12345 ms -> "0:12" */
export function clock(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return bytes < 1_048_576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1_048_576).toFixed(1)} MB`;
}

/** Sets --sev, which flags, finding icons and "found" values read their colour from. */
export const severityColor = (severity: Severity | "ok"): CSSProperties => ({ "--sev": `var(--${severity})` }) as CSSProperties;

const TIME = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const DAY = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

/** "Today, 4:37 PM", "Yesterday, 9:02 AM" or "Nov 12, 4:37 PM". */
export function when(epochMs: number, now = Date.now()): string {
  const dayOf = (ms: number): number => Math.floor((ms - new Date(ms).getTimezoneOffset() * 60_000) / 86_400_000);
  const daysAgo = dayOf(now) - dayOf(epochMs);
  const day = daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : DAY.format(epochMs);
  return `${day}, ${TIME.format(epochMs)}`;
}

export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
