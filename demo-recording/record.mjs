// Records the FinGuard demo from the running app (pnpm dev in ../finguard) into frames/ + frames/timeline.json.
// Scenes follow PLAN.md section 11. Run: pnpm run record, then pnpm run render.
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { launch, sleep } from "./lib/cdp.mjs";
import { PAGE_KIT } from "./lib/page-kit.mjs";
import { Stage } from "./lib/stage.mjs";

const APP = process.env.FINGUARD_URL ?? "http://localhost:3000/";
const SAMPLES = resolve("../finguard/data/samples");
const FRAMES = resolve("frames");
// 2x capture (2880x1620): every shot is scaled down to 1080p, so text stays sharp. The live audit captures at ~45 fps.
const VIEW = { width: 1440, height: 810, scale: 2 };
const RUN_TIMEOUT_MS = 10 * 60_000;
// The free Gemini tier makes a full audit take minutes; that stretch is shown sped up, with a badge.
const SPEED = 8;
// MODEL=Demo records a quick rehearsal in Demo mode (scripted, no AI); the real video uses Gemini.
const MODEL = process.env.MODEL ?? "Gemini";

const byText = (selector, text) => `[...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.textContent.includes(${JSON.stringify(text)}))`;
const q = (selector) => `document.querySelector(${JSON.stringify(selector)})`;
const UPLOAD = "dialog.sheet[open]";

