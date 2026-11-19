import { describe, expect, it } from "vitest";

import { MOCK_MODEL_NAME } from "@/agents/mock-model";
import { modelSetup } from "@/agents/models";
import type { ModelEnv } from "@/agents/models";
import { DEFAULT_OPENROUTER_MODEL } from "@/agents/openrouter-model";

const names = (env: ModelEnv): string[] => modelSetup(env).models.map((m) => m.specification.name);

describe("model selection", () => {
  it("runs offline when no key is set", () => {
    expect(modelSetup({}).name).toBe(MOCK_MODEL_NAME);
  });

  it("uses the default OpenRouter model when only an OpenRouter key is set", () => {
    const setup = modelSetup({ OPENROUTER_API_KEY: "test" });
    expect(setup.name).toBe(DEFAULT_OPENROUTER_MODEL);
    expect(setup.label).toBe(`OpenRouter: ${DEFAULT_OPENROUTER_MODEL}`);
    expect(names({ OPENROUTER_API_KEY: "test" })).toContain(DEFAULT_OPENROUTER_MODEL);
  });

  it("registers any OpenRouter model named in FINGUARD_MODEL", () => {
    const env = { OPENROUTER_API_KEY: "test", FINGUARD_MODEL: "deepseek/deepseek-v4-flash" };
    expect(modelSetup(env).name).toBe("deepseek/deepseek-v4-flash");
    expect(names(env)).toContain("deepseek/deepseek-v4-flash");
  });

  it("prefers OpenRouter over a direct Anthropic key", () => {
    expect(modelSetup({ OPENROUTER_API_KEY: "a", ANTHROPIC_API_KEY: "b" }).name).toBe(DEFAULT_OPENROUTER_MODEL);
  });

  it("uses Claude Haiku directly with only an Anthropic key", () => {
    expect(modelSetup({ ANTHROPIC_API_KEY: "b" }).name).toBe("claude-haiku-4-5");
  });
});
