import { MODEL_AGENTS } from "@/domain/agents";
import type { AgentId, Finding, Severity } from "@/domain/types";

import type { RunView, TaskBar } from "./run-view";

export type SlipState = "" | "reading" | "checking" | "clean" | Severity;

/** Ledger tasks define the invoice order shown in the slips and documents. */
export function invoiceDocuments(view: RunView): string[] {
  return view.tasks.filter((t) => t.agent === "ledger").map((t) => t.documentId);
}

export function worstSeverity(findings: Finding[]): Severity | null {
  if (findings.some((f) => f.severity === "high")) return "high";
  return findings.length ? "medium" : null;
}

export function slipState(view: RunView, documentId: string): SlipState {
  const flagged = worstSeverity(view.findings.filter((f) => f.documentId === documentId));
  if (flagged) return flagged;
  // A document whose checks did not finish is never shown as clean.
  if (view.incomplete.includes(documentId)) return "";
  const own = view.tasks.filter((t) => t.documentId === documentId);
  if (own.some((t) => t.agent === "ledger" && t.end === null)) return "reading";
  if (!view.extracted[documentId]) return "";
  const checks = own.filter((t) => t.agent !== "ledger");
  return checks.length < 2 || checks.some((t) => t.end === null) ? "checking" : "clean";
}

export interface AgentStatus { text: string; led: "" | "busy" | "on" }

const DOING: Record<AgentId, string> = { ledger: "Reading", tally: "Matching", sentinel: "Checking", rules: "Running" };

export function agentStatus(view: RunView, agent: AgentId): AgentStatus {
  if (view.status === "idle" || view.status === "starting") return { text: view.status === "starting" ? "Getting ready" : "Waiting for an audit", led: "" };
  if (agent === "rules") {
    const active = view.tools.find((t) => t.end === null);
    return active ? { text: `${DOING.rules} ${active.tool}`, led: "busy" } : { text: view.status === "running" ? "Waiting for a call" : "Finished", led: view.status === "running" ? "" : "on" };
  }
  const own = view.tasks.filter((t) => t.agent === agent);
  const active = own.find((t) => t.end === null);
  if (active) return { text: `${DOING[agent]} ${active.label}`, led: "busy" };
  if (view.status !== "running") return { text: own.length ? "Finished" : "Did not run", led: own.length ? "on" : "" };
  return { text: own.length ? "Waiting for the next invoice" : "Waiting for an invoice", led: "" };
}

export function workingCount(view: RunView): number {
  return MODEL_AGENTS.filter((agent) => view.tasks.some((t) => t.agent === agent && t.end === null)).length;
}

/** Finding raised on this task's document by this task's agent, if any (drives the flag dot on bars). */
export function findingForTask(view: RunView, task: TaskBar): Finding | undefined {
  return view.findings.find((f) => f.raisedBy === task.agent && f.documentId === task.documentId)
    ?? (task.documentId === "all" ? view.findings.find((f) => f.raisedBy === task.agent && f.ruleId === "UNPAID_INVOICE") : undefined);
}
