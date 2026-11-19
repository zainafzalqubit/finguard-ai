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

export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
