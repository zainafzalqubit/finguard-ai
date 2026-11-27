import type { RunSummary } from "@/domain/run-summary";

/** The open run lives in the URL (?run=id), so a refresh or a shared link reopens it. */
const RUN_PARAM = "run";

export function runFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get(RUN_PARAM);
}

export function rememberRun(runId: string): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("audit");
  url.searchParams.set(RUN_PARAM, runId);
  window.history.replaceState(null, "", url);
}

/** Saved audits, newest first. Throws with a readable message when they cannot be loaded. */
export async function fetchRuns(): Promise<RunSummary[]> {
  const response = await fetch("/api/runs");
  const body = (await response.json()) as { runs?: RunSummary[]; error?: string };
  if (!response.ok || !body.runs) throw new Error(body.error ?? "Could not load past audits.");
  return body.runs;
}

/** The newest saved run, or null when there is none or the server cannot be reached. */
export async function latestRunId(): Promise<string | null> {
  try {
    const runs = await fetchRuns();
    return runs[0]?.id ?? null;
  } catch (error) {
    console.warn("Could not load saved audits:", error);
    return null;
  }
}
