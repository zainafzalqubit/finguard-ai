// Records the page as JPEG frames with real timestamps, and drives it like a person would.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { evaluate, sleep } from "./cdp.mjs";

const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);

export class Stage {
  constructor(browser, { framesDir, width, height, scale }) {
    this.b = browser;
    this.framesDir = framesDir;
    this.view = { width, height, scale };
    this.frames = [];
    this.marks = [];
    this.writes = [];
    this.mouse = { x: width * 0.62, y: height * 0.55 };
    this.offset = null; // wall clock minus frame clock, measured on the first frame
    rmSync(framesDir, { recursive: true, force: true });
    mkdirSync(framesDir, { recursive: true });
    browser.on("Page.screencastFrame", (p) => this.#onFrame(p));
  }

  #onFrame({ data, metadata, sessionId }) {
    this.b.send("Page.screencastFrameAck", { sessionId });
    this.offset ??= Date.now() / 1000 - metadata.timestamp;
    const file = `f${String(this.frames.length).padStart(6, "0")}.jpg`;
    this.frames.push({ file, t: metadata.timestamp });
    this.writes.push(writeFile(join(this.framesDir, file), Buffer.from(data, "base64")));
  }

  /** Seconds on the frame clock, so marks line up exactly with captured frames. */
  now() {
    return Date.now() / 1000 - (this.offset ?? 0);
  }

  async capture(everyNthFrame = 1) {
    const { width, height, scale } = this.view;
    // Quality 65 lets Edge encode every frame in time; artifacts vanish when scaled down to 1080p.
    await this.b.send("Page.startScreencast", { format: "jpeg", quality: 65, maxWidth: width * scale, maxHeight: height * scale, everyNthFrame });
  }

  async stopCapture() {
    await this.b.send("Page.stopScreencast");
  }

  mark(type, data = {}) {
    this.marks.push({ type, t: this.now(), ...data });
  }

  js(expression) {
    return evaluate(this.b.send, expression);
  }

  /** Viewport rect (CSS px) of the element an expression returns. */
  async rect(elementExpr) {
    const r = await this.js(`(() => { const el = ${elementExpr}; if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; })()`);
    if (!r) throw new Error(`No element for ${elementExpr}`);
    return r;
  }

  /** Moves the mouse along an eased path, so hover effects fire as they would for a person. */
  async moveTo(x, y, ms) {
    const from = { ...this.mouse };
    const dist = Math.hypot(x - from.x, y - from.y);
    const duration = ms ?? Math.min(1100, 380 + dist * 0.75);
    // The page animates the visible cursor at display rate (one CDP round trip per step would cap it near 20 fps).
    // Meanwhile real mouse events follow the same eased path, so hover effects fire as the cursor passes.
    const glide = this.js(`__kit.glide(${x}, ${y}, ${Math.round(duration)})`);
    const start = performance.now();
    for (;;) {
      const p = Math.min(1, (performance.now() - start) / duration);
      const e = easeInOut(p);
      this.mouse = { x: from.x + (x - from.x) * e, y: from.y + (y - from.y) * e };
      await this.b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: this.mouse.x, y: this.mouse.y });
      if (p === 1) break;
      await sleep(30);
    }
    await glide;
  }

  async moveToEl(elementExpr, { ax = 0.5, ay = 0.5, ms } = {}) {
    const r = await this.rect(elementExpr);
    await this.moveTo(r.x + r.w * ax, r.y + r.h * ay, ms);
    return r;
  }

  async click() {
    const base = { x: this.mouse.x, y: this.mouse.y, button: "left", clickCount: 1 };
    await this.b.send("Input.dispatchMouseEvent", { type: "mousePressed", ...base });
    await sleep(90);
    await this.b.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...base });
  }

  async clickEl(elementExpr, opts) {
    await this.moveToEl(elementExpr, opts);
    await sleep(160);
    await this.click();
  }

  /** Waits until a page condition is true, checking a few times a second. */
  async until(conditionExpr, timeoutMs) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      if (await this.js(`Boolean(${conditionExpr})`)) return;
      await sleep(250);
    }
    throw new Error(`Timed out waiting for ${conditionExpr}`);
  }

  async save(file) {
    await Promise.all(this.writes);
    writeFileSync(file, JSON.stringify({ view: this.view, frames: this.frames, marks: this.marks }, null, 1));
  }
}
