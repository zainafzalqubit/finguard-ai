import { describe, expect, it } from "vitest";

import { MIN_TICK_GAP_PX, tickMarks, tickStep } from "@/ui/timeline-ticks";

describe("timeline ticks", () => {
  it("keeps 2 s ticks for the 14 s live window", () => {
    expect(tickStep(800 / 14_000)).toBe(2_000);
  });

  it("widens the step for a long run so labels never overlap", () => {
    const pxPerMs = 800 / 240_000;
    const step = tickStep(pxPerMs);
    expect(step).toBe(30_000);
    expect(step * pxPerMs).toBeGreaterThanOrEqual(MIN_TICK_GAP_PX);
  });

  it("aligns marks to the step and covers the window", () => {
    expect(tickMarks(3_000, 12_000, 5_000)).toEqual([0, 5_000, 10_000]);
    expect(tickMarks(0, 10_000, 5_000)).toEqual([0, 5_000, 10_000]);
  });
});
