import type { AgentId, DocumentKind, Finding } from "./types";

/** `at` is milliseconds since the run started, measured on the server. */
interface Timed { at: number }

export type RunEvent =
  | (Timed & { type: "run.started"; model: string; counts: Record<DocumentKind, number> })
  | (Timed & { type: "task.started"; taskId: string; agent: AgentId; documentId: string; label: string })
  | (Timed & { type: "task.finished"; taskId: string; agent: AgentId; documentId: string; ok: boolean })
  | (Timed & { type: "tool.started"; stepId: string; agent: AgentId; tool: string })
  | (Timed & { type: "tool.finished"; stepId: string; agent: AgentId; tool: string; blocked: boolean })
  | (Timed & { type: "invoice.extracted"; documentId: string; invoiceNumber: string })
  | (Timed & { type: "finding.created"; finding: Finding })
  | (Timed & { type: "agent.note"; agent: AgentId; text: string })
  /** passed: invoice numbers every check cleared. incomplete: documents some check could not finish (never reported as passed). */
  | (Timed & { type: "run.completed"; passed: string[]; incomplete: string[] })
  | (Timed & { type: "run.failed"; error: string });

export type RunEventType = RunEvent["type"];

/** Event payload without the timestamp; the run store stamps it. */
export type RunEventInput = RunEvent extends infer E ? (E extends RunEvent ? Omit<E, "at"> : never) : never;

export const TERMINAL_EVENTS: RunEventType[] = ["run.completed", "run.failed"];
