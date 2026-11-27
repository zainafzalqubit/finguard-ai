// Turns frames/ + timeline.json into output/finguard-demo.mp4: 1080p60, eased camera zooms,
// captions, the sped-up stretch with a badge, and fades in and out.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import ffmpeg from "ffmpeg-static";

import { renderCaptions } from "./lib/captions.mjs";
import { cameraExpressions } from "./lib/camera.mjs";
import { loadTimeline } from "./lib/timeline.mjs";

const APP = process.env.FINGUARD_URL ?? "http://localhost:3000/";
const FRAMES = resolve("frames");
const OUT = resolve("output");
const W = 1920;
const H = 1080;
const FPS = 60;
const FADE = 0.35;

mkdirSync(OUT, { recursive: true });
const { view, frames, marks, speeds, out, lastT } = loadTimeline(FRAMES);

// 1. Frames with their on-screen durations (variable rate in, constant 60 fps out)
const used = frames.filter((f) => f.t <= lastT);
const lines = ["ffconcat version 1.0"];
used.forEach((f, i) => {
  const next = used[i + 1]?.t ?? lastT;
  lines.push(`file '${join(FRAMES, f.file).replaceAll("\\", "/")}'`, `duration ${Math.max(0.001, out(next) - out(f.t)).toFixed(6)}`);
});
lines.push(`file '${join(FRAMES, used.at(-1).file).replaceAll("\\", "/")}'`);
writeFileSync(join(OUT, "frames.ffconcat"), lines.join("\n"));
const total = out(lastT);

// 2. Captions: each runs until the next caption or captionEnd
const captionMarks = marks.filter((m) => m.type === "caption" || m.type === "captionEnd");
const captions = captionMarks.flatMap((m, i) => (m.type === "caption" ? [{ text: m.text, top: m.top, from: out(m.t), to: out(captionMarks[i + 1]?.t ?? lastT) }] : []));
const badges = speeds.map((s) => ({ text: `Sped up ${s.factor}x`, badge: true, from: out(s.from), to: out(Math.min(s.to, lastT)) }));
const overlays = [...captions, ...badges];
const pngs = await renderCaptions(APP, overlays, OUT);

// 3. Filter graph: retimed frames -> camera -> overlays -> fades
const { zoom, cx, cy } = cameraExpressions(marks.map((m) => ({ ...m, t: out(m.t) })), { view, W, H });
const scaledW = `(2*trunc(${W / 2}*(${zoom})))`;
const scaledH = `(2*trunc(${H / 2}*(${zoom})))`;
const parts = [
  `[0:v]fps=${FPS},scale=w='${scaledW}':h='${scaledH}':eval=frame:flags=lanczos+accurate_rnd,` +
    `crop=${W}:${H}:x='clip((${cx})*${scaledW}/${W}-${W / 2},0,${scaledW}-${W})':y='clip((${cy})*${scaledH}/${H}-${H / 2},0,${scaledH}-${H})',setsar=1[v0]`,
];
overlays.forEach((o, i) => {
  const d = (o.to - o.from).toFixed(3);
  const x = o.badge ? `W-w-40` : `(W-w)/2`;
  const y = o.badge || o.top ? `40` : `H-h-44`;
  parts.push(`[${i + 1}:v]format=rgba,fade=t=in:st=0:d=${FADE}:alpha=1,fade=t=out:st=${Math.max(0, o.to - o.from - FADE).toFixed(3)}:d=${FADE}:alpha=1,setpts=PTS+${o.from.toFixed(3)}/TB[c${i}]`);
  parts.push(`[v${i}][c${i}]overlay=x=${x}:y=${y}:eof_action=pass:enable='between(t,${o.from.toFixed(3)},${(o.from + Number(d)).toFixed(3)})'[v${i + 1}]`);
});
parts.push(`[v${overlays.length}]fade=t=in:st=0:d=0.6,fade=t=out:st=${(total - 0.8).toFixed(3)}:d=0.8,format=yuv420p[out]`);
writeFileSync(join(OUT, "filter.txt"), parts.join(";\n"));

const args = ["-hide_banner", "-y", "-f", "concat", "-safe", "0", "-i", join(OUT, "frames.ffconcat")];
overlays.forEach((o, i) => args.push("-loop", "1", "-framerate", String(FPS), "-t", (o.to - o.from).toFixed(3), "-i", pngs[i].file));
args.push("-filter_complex_script", join(OUT, "filter.txt"), "-map", "[out]", "-r", String(FPS), "-t", total.toFixed(3),
  "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-profile:v", "high", "-movflags", "+faststart", join(OUT, "finguard-demo.mp4"));

console.log(`Rendering ${total.toFixed(1)} s from ${used.length} frames...`);
const result = spawnSync(ffmpeg, args, { stdio: ["ignore", "inherit", "inherit"] });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Done: ${join(OUT, "finguard-demo.mp4")}`);
