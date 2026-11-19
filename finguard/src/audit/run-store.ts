import { TERMINAL_EVENTS } from "@/domain/events";
import type { RunEvent, RunEventInput } from "@/domain/events";

import { appendEvent, hasRun, insertRun, loadEvents } from "./run-db";

type Listener = (event: RunEvent) => void;

interface RunRecord {
  id: string;
  startedAt: number;
  events: RunEvent[];
  listeners: Set<Listener>;
}

/** Live runs kept in memory for streaming; older ones are served from the database. */
const MAX_RUNS = 20;

// Kept on globalThis so Next.js hot reload does not lose runs in progress.
const globalStore = globalThis as typeof globalThis & { __finguardRuns?: Map<string, RunRecord> };
const runs = (globalStore.__finguardRuns ??= new Map<string, RunRecord>());

export function createRun(): string {
  const id = crypto.randomUUID().slice(0, 8);
  insertRun(id, Date.now());
  runs.set(id, { id, startedAt: performance.now(), events: [], listeners: new Set() });
  // Drop the oldest runs so a long dev session does not grow without limit.
  for (const oldId of [...runs.keys()].slice(0, Math.max(0, runs.size - MAX_RUNS))) runs.delete(oldId);
  return id;
}

export function emit(runId: string, input: RunEventInput): void {
  const run = runs.get(runId);
  if (!run) throw new Error(`Unknown run ${runId}`);
  const event = { ...input, at: Math.round(performance.now() - run.startedAt) } as RunEvent;
  // Save first: the database is the record a refresh or restart reads back.
  appendEvent(runId, run.events.length, event);
  run.events.push(event);
  for (const listener of run.listeners) listener(event);
}

export function runExists(runId: string): boolean {
  return runs.has(runId) || hasRun(runId);
}

/** Replays every past event, then streams new ones. Returns an unsubscribe function. */
export function subscribe(runId: string, listener: Listener): () => void {
  const run = runs.get(runId);
  if (!run) {
    // Not live in this process: it finished (or was cut off) earlier, so the saved log is the whole run.
    for (const event of loadEvents(runId)) listener(event);
    return () => {};
  }
  for (const event of run.events) listener(event);
  run.listeners.add(listener);
  return () => run.listeners.delete(listener);
}

export function isTerminal(event: RunEvent): boolean {
  return TERMINAL_EVENTS.includes(event.type);
}
