import { AsyncLocalStorage } from "node:async_hooks";

import type { RunEventInput } from "@/domain/events";
import type { AuditState } from "@/audit/audit-state";

export interface RunContext {
  runId: string;
  state: AuditState;
  emit: (event: RunEventInput) => void;
}

// Mozaik registers tools globally, so each tool finds its audit run through this context.
// Stored on globalThis so hot reload keeps one instance shared with the registered tools.
const globalStore = globalThis as typeof globalThis & { __finguardRunContext?: AsyncLocalStorage<RunContext> };
export const runContext = (globalStore.__finguardRunContext ??= new AsyncLocalStorage<RunContext>());

export function currentRun(): RunContext {
  const ctx = runContext.getStore();
  if (!ctx) throw new Error("Tool called outside an audit run");
  return ctx;
}
