import type { Endpoint, GenerativeModel, InferenceParams, InferenceResult, SemanticEvent } from "@mozaik-ai/core";

export const MOCK_MODEL_NAME = "finguard-mock";

const LATENCY_MS = { min: 300, max: 900 };
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Offline stand-in for a real model so the spike runs without an API key.
 * Behaves like a well-behaved tool-using model: first call its tool, then summarise.
 * Latency is random so concurrency is visible in the timeline.
 */
class MockEndpoint implements Endpoint {
  async infer(params: InferenceParams): Promise<InferenceResult> {
    await sleep(LATENCY_MS.min + Math.random() * (LATENCY_MS.max - LATENCY_MS.min));
    const items = params.context.items;
    const lastResult = [...items].reverse().find((item) => item.type === "tool_call_result");
    const tool = params.tools?.[0];

    if (!lastResult && tool) {
      const goal = items.find((item) => item.type === "user_message");
      const invoiceNumber = goal && "text" in goal ? (goal.text.match(/INV-\d+/)?.[0] ?? "") : "";
      return {
        type: "inference_output",
        items: [{ type: "tool_call", requestId: `call_${crypto.randomUUID()}`, toolName: tool.name, toolArguments: JSON.stringify({ invoiceNumber }) }],
        rawResponse: null,
      };
    }
    const text = lastResult && "result" in lastResult ? lastResult.result.text : "Nothing to do.";
    return { type: "inference_output", items: [{ type: "model_message", text: `Done. ${text}` }], rawResponse: null };
  }

  // eslint-disable-next-line require-yield
  async *stream(): AsyncIterable<SemanticEvent> {
    throw new Error("The mock model does not support streaming");
  }
}

export const mockModel: GenerativeModel = {
  endpoint: new MockEndpoint(),
  specification: {
    name: MOCK_MODEL_NAME,
    provider: "mock",
    supportsReasoningEffort: false,
    supportedReasoningEfforts: [],
    supportsStreaming: false,
    contextWindowSize: 100_000,
    supportedContextItemTypes: ["user_message", "system_message", "developer_message", "model_message", "tool_call", "tool_call_result"],
    maxOutputTokens: 4_000,
    supportsFunctionCalling: true,
    supportsStructuredOutput: true,
  },
};
