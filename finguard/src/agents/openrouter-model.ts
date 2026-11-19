import { OpenAIChatCompletions } from "@mozaik-ai/core";
import type { GenerativeModel } from "@mozaik-ai/core";

/** OpenRouter speaks the OpenAI Chat Completions dialect, which Mozaik's generic adapter supports. */
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/** Cheap, fast and good at tool calling. Override with FINGUARD_MODEL (any OpenRouter model id with tool support). */
export const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-haiku-5.5";

/** Registers one OpenRouter model id (e.g. "anthropic/claude-haiku-5.5") as a Mozaik model. */
export function openRouterModel(modelId: string, apiKey: string): GenerativeModel {
  return {
    endpoint: new OpenAIChatCompletions(undefined, { baseURL: OPENROUTER_BASE_URL, apiKey }),
    specification: {
      name: modelId,
      provider: "openrouter",
      supportsReasoningEffort: false,
      supportedReasoningEfforts: [],
      supportsStreaming: false,
      contextWindowSize: 128_000,
      // "reasoning" is listed because some models return reasoning items, which go back into the context.
      supportedContextItemTypes: ["user_message", "system_message", "developer_message", "model_message", "tool_call", "tool_call_result", "reasoning"],
      maxOutputTokens: 4_000,
      supportsFunctionCalling: true,
      // The chat-completions mapper does not send structured-output settings; FinGuard uses tool arguments instead.
      supportsStructuredOutput: false,
    },
  };
}
