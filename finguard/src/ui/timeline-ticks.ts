/** Tick steps a person reads easily on a clock axis, smallest first. */
const NICE_STEPS_MS = [2_000, 5_000, 10_000, 15_000, 30_000, 60_000, 120_000, 300_000, 600_000, 1_800_000, 3_600_000];
/** Labels like "12:30" need about this much room so neighbours never touch. */
export const MIN_TICK_GAP_PX = 64;

/** Smallest nice step whose labels stay at least MIN_TICK_GAP_PX apart at this zoom. */
export function tickStep(pxPerMs: number): number {
  return NICE_STEPS_MS.find((step) => step * pxPerMs >= MIN_TICK_GAP_PX) ?? NICE_STEPS_MS[NICE_STEPS_MS.length - 1];
}

/** Tick times covering [start, end], aligned to the step so marks do not drift while scrolling. */
export function tickMarks(start: number, end: number, step: number): number[] {
  const first = Math.floor(start / step) * step;
  return Array.from({ length: Math.floor((end - first) / step) + 1 }, (_, i) => first + i * step);
}
