import { EventEmitter } from "node:events";

import type { AgentName } from "./domain.ts";

export type StepKind = "inference" | "tool_call";

export interface StepEvent {
  /** Unique per step, so overlapping runs of the same agent never collide. */
  id: string;
  agent: AgentName;
  kind: StepKind;
  label: string;
  at: number;
}

export interface AuditEvents {
  "step.started": [StepEvent];
  "step.finished": [StepEvent];
  "invoice.extracted": [{ invoiceNumber: string }];
  "tool.blocked": [{ agent: AgentName; toolName: string }];
}

/** Typed event bus. In the real app the same events feed the dashboard over SSE. */
export class AuditBus extends EventEmitter<AuditEvents> {
  private readonly startedAt = performance.now();

  now(): number {
    return performance.now() - this.startedAt;
  }
}
