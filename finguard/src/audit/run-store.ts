import { TERMINAL_EVENTS } from "@/domain/events";
import type { RunEvent, RunEventInput } from "@/domain/events";

type Listener = (event: RunEvent) => void;

interface RunRecord {
  id: string;
  startedAt: number;
  events: RunEvent[];
  listeners: Set<Listener>;
}

const MAX_RUNS = 20;

// Kept on globalThis so Next.js hot reload does not lose runs in progress.
const globalStore = globalThis as typeof globalThis & { __finguardRuns?: Map<string, RunRecord> };
const runs = (globalStore.__finguardRuns ??= new Map<string, RunRecord>());

export function createRun(): string {
  const id = crypto.randomUUID().slice(0, 8);
  runs.set(id, { id, startedAt: performance.now(), events: [], listeners: new Set() });
  // Drop the oldest runs so a long dev session does not grow without limit.
  for (const oldId of [...runs.keys()].slice(0, Math.max(0, runs.size - MAX_RUNS))) runs.delete(oldId);
  return id;
}

export function emit(runId: string, input: RunEventInput): void {
  const run = runs.get(runId);
  if (!run) throw new Error(`Unknown run ${runId}`);
  const event = { ...input, at: Math.round(performance.now() - run.startedAt) } as RunEvent;
  run.events.push(event);
  for (const listener of run.listeners) listener(event);
}

export function runExists(runId: string): boolean {
  return runs.has(runId);
}

/** Replays every past event, then streams new ones. Returns an unsubscribe function. */
export function subscribe(runId: string, listener: Listener): () => void {
  const run = runs.get(runId);
  if (!run) throw new Error(`Unknown run ${runId}`);
  for (const event of run.events) listener(event);
  run.listeners.add(listener);
  return () => run.listeners.delete(listener);
}

export function isTerminal(event: RunEvent): boolean {
  return TERMINAL_EVENTS.includes(event.type);
}
