/** Waits between attempts when the provider is rate limiting or briefly overloaded: 2s, 4s, 8s, 16s, then 30s. */
export const RATE_LIMIT_RETRY = { attempts: 10, firstDelayMs: 2_000, maxDelayMs: 30_000, maxHintMs: 65_000 } as const;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
/** Daily caps: waiting minutes will not help. Per-minute limits (Gemini "PerMinute", OpenRouter "per-min") will. */
const DAILY_QUOTA = /per.?day|PerDay|daily/i;
const TRANSIENT = /\b(429|503)\b|rate.?limit|RESOURCE_EXHAUSTED|UNAVAILABLE|high demand|overloaded/i;

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * A short-term problem worth waiting out: 429 rate limits, per-minute quotas and 503 "high demand".
 * Daily quotas fail at once with the provider's message.
 */
export function isRetryable(error: unknown): boolean {
  const message = messageOf(error);
  if (DAILY_QUOTA.test(message)) return false;
  const status = typeof error === "object" && error !== null && "status" in error ? (error as { status: unknown }).status : undefined;
  return status === 429 || status === 503 || TRANSIENT.test(message);
}

/** The wait the provider asked for, e.g. Gemini's "Please retry in 30.9s"; null when it did not say. */
export function suggestedDelayMs(error: unknown): number | null {
  const seconds = messageOf(error).match(/retry in ([\d.]+)\s*s|"retryDelay":\s*"(\d+)s"/i);
  const value = Number(seconds?.[1] ?? seconds?.[2]);
  return Number.isFinite(value) && value > 0 ? Math.min(RATE_LIMIT_RETRY.maxHintMs, value * 1000) : null;
}

export function retryDelay(attempt: number): number {
  const jitter = Math.random() * 500;
  return Math.min(RATE_LIMIT_RETRY.maxDelayMs, RATE_LIMIT_RETRY.firstDelayMs * 2 ** attempt) + jitter;
}

/** One readable line from a provider error (they often arrive as a whole JSON body). */
export function shortError(error: unknown): string {
  const message = messageOf(error);
  try {
    const parsed = JSON.parse(message.slice(message.indexOf("{"))) as { error?: { message?: string } };
    if (parsed.error?.message) return parsed.error.message.split("\n")[0]?.slice(0, 200) ?? message;
  } catch {
    // Not JSON; fall through to the plain message.
  }
  return message.split("\n")[0]?.slice(0, 200) ?? message;
}

/** Runs `work`; on a rate limit or brief overload waits (as long as the provider asks) and tries again. */
export async function withRateLimitRetry<T>(work: () => Promise<T>, onWait: (delayMs: number, attempt: number) => void): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await work();
    } catch (error) {
      if (!isRetryable(error) || attempt + 1 >= RATE_LIMIT_RETRY.attempts) throw error;
      const delay = Math.max(retryDelay(attempt), suggestedDelayMs(error) ?? 0);
      onWait(delay, attempt + 1);
      await sleep(delay);
    }
  }
}
