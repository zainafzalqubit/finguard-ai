import { resolveAgentModule } from "@mozaik-ai/core";
import type { Agent, ContextItem, InferenceResult, InstructionRecord, ModelOutputItem, ToolCallItem, ToolCallResult } from "@mozaik-ai/core";

import type { AgentId } from "@/domain/types";

import { shortError, withRateLimitRetry } from "./retry";
import { currentRun } from "./run-context";

const MAX_STEPS = 6;
/** Prefix Mozaik puts on a tool result when the tool threw. */
const TOOL_ERROR_PREFIX = "Error calling tool";

export interface AgentTask {
  agent: Agent;
  agentId: AgentId;
  /** The only document this task may touch; null for whole-run tasks such as the unpaid check. */
  documentId: string | null;
  label: string;
  goal: string;
  model: string;
}

const isToolCall = (item: ModelOutputItem): item is ToolCallItem => item.type === "tool_call";

/**
 * Puts one instruction at the loop's breakpoint, runs it and returns the recorded result.
 * If the provider rate-limits us, the instruction stays pending at the breakpoint, so we simply advance again.
 */
async function runAtBreakpoint(loopId: string, instruction: InstructionRecord, onWait: (delayMs: number) => void): Promise<InstructionRecord> {
  const { setBreakpoint, advanceLoop, getLoop } = resolveAgentModule();
  await setBreakpoint({ loopId, instruction });
  await withRateLimitRetry(() => advanceLoop({ loopId }), onWait);
  const done = (await getLoop(loopId)).completedInstructions.at(-1);
  if (!done?.result) throw new Error(`Loop ${loopId} finished a step without a result`);
  return done;
}

/** Breakpoint policy: the agent may only call its own tools, and only on its assigned document. */
function policyProblem(task: AgentTask, call: ToolCallItem): string | null {
  if (!task.agent.tools.some((tool) => tool.name === call.toolName)) return `${call.toolName} is not one of ${task.agentId}'s tools`;
  if (task.documentId === null) return null;
  try {
    const args = JSON.parse(call.toolArguments) as Record<string, unknown>;
    return args["documentId"] === task.documentId ? null : `tried to use ${String(args["documentId"])} instead of ${task.documentId}`;
  } catch {
    return "sent arguments that are not valid JSON";
  }
}

/** Drives one Mozaik Loop to completion and reports every step as run events. Returns true only if its tool ran and the loop finished. */
export async function runAgentTask(task: AgentTask): Promise<boolean> {
  const { emit, state } = currentRun();
  const raised = (): number => state.findingsBy(task.agentId, task.documentId);
  const raisedBefore = raised();
  const { createLoop, endLoop } = resolveAgentModule();
  const taskId = crypto.randomUUID();
  const documentId = task.documentId ?? "all";
  emit({ type: "task.started", taskId, agent: task.agentId, documentId, label: task.label });
  const loop = await createLoop({ agentId: task.agent.id, goal: task.goal });

  const finish = async (ok: boolean, message: string): Promise<boolean> => {
    await endLoop({ loopId: loop.id, message });
    // A raised finding already has its own feed line; repeating the agent's summary would be noise.
    if (!ok || raised() === raisedBefore) emit({ type: "agent.note", agent: task.agentId, text: message });
    emit({ type: "task.finished", taskId, agent: task.agentId, documentId, ok });
    return ok;
  };

  const items: ContextItem[] = [{ type: "system_message", text: task.agent.instruction }, { type: "user_message", text: task.goal }];
  const onWait = (delayMs: number): void =>
    emit({ type: "agent.note", agent: task.agentId, text: `Rate limited: the model provider is busy, retrying in ${Math.round(delayMs / 1000)}s.` });
  // A task only counts as done if its check actually ran; a model that just replies has checked nothing.
  let ranTool = false;

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const inference = await runAtBreakpoint(loop.id, { type: "inference", parameters: { model: task.model, tools: task.agent.tools, context: { items: [...items] } } }, onWait);
      const output = inference.result as InferenceResult;
      items.push(...output.items);
      const calls = output.items.filter(isToolCall);
      if (calls.length === 0) {
        const reply = output.items.map((i) => ("text" in i ? i.text : "")).join(" ").trim();
        return await finish(ranTool, ranTool ? reply : `Replied without running its check: "${reply.slice(0, 120)}"`);
      }

      for (const call of calls) {
        const stepId = crypto.randomUUID();
        emit({ type: "tool.started", stepId, agent: task.agentId, tool: call.toolName });
        const problem = policyProblem(task, call);
        if (problem) {
          emit({ type: "tool.finished", stepId, agent: task.agentId, tool: call.toolName, blocked: true });
          return await finish(false, `Blocked at breakpoint: ${problem}.`);
        }
        const record = await runAtBreakpoint(loop.id, { type: "tool_call", parameters: { toolName: call.toolName, toolArguments: call.toolArguments } }, onWait);
        const toolText = (record.result as ToolCallResult).result;
        // Mozaik turns a tool exception into a result text; that is a failed check, not a completed one.
        if (!toolText.startsWith(TOOL_ERROR_PREFIX)) ranTool = true;
        emit({ type: "tool.finished", stepId, agent: task.agentId, tool: call.toolName, blocked: false });
        items.push({ type: "tool_call_result", requestId: call.requestId, result: { type: "input_text", text: toolText } });
      }
    }
    return await finish(false, "Stopped after too many steps.");
  } catch (error) {
    return await finish(false, `Failed: ${shortError(error)}`);
  }
}
