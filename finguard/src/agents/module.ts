import { initAgentModule, resolveAgentModule, supportedModels } from "@mozaik-ai/core";
import type { Agent } from "@mozaik-ai/core";

import { MOCK_MODEL_NAME, offlineModel } from "./mock-model";
import { INSTRUCTIONS } from "./prompts";
import type { ModelAgentId } from "./prompts";
import { TOOLS, TOOL_DEFINITIONS } from "./tools";
import type { ToolName } from "./tools";

/** Which tools each agent may call. The breakpoint policy enforces this on every call. */
export const AGENT_TOOLS: Record<ModelAgentId, ToolName[]> = {
  ledger: ["saveInvoice"],
  tally: ["checkPayments", "findUnpaid"],
  sentinel: ["checkRisk"],
};

export type AgentTeam = Record<ModelAgentId, Agent>;

/** FINGUARD_MODEL wins; otherwise a real Claude model when a key exists, else the offline model. */
export function selectedModel(): string {
  return process.env["FINGUARD_MODEL"] ?? (process.env["ANTHROPIC_API_KEY"] ? "claude-haiku-4-5" : MOCK_MODEL_NAME);
}

function moduleReady(): boolean {
  try {
    resolveAgentModule();
    return true;
  } catch {
    return false;
  }
}

// One agent module per server process; hot reload must not initialise it twice.
const globalStore = globalThis as typeof globalThis & { __finguardTeam?: Promise<AgentTeam> };

async function createTeam(): Promise<AgentTeam> {
  const { createAgent } = resolveAgentModule();
  const make = (id: ModelAgentId): Promise<Agent> =>
    createAgent({ name: id, instruction: INSTRUCTIONS[id], tools: AGENT_TOOLS[id].map((tool) => TOOL_DEFINITIONS[tool]) });
  const [ledger, tally, sentinel] = await Promise.all([make("ledger"), make("tally"), make("sentinel")]);
  return { ledger, tally, sentinel };
}

export function agentTeam(): Promise<AgentTeam> {
  if (!moduleReady()) {
    initAgentModule({ inferenceRunnerConfig: { supportedModels: [...supportedModels, offlineModel] } });
    const { registerTool } = resolveAgentModule();
    for (const [name, tool] of Object.entries(TOOLS)) registerTool(name, tool);
    globalStore.__finguardTeam = undefined;
  }
  globalStore.__finguardTeam ??= createTeam();
  return globalStore.__finguardTeam;
}
