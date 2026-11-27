import { describe, expect, it } from "vitest";

import { MOCK_MODEL_NAME } from "@/agents/mock-model";
import { pickOption, providerSetup } from "@/agents/providers";
import type { ModelEnv } from "@/agents/providers";

const providers = (env: ModelEnv): string[] => providerSetup(env).options.map((o) => o.provider);
const registered = (env: ModelEnv): string[] => providerSetup(env).models.map((m) => m.specification.name);

describe("provider setup", () => {
  it("offers only the offline model when no key is set", () => {
    const setup = providerSetup({});
    expect(providers({})).toEqual(["offline"]);
    expect(pickOption(setup, null).model).toBe(MOCK_MODEL_NAME);
  });

  it("offers every provider with a key, plus offline", () => {
    expect(providers({ OPENROUTER_API_KEY: "a", GEMINI_API_KEY: "b" })).toEqual(["gemini", "openrouter", "offline"]);
  });

  it("defaults to the first available provider, or FINGUARD_PROVIDER when set", () => {
    expect(providerSetup({ OPENROUTER_API_KEY: "a", GEMINI_API_KEY: "b" }).defaultProvider).toBe("gemini");
    expect(providerSetup({ OPENROUTER_API_KEY: "a", GEMINI_API_KEY: "b", FINGUARD_PROVIDER: "openrouter" }).defaultProvider).toBe("openrouter");
  });

  it("ignores FINGUARD_PROVIDER when that provider has no key", () => {
    expect(providerSetup({ OPENROUTER_API_KEY: "a", FINGUARD_PROVIDER: "gemini" }).defaultProvider).toBe("openrouter");
  });

  it("uses each provider's default model, overridable per provider", () => {
    const setup = providerSetup({ OPENROUTER_API_KEY: "a", GEMINI_API_KEY: "b", OPENROUTER_MODEL: "deepseek/deepseek-v4-flash" });
    expect(pickOption(setup, "gemini").model).toBe("gemini-3.5-flash-lite");
    expect(pickOption(setup, "openrouter").model).toBe("deepseek/deepseek-v4-flash");
  });

  it("defaults to free models only", () => {
    const setup = providerSetup({ OPENROUTER_API_KEY: "a", GEMINI_API_KEY: "b" });
    expect(pickOption(setup, "openrouter").model).toMatch(/:free$/);
    expect(pickOption(setup, "gemini").model).toBe("gemini-3.5-flash-lite");
  });

  it("registers the chosen OpenRouter and Gemini models with Mozaik", () => {
    const env = { OPENROUTER_API_KEY: "a", GEMINI_API_KEY: "b" };
    expect(registered(env)).toContain("baidu/ernie-5.5-flash-preview:free");
    expect(registered(env)).toContain("gemini-3.5-flash-lite");
  });

  it("falls back to the default when a run asks for an unavailable provider", () => {
    const setup = providerSetup({ GEMINI_API_KEY: "b" });
    expect(pickOption(setup, "openrouter").provider).toBe("gemini");
  });

  it("never puts a key in the options sent to the browser", () => {
    const json = JSON.stringify(providerSetup({ OPENROUTER_API_KEY: "secret-1", GEMINI_API_KEY: "secret-2" }).options);
    expect(json).not.toContain("secret");
  });
});
