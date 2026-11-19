import type { RunEvent } from "@/domain/events";
import type { AgentId, DocumentKind, Finding } from "@/domain/types";

export type RunStatus = "idle" | "starting" | "running" | "completed" | "failed";

export interface TaskBar { id: string; agent: AgentId; documentId: string; label: string; start: number; end: number | null; ok: boolean | null }
export interface ToolTick { id: string; agent: AgentId; tool: string; start: number; end: number | null; blocked: boolean }
export interface LogLine { id: string; at: number; agent: AgentId; text: string; findingId: string | null; kind: "note" | "tool" | "flag" }

export interface RunView {
  status: RunStatus;
  runId: string | null;
  model: string | null;
  counts: Record<DocumentKind, number> | null;
  /** Client clock (ms since epoch) when the server's run clock read 0. */
  clientZero: number | null;
  endAt: number | null;
  tasks: TaskBar[];
  tools: ToolTick[];
  extracted: Record<string, string>;
  findings: Finding[];
  log: LogLine[];
  passed: string[];
  error: string | null;
}

export const EMPTY_RUN: RunView = {
  status: "idle", runId: null, model: null, counts: null, clientZero: null, endAt: null,
  tasks: [], tools: [], extracted: {}, findings: [], log: [], passed: [], error: null,
};

export type RunAction =
  | { type: "start"; runId: string }
  | { type: "fail"; error: string }
  | { type: "event"; event: RunEvent; receivedAt: number };

const note = (view: RunView, line: Omit<LogLine, "id">): LogLine[] => [{ ...line, id: `${line.at}-${view.log.length}` }, ...view.log];

function applyEvent(view: RunView, event: RunEvent, receivedAt: number): RunView {
  switch (event.type) {
    case "run.started":
      return { ...view, status: "running", model: event.model, counts: event.counts, clientZero: receivedAt - event.at };
    case "task.started":
      return { ...view, tasks: [...view.tasks, { id: event.taskId, agent: event.agent, documentId: event.documentId, label: event.label, start: event.at, end: null, ok: null }] };
    case "task.finished":
      return { ...view, tasks: view.tasks.map((t) => (t.id === event.taskId ? { ...t, end: event.at, ok: event.ok } : t)) };
    case "tool.started":
      return { ...view, tools: [...view.tools, { id: event.stepId, agent: event.agent, tool: event.tool, start: event.at, end: null, blocked: false }] };
    case "tool.finished":
      return {
        ...view,
        tools: view.tools.map((t) => (t.id === event.stepId ? { ...t, end: event.at, blocked: event.blocked } : t)),
        log: note(view, { at: event.at, agent: "rules", text: `${event.blocked ? "Blocked" : "Ran"} ${event.tool}()`, findingId: null, kind: "tool" }),
      };
    case "invoice.extracted":
      return { ...view, extracted: { ...view.extracted, [event.documentId]: event.invoiceNumber } };
    case "finding.created":
      return {
        ...view,
        findings: [event.finding, ...view.findings],
        log: note(view, { at: event.at, agent: event.finding.raisedBy, text: `Flagged ${event.finding.invoiceNumber}: ${event.finding.title}`, findingId: event.finding.id, kind: "flag" }),
      };
    case "agent.note":
      return { ...view, log: note(view, { at: event.at, agent: event.agent, text: event.text, findingId: null, kind: "note" }) };
    case "run.completed":
      return { ...view, status: "completed", endAt: event.at, passed: event.passed };
    case "run.failed":
      return { ...view, status: "failed", endAt: event.at, error: event.error };
  }
}

export function runReducer(view: RunView, action: RunAction): RunView {
  if (action.type === "start") return { ...EMPTY_RUN, status: "starting", runId: action.runId };
  if (action.type === "fail") return { ...view, status: "failed", error: action.error };
  return applyEvent(view, action.event, action.receivedAt);
}

/** Server-run milliseconds right now, or the final time once the run has ended. */
export function runClock(view: RunView, nowMs: number): number {
  if (view.endAt !== null) return view.endAt;
  return view.clientZero === null ? 0 : Math.max(0, nowMs - view.clientZero);
}
