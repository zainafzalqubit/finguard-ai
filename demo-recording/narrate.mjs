// Adds a spoken voice-over to output/finguard-demo.mp4 without touching the picture (video stream is copied).
// Each line starts with its scene and must end before the next one; a line that runs long is sped up slightly.
// Usage: node narrate.mjs
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import ffmpeg from "ffmpeg-static";

import { loadTimeline } from "./lib/timeline.mjs";
import { VOICES } from "./lib/voices.mjs";

const OUT = resolve("output");
const VOICE = process.argv[2] ?? "andrew";
const MAX_TEMPO = 1.12;
const GAP = 0.25;

/** Narration keyed to the recorded scenes: `at` is the caption it starts with (or a fixed time). */
const SCRIPT = [
  { at: 0.4, text: "Meet FinGuard AI, your invoice audit team." },
  { caption: "Drop in invoice PDFs", text: "Start a new audit, and drop in the invoice PDFs, purchase orders, payments, and the vendor list." },
  { caption: "FinGuard sorts every file", text: "FinGuard sorts every file by type. Then pick a model, and start." },
  { caption: "Ledger reads each invoice", text: "Three agents work at the same time. Ledger reads each invoice. As soon as it is saved, Tally matches it to the purchase order and payments, and Sentinel checks for duplicates and changed bank details." },
  { caption: "Findings arrive", text: "Findings arrive as the agents work, and each one is decided by a coded rule, not by the AI. On the free Gemini tier this takes a few minutes, so it plays eight times faster." },
  { caption: "Every finding shows", text: "Here, the bank account on the invoice does not match the vendor list, and you see both values side by side." },
  { caption: "Open the exact invoice", text: "You can open the exact invoice the agent read, and check it yourself." },
  { caption: "Invoices that pass", text: "Clean invoices are listed too." },
  { caption: "Every audit is saved", text: "And every audit is saved on your computer, so you can replay it any time." },
  { mark: "captionEnd", text: "AI reads and explains. Code decides." },
];

const { marks, out, lastT } = loadTimeline(resolve("frames"));
const videoEnd = out(lastT);
const startOf = (line) => {
  if (line.at !== undefined) return line.at;
  const m = marks.find((x) => (line.mark ? x.type === line.mark : x.type === "caption" && x.text.startsWith(line.caption)));
  if (!m) throw new Error(`No scene for: ${line.text}`);
  return out(m.t) + 0.3;
};

const run = (args) => {
  const r = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr);
  return r;
};
const duration = (file) => Number(/Duration: (\d+):(\d+):([\d.]+)/.exec(spawnSync(ffmpeg, ["-hide_banner", "-i", file], { encoding: "utf8" }).stderr).slice(1).reduce((s, v, i) => s + Number(v) * [3600, 60, 1][i], 0));

const dir = join(OUT, `voice-${VOICE}`);
mkdirSync(dir, { recursive: true });
const speak = await VOICES[VOICE]();
const starts = SCRIPT.map(startOf);
/** Reuses a line's audio while its text is unchanged, so a flaky online voice only re-fetches what failed. */
const cached = async (text, base) => {
  const note = `${base}.txt`;
  const audio = readdirSync(dir).map((f) => join(dir, f)).find((f) => f.startsWith(`${base}.`) && /\.(mp3|wav)$/.test(f));
  if (audio && existsSync(note) && readFileSync(note, "utf8") === text) return audio;
  const file = await speak(text, base);
  writeFileSync(note, text);
  return file;
};
const clips = [];
const tooLong = [];
for (const [i, line] of SCRIPT.entries()) {
  const raw = await cached(line.text, join(dir, `line-${i}`));
  const room = (starts[i + 1] ?? videoEnd) - starts[i] - GAP;
  const length = duration(raw);
  const tempo = Math.max(1, length / room);
  if (tempo > MAX_TEMPO) tooLong.push(`Line ${i} needs ${length.toFixed(1)} s but its scene has ${room.toFixed(1)} s: shorten it`);
  console.log(`${starts[i].toFixed(1)} s  ${length.toFixed(1)} s / ${room.toFixed(1)} s${tempo > 1 ? `  (x${tempo.toFixed(2)})` : ""}  ${line.text}`);
  clips.push({ file: raw, start: starts[i], tempo });
}
if (tooLong.length > 0) throw new Error(tooLong.join(" | "));

// One track: each clip delayed to its scene, mixed, then normalised to -16 LUFS (typical for online video).
const inputs = clips.flatMap((c) => ["-i", c.file]);
const chains = clips.map((c, i) => `[${i}:a]aresample=48000,${c.tempo > 1 ? `atempo=${c.tempo.toFixed(3)},` : ""}adelay=${Math.round(c.start * 1000)}:all=1[a${i}]`);
const mix = `${clips.map((_, i) => `[a${i}]`).join("")}amix=inputs=${clips.length}:normalize=0,apad,atrim=0:${videoEnd.toFixed(3)},loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,aformat=channel_layouts=stereo[voice]`;
const track = join(dir, "voice.m4a");
run([...inputs, "-filter_complex", [...chains, mix].join(";"), "-map", "[voice]", "-c:a", "aac", "-b:a", "192k", track]);

const video = join(OUT, "finguard-demo.mp4");
const result = join(OUT, `finguard-demo-voice-${VOICE}.mp4`);
run(["-i", video, "-i", track, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "copy", "-shortest", "-movflags", "+faststart", result]);
console.log(`Done: ${result}`);
