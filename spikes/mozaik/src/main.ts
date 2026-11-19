import { initAgentModule, resolveAgentModule, supportedModels } from "@mozaik-ai/core";

import { RAW_INVOICES, money } from "./domain.ts";
import { AuditBus } from "./events.ts";
import { MOCK_MODEL_NAME, mockModel } from "./mock-model.ts";
import { runAgent } from "./run-agent.ts";
import { AuditState } from "./state.ts";
import { TimelineRecorder } from "./timeline.ts";
import { TOOL_DEFINITIONS, createTools } from "./tools.ts";
import type { ToolName } from "./tools.ts";
import type { Agent } from "@mozaik-ai/core";

// MODEL=claude-haiku-4-5 (with ANTHROPIC_API_KEY in .env) runs real inference; default is offline.
const MODEL = process.env["MODEL"] ?? MOCK_MODEL_NAME;

async function main(): Promise<void> {
  initAgentModule({ inferenceRunnerConfig: { supportedModels: [...supportedModels, mockModel] } });
  const { createAgent, registerTool } = resolveAgentModule();

  const state = new AuditState();
  const bus = new AuditBus();
  const timeline = new TimelineRecorder(bus);
  for (const [name, tool] of Object.entries(createTools(state))) registerTool(name, tool);

  const make = (name: string, instruction: string, tool: ToolName): Promise<Agent> =>
    createAgent({ name, instruction: `${instruction} Always use your tool; never do arithmetic yourself.`, tools: [TOOL_DEFINITIONS[tool]] });
  const ledger = await make("Ledger", "You read invoice documents.", "extractInvoice");
  const tally = await make("Tally", "You match invoices to purchase orders and payments.", "matchPayments");
  const sentinel = await make("Sentinel", "You look for fraud risk such as changed bank details.", "checkBankDetails");

  // Pipeline: as soon as Ledger extracts an invoice, Tally and Sentinel start on it, while Ledger moves on.
  const downstream: Promise<string>[] = [];
  bus.on("invoice.extracted", ({ invoiceNumber }) => {
    downstream.push(runAgent({ agent: tally, name: "Tally", goal: `Check payments for ${invoiceNumber}.`, model: MODEL, bus }));
    downstream.push(runAgent({ agent: sentinel, name: "Sentinel", goal: `Check bank details for ${invoiceNumber}.`, model: MODEL, bus }));
  });
  bus.on("tool.blocked", ({ agent, toolName }) => console.warn(`Blocked: ${agent} tried to call ${toolName}`));

  console.log(`Model: ${MODEL}\n`);
  for (const invoiceNumber of Object.keys(RAW_INVOICES)) {
    await runAgent({ agent: ledger, name: "Ledger", goal: `Read invoice ${invoiceNumber}.`, model: MODEL, bus });
    bus.emit("invoice.extracted", { invoiceNumber });
  }
  await Promise.all(downstream);

  console.log(timeline.render());
  console.log(`\nMost agents working at the same moment: ${timeline.maxConcurrentAgents()} of 3`);
  console.log(`Invoices extracted into shared state: ${state.invoices.size}`);
  console.log(`\nFindings (${state.findings.length}):`);
  for (const f of state.findings) {
    const e = f.evidence[0];
    console.log(`  ${f.severity.toUpperCase().padEnd(6)} ${f.ruleId.padEnd(22)} ${f.invoiceNumber}  by ${f.raisedBy}  ${e ? `expected ${e.expected}, found ${e.found}` : ""}`);
  }
  console.log(`\nTotals check: ${[...state.invoices.values()].map((i) => `${i.invoiceNumber} ${money(i.totalCents)}`).join(", ")}`);
}

main().catch((error: unknown) => {
  console.error("Spike failed:", error);
  process.exitCode = 1;
});
