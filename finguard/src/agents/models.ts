import { supportedModels } from "@mozaik-ai/core";
import type { GenerativeModel } from "@mozaik-ai/core";

import { MOCK_MODEL_NAME, offlineModel } from "./mock-model";
import { DEFAULT_OPENROUTER_MODEL, openRouterModel } from "./openrouter-model";

export interface ModelSetup {
  /** Model name the agents use. */
  name: string;
  /** Shown in the dashboard, e.g. "OpenRouter: anthropic/claude-haiku-5.5". */
  label: string;
  /** Every model registered with Mozaik. */
  models: GenerativeModel[];
}

const ANTHROPIC_DEFAULT = "claude-haiku-4-5";

/** Only the keys this module reads; plain map so tests can pass a partial environment. */
export type ModelEnv = Readonly<Record<string, string | undefined>>;

/**
 * Picks the model from the environment, in this order:
 * 1. OPENROUTER_API_KEY: OpenRouter, using FINGUARD_MODEL or the default OpenRouter model
 * 2. FINGUARD_MODEL: any model bundled with Mozaik (needs that provider's key)
 * 3. ANTHROPIC_API_KEY: Claude Haiku
 * 4. nothing set: the offline model
 */
export function modelSetup(env: ModelEnv = process.env): ModelSetup {
  const bundled = [...supportedModels, offlineModel];
  const openRouterKey = env["OPENROUTER_API_KEY"];
  if (openRouterKey) {
    const name = env["FINGUARD_MODEL"] ?? DEFAULT_OPENROUTER_MODEL;
    return { name, label: `OpenRouter: ${name}`, models: [...bundled, openRouterModel(name, openRouterKey)] };
  }
  const name = env["FINGUARD_MODEL"] ?? (env["ANTHROPIC_API_KEY"] ? ANTHROPIC_DEFAULT : MOCK_MODEL_NAME);
  return { name, label: name === MOCK_MODEL_NAME ? "Offline model (no API key)" : name, models: bundled };
}
