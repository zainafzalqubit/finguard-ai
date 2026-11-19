// Builds ffmpeg expressions (in t, video seconds) for an eased camera: zoom level and centre point.
// Marks: { type: "zoom", t, dur, rect (CSS px), fill } and { type: "zoomOut", t, dur }.
// Frames are captured at 1.5x the output size; zooms up to 1.35x are still scaled down, never up, so text stays sharp.
const MAX_ZOOM = 1.35;
const smoother = (p) => `(${p})*(${p})*(${p})*((${p})*((${p})*6-15)+10)`;
const fixed = (n) => Number(n.toFixed(4));

/** Camera states over time: where each move starts, how long it takes and where it ends up. */
function keyframes(marks, { view, W, H }) {
  const k = W / view.width;
  const moves = [];
  let readyAt = 0;
  for (const m of marks) {
    if (m.type !== "zoom" && m.type !== "zoomOut") continue;
    let state = { z: 1, cx: W / 2, cy: H / 2 };
    if (m.type === "zoom") {
      const z = Math.max(1, Math.min(MAX_ZOOM, m.fill * Math.min(W / (m.rect.w * k), H / (m.rect.h * k))));
      // Keep the view inside the frame: a centre too near an edge would show nothing past it.
      const clamp = (c, size) => Math.min(size - size / (2 * z), Math.max(size / (2 * z), c));
      state = { z, cx: clamp((m.rect.x + m.rect.w / 2) * k, W), cy: clamp((m.rect.y + m.rect.h / 2) * k, H) };
    }
    const t = Math.max(m.t, readyAt);
    moves.push({ t, d: m.dur, ...state });
    readyAt = t + m.dur;
  }
  return moves;
}

/** Piecewise expression: hold, then ease from the previous value to the next, move by move. */
function piecewise(moves, key, start, interpolate) {
  const build = (i, from) => {
    if (i === moves.length) return String(fixed(from));
    const { t, d } = moves[i];
    const to = moves[i][key];
    const p = `((t-${fixed(t)})/${fixed(d)})`;
    return `if(lt(t,${fixed(t)}),${fixed(from)},if(lt(t,${fixed(t + d)}),${interpolate(from, to, smoother(p))},${build(i + 1, to)}))`;
  };
  return build(0, start);
}

export function cameraExpressions(marks, frame) {
  const moves = keyframes(marks, frame);
  const linear = (a, b, s) => `(${fixed(a)}+(${fixed(b - a)})*${s})`;
  // Zoom eases in log space, so zooming in and out feel equally fast.
  const logScale = (a, b, s) => `exp(${fixed(Math.log(a))}+(${fixed(Math.log(b) - Math.log(a))})*${s})`;
  return {
    zoom: piecewise(moves, "z", 1, logScale),
    cx: piecewise(moves, "cx", frame.W / 2, linear),
    cy: piecewise(moves, "cy", frame.H / 2, linear),
  };
}
