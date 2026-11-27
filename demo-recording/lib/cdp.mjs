// Minimal DevTools Protocol client for a headless Edge window.
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9341;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Launches Edge at a CSS viewport and device scale, returns { send, on, close }. */
// Render with the real GPU (D3D11): blurred backdrops and glass then stay at 60 fps instead of stalling on the CPU.
const GPU_FLAGS = ["--use-angle=d3d11", "--enable-gpu-rasterization", "--ignore-gpu-blocklist"];

export async function launch({ width, height, scale, gpu = true }) {
  const edge = spawn(EDGE, [
    "--headless=new", ...(gpu ? GPU_FLAGS : []), "--no-first-run", "--hide-scrollbars", "--force-color-profile=srgb",
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(tmpdir(), "finguard-demo-edge")}`,
    `--window-size=${width},${height}`, "about:blank",
  ], { stdio: "ignore" });

  let targets;
  for (let i = 0; i < 60 && !targets; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); } catch { await sleep(250); }
  }
  if (!targets) throw new Error("Edge did not start");
  const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));

  let id = 0;
  const pending = new Map();
  const handlers = new Map();
  ws.addEventListener("message", (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} ${msg.error.data ?? ""}`)); else resolve(msg.result);
    }
    if (msg.method) for (const h of handlers.get(msg.method) ?? []) h(msg.params);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  const on = (method, handler) => handlers.set(method, [...(handlers.get(method) ?? []), handler]);

  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile: false });
  await send("Page.enable");
  await send("Runtime.enable");
  on("Runtime.exceptionThrown", (p) => console.error("page error:", p.exceptionDetails.exception?.description ?? p.exceptionDetails.text));

  const close = () => { ws.close(); edge.kill(); };
  return { send, on, close };
}

/** Runs JS in the page and returns its value. */
export async function evaluate(send, expression) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
}
