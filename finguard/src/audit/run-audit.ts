import { agentRuntime } from "@/agents/module";
import { GOALS } from "@/agents/prompts";
import { runAgentTask } from "@/agents/run-agent";
import { runContext } from "@/agents/run-context";
import type { AgentTask } from "@/agents/run-agent";
import type { AuditInput } from "@/ingest/load-upload";

import { AuditState } from "./audit-state";
import { emit } from "./run-store";

/**
 * The pipeline: Ledger reads invoices one by one. As each one is saved, Tally and Sentinel
 * start on it at once while Ledger moves on, so all three agents work at the same time.
 */
export async function runAudit(runId: string, input: AuditInput): Promise<void> {
  const send = (event: Parameters<typeof emit>[1]): void => emit(runId, event);
  const state = new AuditState(input.books, (finding) => send({ type: "finding.created", finding }));

  await runContext.run({ runId, state, emit: send }, async () => {
    try {
      const { team, model: setup } = await agentRuntime();
      const model = setup.name;
      const task = (agentId: keyof typeof team, documentId: string | null, label: string, goal: string): AgentTask =>
        ({ agent: team[agentId], agentId, documentId, label, goal, model });

      send({ type: "run.started", model: setup.label, counts: input.counts });
      const checks: Promise<boolean>[] = [];
      for (const doc of input.documents) {
        await runAgentTask(task("ledger", doc.documentId, doc.documentId, GOALS.read(doc.documentId, doc.text)));
        const invoice = state.invoice(doc.documentId);
        if (!invoice) continue;
        send({ type: "invoice.extracted", documentId: doc.documentId, invoiceNumber: invoice.invoiceNumber });
        checks.push(
          runAgentTask(task("tally", doc.documentId, invoice.invoiceNumber, GOALS.payments(doc.documentId))),
          runAgentTask(task("sentinel", doc.documentId, invoice.invoiceNumber, GOALS.risk(doc.documentId))),
        );
      }
      await Promise.all(checks);
      await runAgentTask(task("tally", null, "Unpaid check", GOALS.unpaid()));

      const unread = input.documents.filter((doc) => !state.invoice(doc.documentId)).map((doc) => doc.documentId);
      const passed = state.allInvoices().filter((i) => !state.hasFindings(i.documentId)).map((i) => i.invoiceNumber);
      if (unread.length > 0) send({ type: "agent.note", agent: "ledger", text: `Could not read: ${unread.join(", ")}` });
      send({ type: "run.completed", passed });
    } catch (error) {
      send({ type: "run.failed", error: error instanceof Error ? error.message : String(error) });
    }
  });
}
