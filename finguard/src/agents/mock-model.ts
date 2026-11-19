import type { ContextItem, Endpoint, GenerativeModel, InferenceParams, InferenceResult, SemanticEvent } from "@mozaik-ai/core";

import { readLabelledInvoice } from "@/ingest/invoice-layout";

import { DOC_END, DOC_START } from "./prompts";

export const MOCK_MODEL_NAME = "finguard-offline";

const LATENCY_MS = { min: 350, max: 1100 };
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const textOf = (item: ContextItem | undefined): string => (item && "text" in item ? item.text : "");

/** Builds tool arguments from the goal text, the way a careful model would. */
function argumentsFor(tool: string, goal: string): Record<string, unknown> {
  const documentId = goal.match(/documentId "([^"]+)"/)?.[1] ?? "";
  if (tool === "saveInvoice") {
    const text = goal.slice(goal.indexOf(DOC_START) + DOC_START.length, goal.indexOf(DOC_END));
    return { ...readLabelledInvoice(text), documentId };
  }
  return tool === "findUnpaid" ? {} : { documentId };
}

/**
 * Offline stand-in for a real model, so the app runs without an API key.
 * It calls the tool named in the goal once, then summarises the tool's answer.
 * Random latency makes the agents' overlap visible on the timeline.
 */
class OfflineEndpoint implements Endpoint {
  async infer(params: InferenceParams): Promise<InferenceResult> {
    await sleep(LATENCY_MS.min + Math.random() * (LATENCY_MS.max - LATENCY_MS.min));
    const items = params.context.items;
    const toolResult = items.findLast((item) => item.type === "tool_call_result");
    if (toolResult && "result" in toolResult) {
      return { type: "inference_output", items: [{ type: "model_message", text: toolResult.result.text }], rawResponse: null };
    }
    const goal = textOf(items.find((item) => item.type === "user_message"));
    const tool = goal.match(/Use the (\w+) tool/)?.[1];
    if (!tool) return { type: "inference_output", items: [{ type: "model_message", text: "No tool named in the goal." }], rawResponse: null };
    return {
      type: "inference_output",
      items: [{ type: "tool_call", requestId: `call_${crypto.randomUUID()}`, toolName: tool, toolArguments: JSON.stringify(argumentsFor(tool, goal)) }],
      rawResponse: null,
    };
  }

  async *stream(): AsyncIterable<SemanticEvent> {
    throw new Error("The offline model does not stream");
  }
}

export const offlineModel: GenerativeModel = {
  endpoint: new OfflineEndpoint(),
  specification: {
    name: MOCK_MODEL_NAME,
    provider: "finguard",
    supportsReasoningEffort: false,
    supportedReasoningEfforts: [],
    supportsStreaming: false,
    contextWindowSize: 200_000,
    supportedContextItemTypes: ["user_message", "system_message", "developer_message", "model_message", "tool_call", "tool_call_result"],
    maxOutputTokens: 4_000,
    supportsFunctionCalling: true,
    supportsStructuredOutput: true,
  },
};
