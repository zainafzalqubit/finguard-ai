import { afterEach, describe, expect, it, vi } from "vitest";

import { RATE_LIMIT_RETRY, isRetryable, shortError, suggestedDelayMs, withRateLimitRetry } from "@/agents/retry";

const rateLimited = Object.assign(new Error("429 Rate limit exceeded: free-models-per-min."), { status: 429 });

describe("rate limit retry", () => {
  afterEach(() => vi.useRealTimers());

  it("recognises 429 errors by status or message", () => {
    expect(isRetryable(rateLimited)).toBe(true);
    expect(isRetryable(new Error("Rate limit exceeded"))).toBe(true);
    expect(isRetryable(new Error("Invalid API key"))).toBe(false);
  });

  it("waits out a temporary 503 high-demand error", () => {
    expect(isRetryable(new Error("503 This model is currently experiencing high demand. UNAVAILABLE"))).toBe(true);
  });

  it("waits out Gemini's per-minute quota and uses its suggested delay", () => {
    const perMinute = new Error('{"error":{"code":429,"message":"You exceeded your current quota.\\n* Quota exceeded for metric: free_tier_requests. Please retry in 30.9s.","status":"RESOURCE_EXHAUSTED"}}');
    expect(isRetryable(perMinute)).toBe(true);
    expect(suggestedDelayMs(perMinute)).toBe(30_900);
    expect(shortError(perMinute)).toBe("You exceeded your current quota.");
  });

  it("does not wait out a daily quota", () => {
    expect(isRetryable(Object.assign(new Error("429 Rate limit exceeded: free-models-per-day."), { status: 429 }))).toBe(false);
  });

  it("retries after a rate limit and returns the result", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const waits: number[] = [];
    const result = withRateLimitRetry(async () => {
      calls++;
      if (calls < 3) throw rateLimited;
      return "ok";
    }, (delay) => waits.push(delay));
    await vi.runAllTimersAsync();
    await expect(result).resolves.toBe("ok");
    expect(calls).toBe(3);
    expect(waits).toHaveLength(2);
  });

  it("throws other errors at once without retrying", async () => {
    let calls = 0;
    await expect(withRateLimitRetry(async () => {
      calls++;
      throw new Error("Invalid API key");
    }, () => {})).rejects.toThrow("Invalid API key");
    expect(calls).toBe(1);
  });

  it("gives up after the attempt limit", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const result = withRateLimitRetry(async () => {
      calls++;
      throw rateLimited;
    }, () => {});
    const settled = expect(result).rejects.toThrow("429");
    await vi.runAllTimersAsync();
    await settled;
    expect(calls).toBe(RATE_LIMIT_RETRY.attempts);
  });
});
