// Maps the recording clock to the video clock, so the renderer and the voice-over agree on every time.
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Loads frames/timeline.json; `out(t)` turns a recording timestamp into seconds of finished video. */
export function loadTimeline(framesDir) {
  const { view, frames, marks } = JSON.parse(readFileSync(join(framesDir, "timeline.json"), "utf8"));
  const t0 = frames[0].t;
  // Sped-up stretches (a long Gemini run), on the recording clock
  const speeds = marks.filter((m) => m.type === "speed").map((m) => {
    const end = marks.find((e) => e.type === "speedEnd" && e.t > m.t);
    return { from: m.t, to: end?.t ?? Infinity, factor: m.factor };
  });
  const out = (t) => speeds.reduce((acc, s) => acc - Math.max(0, Math.min(t, s.to) - s.from) * (1 - 1 / s.factor), t - t0);
  const endMark = marks.find((m) => m.type === "end");
  const lastT = endMark ? endMark.t + 0.6 : frames.at(-1).t;
  return { view, frames, marks, speeds, out, lastT };
}
