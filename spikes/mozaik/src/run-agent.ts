import { resolveAgentModule } from "@mozaik-ai/core";
import type { Agent, ContextItem, InferenceResult, InstructionRecord, ModelOutputItem, ToolCallItem, ToolCallResult } from "@mozaik-ai/core";

import type { AgentName } from "./domain.ts";
import type { AuditBus, StepKind } from "./events.ts";

const MAX_STEPS = 6;

interface RunAgentInput {
  agent: Agent;
  name: AgentName;
  goal: string;
  model: string;
  bus: AuditBus;
}

const isToolCall = (item: ModelOutputItem): item is ToolCallItem => item.type === "tool_call";

/** Puts one instruction at the loop's breakpoint, runs it, and returns the recorded result. */
async function runAtBreakpoint(loopId: string, instruction: InstructionRecord): Promise<InstructionRecord> {
  const { setBreakpoint, advanceLoop, getLoop } = resolveAgentModule();
  await setBreakpoint({ loopId, instruction });
  await advanceLoop({ loopId });
  const { completedInstructions } = await getLoop(loopId);
  const done = completedInstructions.at(-1);
  if (!done?.result) throw new Error(`Loop ${loopId} finished a step without a result`);
  return done;
}

async function timed<T>(bus: AuditBus, name: AgentName, kind: StepKind, label: string, work: () => Promise<T>): Promise<T> {
  const id = crypto.randomUUID();
  bus.emit("step.started", { id, agent: name, kind, label, at: bus.now() });
  try {
    return await work();
  } finally {
    bus.emit("step.finished", { id, agent: name, kind, label, at: bus.now() });
  }
}

/**
 * Drives one Mozaik 5 Loop to completion: inference, then any tool calls, then inference again.
 * Every tool call is inspected at its breakpoint before it runs (the app decides, not the model).
 */
export async function runAgent({ agent, name, goal, model, bus }: RunAgentInput): Promise<string> {
  const { createLoop, endLoop } = resolveAgentModule();
  const loop = await createLoop({ agentId: agent.id, goal });
  const allowedTools = new Set(agent.tools.map((tool) => tool.name));
  const items: ContextItem[] = [
    { type: "system_message", text: agent.instruction },
    { type: "user_message", text: goal },
  ];

  for (let step = 0; step < MAX_STEPS; step++) {
    const inference = await timed(bus, name, "inference", "thinking", () =>
      runAtBreakpoint(loop.id, { type: "inference", parameters: { model, tools: agent.tools, context: { items: [...items] } } }));
    const output = inference.result as InferenceResult;
    items.push(...output.items);

    const toolCalls = output.items.filter(isToolCall);
    if (toolCalls.length === 0) {
      const answer = output.items.map((item) => ("text" in item ? item.text : "")).join(" ").trim();
      await endLoop({ loopId: loop.id, message: answer });
      return answer;
    }

    for (const call of toolCalls) {
      // Tool-call breakpoint policy: an agent may only run the tools it was given.
      if (!allowedTools.has(call.toolName)) {
        bus.emit("tool.blocked", { agent: name, toolName: call.toolName });
        await endLoop({ loopId: loop.id, message: `Blocked tool ${call.toolName}` });
        return `Blocked tool ${call.toolName}`;
      }
      const record = await timed(bus, name, "tool_call", call.toolName, () =>
        runAtBreakpoint(loop.id, { type: "tool_call", parameters: { toolName: call.toolName, toolArguments: call.toolArguments } }));
      const result = record.result as ToolCallResult;
      items.push({ type: "tool_call_result", requestId: call.requestId, result: { type: "input_text", text: result.result } });
    }
  }
  await endLoop({ loopId: loop.id, message: "Stopped: step limit reached" });
  return "Stopped: step limit reached";
}
