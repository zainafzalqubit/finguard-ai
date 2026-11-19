import { agentRuntime } from "@/agents/module";
import { pickOption } from "@/agents/providers";
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
/** `provider` picks the model for this run (e.g. "gemini"); unknown or unavailable falls back to the default. */
export async function runAudit(runId: string, input: AuditInput, provider?: string | null): Promise<void> {
  const send = (event: Parameters<typeof emit>[1]): void => emit(runId, event);
  const state = new AuditState(input.books, (finding) => send({ type: "finding.created", finding }));

  await runContext.run({ runId, state, emit: send }, async () => {
    try {
      const { team, providers } = await agentRuntime();
      const option = pickOption(providers, provider);
      const model = option.model;
      const task = (agentId: keyof typeof team, documentId: string | null, label: string, goal: string): AgentTask =>
        ({ agent: team[agentId], agentId, documentId, label, goal, model });

      send({ type: "run.started", model: option.label, counts: input.counts });
      // Any document whose read or checks did not finish. It is never reported as passed.
      const unfinished = new Set<string>();
      const track = (documentId: string, work: Promise<boolean>): Promise<void> =>
        work.then((ok) => { if (!ok) unfinished.add(documentId); });

      const checks: Promise<void>[] = [];
      for (const doc of input.documents) {
        await runAgentTask(task("ledger", doc.documentId, doc.documentId, GOALS.read(doc.documentId, doc.text)));
        const invoice = state.invoice(doc.documentId);
        if (!invoice) {
          unfinished.add(doc.documentId);
          continue;
        }
        send({ type: "invoice.extracted", documentId: doc.documentId, invoiceNumber: invoice.invoiceNumber });
        checks.push(
          track(doc.documentId, runAgentTask(task("tally", doc.documentId, invoice.invoiceNumber, GOALS.payments(doc.documentId)))),
          track(doc.documentId, runAgentTask(task("sentinel", doc.documentId, invoice.invoiceNumber, GOALS.risk(doc.documentId)))),
        );
      }
      await Promise.all(checks);
      const unpaidChecked = await runAgentTask(task("tally", null, "Unpaid check", GOALS.unpaid()));
      // Without the unpaid check no invoice is fully cleared.
      if (!unpaidChecked) for (const doc of input.documents) unfinished.add(doc.documentId);

      const passed = state.allInvoices().filter((i) => !unfinished.has(i.documentId) && !state.hasFindings(i.documentId)).map((i) => i.invoiceNumber);
      const incomplete = input.documents.map((doc) => doc.documentId).filter((id) => unfinished.has(id));
      send({ type: "run.completed", passed, incomplete });
    } catch (error) {
      send({ type: "run.failed", error: error instanceof Error ? error.message : String(error) });
    }
  });
}