const browser = await launch(VIEW);
const stage = new Stage(browser, { framesDir: FRAMES, ...VIEW });
try {
  await browser.send("Page.navigate", { url: APP });
  await stage.until(`document.querySelector(".topbar") && document.fonts.status === "loaded"`, 30_000);
  await stage.js(PAGE_KIT);
  await stage.js(`__kit.jump(${stage.mouse.x}, ${stage.mouse.y})`);
  await stage.js(`__kit.card("FinGuard AI", "Three AI agents audit invoices against your books. Code decides every finding.")`);
  await sleep(300);
  await stage.capture();

  // 1. Title, then the empty dashboard
  await sleep(3600);
  await stage.js(`__kit.hideCard()`);
  await sleep(1200);

  // 2. Upload
  stage.mark("caption", { text: "Drop in invoice PDFs, purchase orders, payments and the vendor list" });
  await stage.clickEl(byText(".topbar button", "New audit"));
  await sleep(500);
  stage.mark("zoom", { rect: await stage.rect(q(UPLOAD)), dur: 1.0, fill: 0.92 });
  await sleep(900);
  await stage.moveToEl(q(`${UPLOAD} .drop`), { ay: 0.38 });
  const names = readdirSync(SAMPLES);
  await stage.js(`(() => { const d = new DataTransfer(); for (const n of ${JSON.stringify(names)}) d.items.add(new File(["x"], n)); ${q(`${UPLOAD} .drop`)}.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: d })); })()`);
  await sleep(1500);
  await stage.js(`${q(`${UPLOAD} .drop`)}.dispatchEvent(new DragEvent("dragleave", { bubbles: true }))`);
  const doc = await browser.send("DOM.getDocument");
  const input = await browser.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: `${UPLOAD} input[type=file]` });
  await browser.send("DOM.setFileInputFiles", { nodeId: input.nodeId, files: names.map((n) => join(SAMPLES, n)) });
  await sleep(1800);
  await stage.moveToEl(q(`${UPLOAD} .folder-doc[data-in]:nth-of-type(3)`), { ay: 0.2, ms: 500 });
  await sleep(1300);
  stage.mark("caption", { text: MODEL === "Gemini" ? "FinGuard sorts every file and runs on a free Gemini model" : "FinGuard sorts every file. This recording runs in Demo mode: same agents, rules and tools" });
  await stage.js(`${q(`${UPLOAD} .sheet-body`)}.scrollTo({ top: 520, behavior: "smooth" })`);
  await sleep(900);
  await stage.clickEl(byText(`${UPLOAD} .seg button`, MODEL));
  await sleep(1300);
  await stage.clickEl(byText(`${UPLOAD} button`, "Start audit"));
  await stage.until(`!document.querySelector("${UPLOAD}")`, 30_000);
  stage.mark("zoomOut", { dur: 0.9 });

  // 3. Live run: three agents at once
  stage.mark("caption", { text: "Ledger reads each invoice. Tally and Sentinel check it the moment it is saved" });
  await stage.moveTo(VIEW.width * 0.5, VIEW.height * 0.62, 900);
  await sleep(1400);
  stage.mark("zoom", { rect: await stage.rect(q(".timeline .board")), dur: 1.2, fill: 0.95 });
  await sleep(11_000);
  stage.mark("zoomOut", { dur: 1.0 });
  await sleep(1100);
  // A Gemini run takes minutes on the free tier, so that stretch plays sped up; Demo mode is quick enough at 1x.
  const speedUp = MODEL === "Gemini";
  if (speedUp) {
    await stage.stopCapture();
    await stage.capture(3);
    stage.mark("speed", { factor: SPEED });
  }
  stage.mark("caption", { text: "Findings arrive as the agents work, each one decided by a coded rule" });
  await stage.until(`${q(".topbar .status")}?.textContent.includes("Complete") || ${q(".topbar .status")}?.textContent.includes("Failed")`, RUN_TIMEOUT_MS);
  if (speedUp) {
    await stage.stopCapture();
    await stage.capture();
    stage.mark("speedEnd");
  }
  await sleep(1500);

  // 4. Findings with evidence
  stage.mark("caption", { text: "Every finding shows what was expected and what the files actually say" });
  stage.mark("zoom", { rect: await stage.rect(q(".panel")), dur: 1.0, fill: 0.9 });
  await sleep(1200);
  await stage.clickEl(`${byText(".finding", "New bank account")}?.querySelector(".finding-head")`);
  await sleep(900);
  stage.mark("zoom", { rect: await stage.rect(byText(".finding", "New bank account")), dur: 0.9, fill: 0.8 });
  await sleep(4200);
  await stage.clickEl(`${byText(".finding", "New bank account")}?.querySelector(".finding-actions .flat")`);
  stage.mark("zoomOut", { dur: 0.9 });
  stage.mark("caption", { text: "Open the exact invoice the agent read" });
  await sleep(3800);
  await stage.clickEl(q("dialog.preview [aria-label=Close]"));
  await sleep(900);

  // 5. Passed invoices
  stage.mark("caption", { text: "Invoices that pass every check are listed too", top: true });
  stage.mark("zoom", { rect: await stage.rect(q(".outcomes")), dur: 1.0, fill: 0.7 });
  await stage.moveToEl(byText(".outcomes .refs button", "INV-1007"));
  await sleep(2600);
  stage.mark("zoomOut", { dur: 0.9 });

  // 6. History
  stage.mark("caption", { text: "Every audit is saved locally and can be replayed" });
  await stage.clickEl(q(`[aria-label="Past audits"]`));
  await sleep(450);
  stage.mark("zoom", { rect: await stage.rect(q("dialog[open]")), dur: 0.9, fill: 0.75 });
  await stage.moveToEl(q("dialog[open] .history button"), { ax: 0.6 });
  await sleep(2200);
  stage.mark("zoomOut", { dur: 0.8 });
  await stage.clickEl(q("dialog[open] [aria-label=Close]"));
  await sleep(700);
  stage.mark("captionEnd");

  // 7. Closing card
  await stage.js(`__kit.card("FinGuard AI", "AI reads and explains. Code decides. Every step is checked at a Mozaik breakpoint.")`);
  await sleep(4200);
  stage.mark("end");
  await sleep(300);
  await stage.stopCapture();
} finally {
  await stage.save(join(FRAMES, "timeline.json"));
  browser.close();
}
console.log(`Recorded ${stage.frames.length} frames into ${FRAMES}`);
process.exit(0);
