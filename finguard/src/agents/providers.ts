import { supportedModels } from "@mozaik-ai/core";
import type { GenerativeModel } from "@mozaik-ai/core";

import type { ModelOption, ProviderId } from "@/domain/models";

import { geminiModel } from "./gemini-model";
import { MOCK_MODEL_NAME, offlineModel } from "./mock-model";
import { openRouterModel } from "./openrouter-model";

export type { ModelOption, ProviderId } from "@/domain/models";

interface ProviderSpec {
  id: ProviderId;
  label: string;
  /** Env var holding the API key; null for the offline model. */
  keyEnv: string | null;
  /** Env var that overrides the model, e.g. GEMINI_MODEL=gemini-3.5-flash. */
  modelEnv: string | null;
  defaultModel: string;
  /** Our own Mozaik model for this provider: OpenRouter is not bundled, and Gemini needs thought signatures kept. */
  register?: (model: string, key: string) => GenerativeModel;
}

/**
 * Order = automatic preference when FINGUARD_PROVIDER is not set. Defaults are free models only.
 * - Gemini free tier (15 requests/min) completes a sample audit in ~3.5 min. flash-lite, because gemini-3.8-flash and
 *   3.5-flash were queued for minutes on the free tier (19 Nov 2026).
 * - OpenRouter free models allow ~50 requests/day without credits; one audit needs ~60, so it is second.
 */
export const PROVIDERS: ProviderSpec[] = [
  { id: "gemini", label: "Gemini", keyEnv: "GEMINI_API_KEY", modelEnv: "GEMINI_MODEL", defaultModel: "gemini-3.5-flash-lite", register: geminiModel },
  { id: "openrouter", label: "OpenRouter", keyEnv: "OPENROUTER_API_KEY", modelEnv: "OPENROUTER_MODEL", defaultModel: "baidu/ernie-5.5-flash-preview:free", register: openRouterModel },
  { id: "anthropic", label: "Anthropic", keyEnv: "ANTHROPIC_API_KEY", modelEnv: "ANTHROPIC_MODEL", defaultModel: "claude-haiku-4-5" },
  { id: "openai", label: "OpenAI", keyEnv: "OPENAI_API_KEY", modelEnv: "OPENAI_MODEL", defaultModel: "gpt-5.4-mini" },
  { id: "offline", label: "Offline", keyEnv: null, modelEnv: null, defaultModel: MOCK_MODEL_NAME },
];

export interface ProviderSetup {
  options: ModelOption[];
  defaultProvider: ProviderId;
  /** Every model registered with Mozaik. */
  models: GenerativeModel[];
}

/** Plain map so tests can pass a partial environment. */
export type ModelEnv = Readonly<Record<string, string | undefined>>;

const isProviderId = (value: string | undefined): value is ProviderId => PROVIDERS.some((p) => p.id === value);

/**
 * Offers every provider whose key is set, plus Offline. The default is FINGUARD_PROVIDER when it is
 * available, otherwise the first available provider in PROVIDERS order.
 */
export function providerSetup(env: ModelEnv = process.env): ProviderSetup {
  // Our registered models go first: Mozaik picks the first model whose name matches.
  const registered: GenerativeModel[] = [];
  const options: ModelOption[] = [];
  for (const spec of PROVIDERS) {
    const key = spec.keyEnv ? env[spec.keyEnv] : "";
    if (spec.keyEnv && !key) continue;
    const model = (spec.modelEnv && env[spec.modelEnv]) || spec.defaultModel;
    if (spec.register && key) registered.push(spec.register(model, key));
    options.push({ provider: spec.id, label: spec.id === "offline" ? "Offline: built-in model, no API key" : `${spec.label}: ${model}`, model });
  }
  const wanted = env["FINGUARD_PROVIDER"];
  const defaultProvider = isProviderId(wanted) && options.some((o) => o.provider === wanted) ? wanted : (options[0]?.provider ?? "offline");
  return { options, defaultProvider, models: [...registered, ...supportedModels, offlineModel] };
}

/** The option for a requested provider, falling back to the default when it is missing or unavailable. */
export function pickOption(setup: ProviderSetup, requested: string | null | undefined): ModelOption {
  const option = setup.options.find((o) => o.provider === requested) ?? setup.options.find((o) => o.provider === setup.defaultProvider);
  if (!option) throw new Error("No model is available");
  return option;
}
