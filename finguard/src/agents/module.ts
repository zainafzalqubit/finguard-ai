import { initAgentModule, resolveAgentModule } from "@mozaik-ai/core";
import type { Agent } from "@mozaik-ai/core";

import { modelSetup } from "./models";
import type { ModelSetup } from "./models";
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

export interface AgentRuntime {
  team: AgentTeam;
  model: ModelSetup;
}

function moduleReady(): boolean {
  try {
    resolveAgentModule();
    return true;
  } catch {
    return false;
  }
}

// One agent module per server process; hot reload must not initialise it twice. Restart the server after changing .env.local.
const globalStore = globalThis as typeof globalThis & { __finguardRuntime?: Promise<AgentRuntime> };

async function createRuntime(model: ModelSetup): Promise<AgentRuntime> {
  const { createAgent } = resolveAgentModule();
  const make = (id: ModelAgentId): Promise<Agent> =>
    createAgent({ name: id, instruction: INSTRUCTIONS[id], tools: AGENT_TOOLS[id].map((tool) => TOOL_DEFINITIONS[tool]) });
  const [ledger, tally, sentinel] = await Promise.all([make("ledger"), make("tally"), make("sentinel")]);
  return { team: { ledger, tally, sentinel }, model };
}

export function agentRuntime(): Promise<AgentRuntime> {
  if (!moduleReady()) {
    const model = modelSetup();
    initAgentModule({ inferenceRunnerConfig: { supportedModels: model.models } });
    const { registerTool } = resolveAgentModule();
    for (const [name, tool] of Object.entries(TOOLS)) registerTool(name, tool);
    globalStore.__finguardRuntime = createRuntime(model);
  }
  globalStore.__finguardRuntime ??= createRuntime(modelSetup());
  return globalStore.__finguardRuntime;
}
