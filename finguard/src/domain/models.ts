// Model choice types shared by the server (provider registry) and the dashboard (model selector).

export type ProviderId = "openrouter" | "gemini" | "anthropic" | "openai" | "offline";

/** What the dashboard may show: the provider and model name, never a key. */
export interface ModelOption {
  provider: ProviderId;
  label: string;
  model: string;
}
