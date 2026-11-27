// Injected into the app page: a visible cursor with a click ripple, and full-screen title cards.
// Both live in the browser top layer (popover), so they stay above open dialogs.
export const PAGE_KIT = String.raw`
(() => {
  if (window.__kit) return;
  const css = document.createElement("style");
  css.textContent = ${"`"}
    .kit-cursor { position: fixed; inset: auto; left: 0; top: 0; margin: 0; padding: 0; border: 0; background: none; overflow: visible;
      width: 26px; height: 26px; pointer-events: none; will-change: transform; }
    .kit-cursor svg { position: absolute; left: -3px; top: -2px; width: 26px; height: 26px; filter: drop-shadow(0 2px 4px rgba(0,0,0,.55)); transition: transform .12s cubic-bezier(.2,.7,.2,1); }
    .kit-cursor.down svg { transform: scale(.86); }
    .kit-ripple { position: absolute; left: -18px; top: -18px; width: 36px; height: 36px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,.75); opacity: 0; transform: scale(.3); }
    .kit-ripple.go { animation: kit-ripple .55s cubic-bezier(.2,.7,.2,1); }
    @keyframes kit-ripple { 0% { opacity: .9; transform: scale(.3); } 100% { opacity: 0; transform: scale(1.4); } }
    .kit-card { position: fixed; inset: 0; width: 100vw; height: 100vh; max-width: none; max-height: none; margin: 0; padding: 0; border: 0;
      display: grid; place-items: center; text-align: center; color: #ececec; font-family: var(--font-inter), system-ui, sans-serif;
      background: radial-gradient(120% 90% at 50% 45%, rgba(21,21,21,.97), rgba(10,10,10,.985)); opacity: 0; transition: opacity .6s cubic-bezier(.2,.7,.2,1); }
    .kit-card.show { opacity: 1; }
    .kit-card .inner { display: grid; justify-items: center; gap: 14px; transform: translateY(8px); transition: transform .8s cubic-bezier(.2,.7,.2,1); }
    .kit-card.show .inner { transform: none; }
    .kit-card svg { width: 64px; height: 64px; }
    .kit-card h1 { font-size: 46px; font-weight: 600; letter-spacing: -0.04em; }
    .kit-card p { max-width: 30ch; font-size: 21px; line-height: 1.4; letter-spacing: -0.02em; color: #a6a6a6; }
  ${"`"};
  document.head.append(css);

  const cursor = document.createElement("div");
  cursor.className = "kit-cursor";
  cursor.popover = "manual";
  cursor.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 2.5v17.2l4.6-4.4 3.1 6.9 3-1.3-3.1-6.8h6.4z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg><span class="kit-ripple"></span>';
  document.body.append(cursor);
  const ripple = cursor.querySelector(".kit-ripple");

  // Opening a dialog puts it on top of the top layer; re-show the cursor so it stays above.
  const raise = () => { cursor.hidePopover(); cursor.showPopover(); };
  cursor.showPopover();
  new MutationObserver(raise).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });

  // The visible cursor is animated here at display rate; real mouse events only drive hover states.
  const pos = { x: 0, y: 0 };
  const place = () => { cursor.style.transform = "translate(" + pos.x + "px," + pos.y + "px)"; };
  const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  addEventListener("mousedown", () => { cursor.classList.add("down"); ripple.classList.remove("go"); void ripple.offsetWidth; ripple.classList.add("go"); }, true);
  addEventListener("mouseup", () => cursor.classList.remove("down"), true);

  const mark = document.querySelector(".brand-mark")?.outerHTML ?? "";
  window.__kit = {
    jump(x, y) { pos.x = x; pos.y = y; place(); },
    glide(x, y, ms) {
      const from = { ...pos };
      return new Promise((done) => {
        const start = performance.now();
        const step = (now) => {
          const p = Math.min(1, (now - start) / ms);
          const e = ease(p);
          pos.x = from.x + (x - from.x) * e; pos.y = from.y + (y - from.y) * e; place();
          if (p < 1) requestAnimationFrame(step); else done();
        };
        requestAnimationFrame(step);
      });
    },
    async card(title, line) {
      const el = document.createElement("div");
      el.className = "kit-card";
      el.popover = "manual";
      el.innerHTML = '<div class="inner">' + mark + "<h1>" + title + "</h1><p>" + line + "</p></div>";
      document.body.append(el);
      el.showPopover();
      raise();
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("show")));
      window.__kit.current = el;
    },
    hideCard() {
      const el = window.__kit.current;
      if (!el) return;
      el.classList.remove("show");
      setTimeout(() => el.remove(), 700);
    },
  };
})();
`;
