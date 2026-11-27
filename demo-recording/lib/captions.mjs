// Renders captions and the speed badge as transparent PNGs in the app's own font and colours,
// so ffmpeg can lay them over the video after zooming (they never get cropped or scaled).
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { launch } from "./cdp.mjs";

const STYLE = `
  html, body { background: transparent !important; margin: 0; }
  body > *:not(.cap-root) { display: none !important; }
  .cap-root { position: fixed; left: 0; top: 0; padding: 24px; font-family: var(--font-inter), system-ui, sans-serif; }
  .cap { display: inline-flex; align-items: center; gap: 14px; padding: 15px 26px; border-radius: 18px; white-space: nowrap;
    font-size: 27px; letter-spacing: -0.02em; color: #ececec; background: rgba(24, 24, 24, 0.9);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.6), 0 18px 40px -12px rgba(0, 0, 0, 0.8); }
  .cap i { width: 9px; height: 9px; border-radius: 50%; background: #8fcaa0; box-shadow: 0 0 0 4px rgba(143, 202, 160, 0.18); }
  .cap.badge { padding: 10px 18px; font-size: 21px; font-weight: 600; border-radius: 14px; }
  .cap.badge i { background: #e3b25a; box-shadow: 0 0 0 4px rgba(227, 178, 90, 0.18); }
`;

/** Returns [{ file, width, height }] for each text, rendered at 1:1 output pixels. */
export async function renderCaptions(appUrl, items, outDir) {
  const browser = await launch({ width: 1920, height: 400, scale: 1 });
  try {
    await browser.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
    await browser.send("Page.navigate", { url: appUrl });
    await new Promise((r) => setTimeout(r, 2500));
    const results = [];
    for (const [i, item] of items.entries()) {
      const r = await browser.send("Runtime.evaluate", {
        returnByValue: true,
        awaitPromise: true,
        expression: `(async () => {
          let root = document.querySelector(".cap-root");
          if (!root) { const s = document.createElement("style"); s.textContent = ${JSON.stringify(STYLE)}; document.head.append(s);
            root = document.createElement("div"); root.className = "cap-root"; document.body.append(root); }
          root.innerHTML = '<span class="cap ${item.badge ? "badge" : ""}"><i></i></span>';
          root.firstChild.append(document.createTextNode(${JSON.stringify(item.text)}));
          await document.fonts.ready;
          const b = root.getBoundingClientRect();
          return { x: b.x, y: b.y, w: Math.ceil(b.width), h: Math.ceil(b.height) };
        })()`,
      });
      const box = r.result.value;
      const shot = await browser.send("Page.captureScreenshot", { format: "png", clip: { x: box.x, y: box.y, width: box.w, height: box.h, scale: 1 } });
      const file = join(outDir, `caption-${i}.png`);
      writeFileSync(file, Buffer.from(shot.data, "base64"));
      results.push({ file, width: box.w, height: box.h });
    }
    return results;
  } finally {
    browser.close();
  }
}
