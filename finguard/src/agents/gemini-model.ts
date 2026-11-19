import { GeminiGenerateContent, supportedModels } from "@mozaik-ai/core";
import type { GenerativeModel, InferenceParams, InferenceResult } from "@mozaik-ai/core";

/**
 * Gemini 3 returns a `thoughtSignature` with each function call and rejects the next request (400) unless it is
 * sent back on that call. Mozaik 5.0.1's Gemini mapper drops it, so this wrapper remembers signatures by tool-call
 * id from each response and puts them back on the matching functionCall parts of the next request.
 */
interface GeminiPart { functionCall?: { id?: string }; thoughtSignature?: string }
interface GeminiContent { parts?: GeminiPart[] }
interface GeminiRequest { contents?: GeminiContent[] }
interface GeminiResponse { candidates?: { content?: GeminiContent }[] }

const MAX_REMEMBERED = 5_000;
const signatures = new Map<string, string>();

function remember(requestId: string, signature: string): void {
  signatures.set(requestId, signature);
  const oldest = signatures.keys().next().value;
  if (signatures.size > MAX_REMEMBERED && oldest !== undefined) signatures.delete(oldest);
}

function withSignatures(endpoint: GeminiGenerateContent): GeminiGenerateContent {
  const base = endpoint.mapper;
  const mapper = Object.create(base) as typeof base;

  mapper.toResponse = (response: GeminiResponse): InferenceResult => {
    const result = base.toResponse(response as never);
    const callParts = (response.candidates?.[0]?.content?.parts ?? []).filter((part) => part.functionCall);
    const callItems = result.items.filter((item) => item.type === "tool_call");
    // Mozaik emits one tool_call item per functionCall part, in the same order.
    callItems.forEach((item, index) => {
      const signature = callParts[index]?.thoughtSignature;
      if (signature) remember(item.requestId, signature);
    });
    return result;
  };

  mapper.toRequest = (params: InferenceParams): GeminiRequest => {
    const request = base.toRequest(params) as GeminiRequest;
    for (const content of request.contents ?? []) {
      for (const part of content.parts ?? []) {
        const signature = part.functionCall?.id ? signatures.get(part.functionCall.id) : undefined;
        if (signature) part.thoughtSignature = signature;
      }
    }
    return request;
  };

  endpoint.mapper = mapper;
  return endpoint;
}

/** A Gemini model with thought signatures preserved. Reuses Mozaik's spec for bundled model names. */
export function geminiModel(modelId: string, apiKey: string): GenerativeModel {
  const bundled = supportedModels.find((model) => model.specification.name === modelId);
  const specification = bundled?.specification ?? {
    name: modelId, provider: "google", supportsReasoningEffort: false, supportedReasoningEfforts: [], supportsStreaming: false,
    contextWindowSize: 1_000_000, maxOutputTokens: 8_000, supportsFunctionCalling: true, supportsStructuredOutput: true,
    supportedContextItemTypes: ["user_message", "system_message", "developer_message", "model_message", "tool_call", "tool_call_result", "reasoning"],
  };
  return { endpoint: withSignatures(new GeminiGenerateContent(undefined, { apiKey })), specification };
}
