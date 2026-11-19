"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

import { clock } from "@/ui/format";
import { runClock } from "@/ui/run/run-view";
import type { RunView } from "@/ui/run/run-view";

/** Visible window when following the live edge, in ms. */
const FOLLOW_SPAN_MS = 14_000;
const LIVE_EDGE = 0.75;
const TICK_EVERY_MS = 2_000;
const MIN_WIDTH = { bar: 3, tick: 5 };
// Below these widths a label would be cut to a fragment like "1…", so show the short form or nothing.
const LABEL = { full: 84, short: 56 };

/**
 * Animation loop for the timeline. Bars sit at fixed x positions; each frame only slides the strips
 * (compositor transforms) and widens bars that are still running. Runs only while the audit is live.
 */
export function useTimelineFrame(rootRef: RefObject<HTMLDivElement | null>, view: RunView, follow: boolean): void {
  const viewRef = useRef(view);
  // Keep the latest view for the frame loop without restarting it on every event.
  useEffect(() => {
    viewRef.current = view;
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let raf = 0;
    let tickKey = "";

    const draw = (): void => {
      const current = viewRef.current;
      const track = root.querySelector<HTMLElement>(".track");
      const width = track?.clientWidth ?? 1;
      const now = runClock(current, Date.now());
      const span = follow ? FOLLOW_SPAN_MS : Math.max(FOLLOW_SPAN_MS, now * 1.05);
      const start = follow ? Math.max(0, now - span * LIVE_EDGE) : 0;
      const pxPerMs = width / span;

      const key = `${pxPerMs.toFixed(5)}:${Math.ceil((start + span) / TICK_EVERY_MS)}`;
      if (key !== tickKey) {
        tickKey = key;
        const marks = Array.from({ length: Math.ceil((start + span) / TICK_EVERY_MS) + 1 }, (_, i) => i * TICK_EVERY_MS);
        const axis = root.querySelector<HTMLElement>('[data-strip="axis"]');
        const grid = root.querySelector<HTMLElement>('[data-strip="grid"]');
        if (axis) axis.innerHTML = marks.map((t) => `<span style="left:${t * pxPerMs}px">${clock(t)}</span>`).join("");
        if (grid) grid.innerHTML = marks.map((t) => `<i style="left:${t * pxPerMs}px"></i>`).join("");
      }

      const shift = `translate3d(${-start * pxPerMs}px, 0, 0)`;
      root.querySelectorAll<HTMLElement>("[data-strip]").forEach((strip) => { strip.style.transform = shift; });
      const nowLine = root.querySelector<HTMLElement>("[data-now]");
      if (nowLine) nowLine.style.transform = `translate3d(${(now - start) * pxPerMs}px, 0, 0)`;

      root.querySelectorAll<HTMLElement>(".bar[data-start]").forEach((bar) => {
        const barStart = Number(bar.dataset["start"]);
        const end = bar.dataset["end"] ? Number(bar.dataset["end"]) : now;
        const w = Math.max(bar.classList.contains("tick") ? MIN_WIDTH.tick : MIN_WIDTH.bar, (end - barStart) * pxPerMs);
        bar.style.left = `${barStart * pxPerMs}px`;
        bar.style.width = `${w}px`;
        bar.dataset["size"] = w < LABEL.short ? "quiet" : w < LABEL.full ? "compact" : "";
      });
    };

    const loop = (): void => {
      draw();
      if (viewRef.current.status === "running" || viewRef.current.status === "starting") raf = requestAnimationFrame(loop);
    };
    loop();
    const resize = new ResizeObserver(draw);
    resize.observe(root);
    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
    };
  }, [rootRef, follow, view.status, view.tasks.length, view.tools.length, view.findings.length]);
}
