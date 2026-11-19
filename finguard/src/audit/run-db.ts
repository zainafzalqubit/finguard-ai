import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { TERMINAL_EVENTS } from "@/domain/events";
import type { RunEvent } from "@/domain/events";
import type { RunStatus, RunSummary } from "@/domain/run-summary";

interface RunRow {
  id: string;
  created_at: number;
  status: RunStatus;
  model: string | null;
  invoices: number;
  findings: number;
}

/** Local SQLite file; every run and its full event log, so a refresh or restart loses nothing. */
const DB_PATH = resolve(process.env.FINGUARD_DB ?? "data/finguard.db");
export const INTERRUPTED_ERROR = "The server stopped before this audit finished. Start it again to get a complete result.";

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    model TEXT,
    invoices INTEGER NOT NULL DEFAULT 0,
    findings INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS events (
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    body TEXT NOT NULL,
    PRIMARY KEY (run_id, seq)
  );
  CREATE TABLE IF NOT EXISTS files (
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    bytes BLOB NOT NULL,
    PRIMARY KEY (run_id, name)
  );
`;

// One connection per server process, kept on globalThis so Next.js hot reload reuses it.
const globalDb = globalThis as typeof globalThis & { __finguardDb?: DatabaseSync };

// Reset on every module load, so a hot reload with a changed SCHEMA still applies it to the reused connection.
let schemaApplied = false;

function db(): DatabaseSync {
  const cached = globalDb.__finguardDb;
  if (cached) {
    if (!schemaApplied) cached.exec(SCHEMA);
    schemaApplied = true;
    return cached;
  }
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const conn = new DatabaseSync(DB_PATH);
  conn.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  conn.exec(SCHEMA);
  schemaApplied = true;
  globalDb.__finguardDb = conn;
  closeInterrupted(conn);
  return conn;
}

/** A fresh process has no audits in flight, so any run still marked running was cut off by a restart. */
function closeInterrupted(conn: DatabaseSync): void {
  const open = conn.prepare("SELECT id FROM runs WHERE status = 'running'").all() as unknown as { id: string }[];
  for (const { id } of open) {
    const last = conn.prepare("SELECT body, seq FROM events WHERE run_id = ? ORDER BY seq DESC LIMIT 1").get(id) as unknown as { body: string; seq: number } | undefined;
    const at = last ? (JSON.parse(last.body) as RunEvent).at : 0;
    appendEvent(id, (last?.seq ?? -1) + 1, { type: "run.failed", error: INTERRUPTED_ERROR, at }, conn);
  }
}

export function insertRun(id: string, createdAt: number): void {
  db().prepare("INSERT INTO runs (id, created_at) VALUES (?, ?)").run(id, createdAt);
}

export function appendEvent(runId: string, seq: number, event: RunEvent, conn: DatabaseSync = db()): void {
  conn.prepare("INSERT INTO events (run_id, seq, body) VALUES (?, ?, ?)").run(runId, seq, JSON.stringify(event));
  // Keep the summary columns current so the run list never has to read whole event logs.
  if (event.type === "run.started") conn.prepare("UPDATE runs SET model = ?, invoices = ? WHERE id = ?").run(event.model, event.counts.invoices, runId);
  if (event.type === "finding.created") conn.prepare("UPDATE runs SET findings = findings + 1 WHERE id = ?").run(runId);
  if (TERMINAL_EVENTS.includes(event.type)) conn.prepare("UPDATE runs SET status = ? WHERE id = ?").run(event.type === "run.completed" ? "completed" : "failed", runId);
}

export function hasRun(runId: string): boolean {
  return db().prepare("SELECT 1 FROM runs WHERE id = ?").get(runId) !== undefined;
}

export function loadEvents(runId: string): RunEvent[] {
  const rows = db().prepare("SELECT body FROM events WHERE run_id = ? ORDER BY seq").all(runId) as unknown as { body: string }[];
  return rows.map((row) => JSON.parse(row.body) as RunEvent);
}

export function listRuns(limit: number): RunSummary[] {
  const rows = db().prepare("SELECT id, created_at, status, model, invoices, findings FROM runs ORDER BY created_at DESC LIMIT ?").all(limit) as unknown as RunRow[];
  return rows.map((row) => ({ id: row.id, createdAt: row.created_at, status: row.status, model: row.model, invoices: row.invoices, findings: row.findings }));
}

/** Keeps the files an audit read, so its invoices can be previewed later. */
export function saveFiles(runId: string, files: { name: string; bytes: Uint8Array }[]): void {
  const insert = db().prepare("INSERT OR REPLACE INTO files (run_id, name, bytes) VALUES (?, ?, ?)");
  for (const file of files) insert.run(runId, file.name, file.bytes);
}

export function loadFile(runId: string, name: string): Uint8Array | null {
  const row = db().prepare("SELECT bytes FROM files WHERE run_id = ? AND name = ?").get(runId, name) as unknown as { bytes: Uint8Array } | undefined;
  return row?.bytes ?? null;
}
