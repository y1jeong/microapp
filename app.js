"use strict";

/*
 * Northlight Regulation (정북 일조사선) visualizer.
 *
 * World coordinates are in meters with +Y pointing due north. The buildable
 * footprint at height h is the set of points whose due-north distance to the
 * site boundary is at least the required setback s(h):
 *   h <= threshold : s = base setback (default 1.5 m)
 *   h >  threshold : s = max(base, h * ratio) (default h / 2)
 * For a vertically-simple polygon this equals the region between the lower
 * boundary chain and the upper boundary chain lowered by s, which is what
 * footprintAt() computes strip by strip.
 */

const STORAGE_KEY = "northlight-state-v1";

const DEFAULT_VERTS = [
  { x: 0.0, y: 31.5 },
  { x: 11.3, y: 32.0 },
  { x: 12.2, y: 22.3 },
  { x: 21.0, y: 21.6 },
  { x: 19.8, y: 2.5 },
  { x: 0.0, y: 0.0 },
];

const state = {
  verts: DEFAULT_VERTS.map((v) => ({ ...v })),
  floors: 10,
  floorH: 3,
  threshold: 9,
  base: 1.5,
  ratio: 0.5,
};

/* ---------------------------------------------------------------- geometry */

function polyArea(verts) {
  let a = 0;
  for (let i = 0; i < verts.length; i++) {
    const p = verts[i];
    const q = verts[(i + 1) % verts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

// min/max y of the polygon's cross-section on the vertical line at x.
function columnInterval(verts, x) {
  let lo = Infinity;
  let hi = -Infinity;
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % n];
    if (x < Math.min(a.x, b.x) - 1e-9 || x > Math.max(a.x, b.x) + 1e-9) continue;
    if (Math.abs(b.x - a.x) < 1e-9) {
      lo = Math.min(lo, a.y, b.y);
      hi = Math.max(hi, a.y, b.y);
    } else {
      const t = Math.max(0, Math.min(1, (x - a.x) / (b.x - a.x)));
      const y = a.y + t * (b.y - a.y);
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
  }
  return hi < lo ? null : { lo, hi };
}

// Buildable footprint after applying a due-north setback of s meters.
// Returns { polys, area } where polys may have several components.
function footprintAt(verts, s) {
  const xs = [...new Set(verts.map((v) => +v.x.toFixed(7)))].sort((a, b) => a - b);
  const polys = [];
  let area = 0;
  let bot = [];
  let top = [];

  const flush = () => {
    if (bot.length >= 2) polys.push([...bot, ...top.slice().reverse()]);
    bot = [];
    top = [];
  };

  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i];
    const x1 = xs[i + 1];
    if (x1 - x0 < 1e-9) continue;
    const c0 = columnInterval(verts, x0);
    const c1 = columnInterval(verts, x1);
    if (!c0 || !c1) {
      flush();
      continue;
    }
    const lo = (x) => c0.lo + ((x - x0) / (x1 - x0)) * (c1.lo - c0.lo);
    const tp = (x) => c0.hi - s + ((x - x0) / (x1 - x0)) * (c1.hi - c0.hi);
    const g0 = tp(x0) - lo(x0);
    const g1 = tp(x1) - lo(x1);
    if (g0 <= 0 && g1 <= 0) {
      flush();
      continue;
    }
    let a = x0;
    let b = x1;
    const xCross = x0 + (g0 / (g0 - g1)) * (x1 - x0);
    if (g0 <= 0) {
      a = xCross;
      flush();
    }
    if (g1 <= 0) b = xCross;
    if (b - a < 1e-9) {
      flush();
      continue;
    }
    if (bot.length === 0) {
      bot.push({ x: a, y: lo(a) });
      top.push({ x: a, y: tp(a) });
    }
    bot.push({ x: b, y: lo(b) });
    top.push({ x: b, y: tp(b) });
    area += ((b - a) * (tp(a) - lo(a) + tp(b) - lo(b))) / 2;
    if (g1 <= 0) flush();
  }
  flush();
  return { polys, area };
}

function setbackFor(h) {
  return h <= state.threshold ? state.base : Math.max(state.base, h * state.ratio);
}

function distToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  const cx = a.x + t * dx;
  const cy = a.y + t * dy;
  return Math.hypot(p.x - cx, p.y - cy);
}

function distToBoundary(p, verts) {
  let d = Infinity;
  for (let i = 0; i < verts.length; i++) {
    d = Math.min(d, distToSegment(p, verts[i], verts[(i + 1) % verts.length]));
  }
  return d;
}

/* ------------------------------------------------------------------- model */

function computeFloors() {
  const floors = [];
  for (let i = 1; i <= state.floors; i++) {
    const topZ = i * state.floorH;
    const fp = footprintAt(state.verts, setbackFor(topZ));
    if (fp.area < 1) break; // floor no longer buildable under the slope plane
    floors.push({ level: i, topZ, ...fp });
  }
  return floors;
}

/* ----------------------------------------------------------------- canvas */

const planCanvas = document.getElementById("plan-canvas");
const isoCanvas = document.getElementById("iso-canvas");
const statsEl = document.getElementById("stats");

function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: rect.width, h: rect.height };
}

function floorColor(i, n) {
  const hue = 215 - (n <= 1 ? 0 : ((i - 1) / (n - 1)) * 95);
  return `hsl(${hue} 75% 62%)`;
}

/* -------------------------------------------------------------- plan view */

let planTransform = null; // world -> screen, kept for hit-testing

function makePlanTransform(w, h) {
  let minx = Infinity;
  let miny = Infinity;
  let maxx = -Infinity;
  let maxy = -Infinity;
  for (const v of state.verts) {
    minx = Math.min(minx, v.x);
    miny = Math.min(miny, v.y);
    maxx = Math.max(maxx, v.x);
    maxy = Math.max(maxy, v.y);
  }
  const pad = 70;
  const k = Math.min((w - 2 * pad) / Math.max(1, maxx - minx), (h - 2 * pad) / Math.max(1, maxy - miny));
  const ox = (w - k * (maxx - minx)) / 2 - k * minx;
  const oy = (h + k * (maxy - miny)) / 2 + k * miny;
  return {
    k,
    toScreen: (p) => ({ x: k * p.x + ox, y: oy - k * p.y }),
    toWorld: (sx, sy) => ({ x: (sx - ox) / k, y: (oy - sy) / k }),
  };
}

function chip(ctx, text, x, y, color = "#e8eaed") {
  ctx.font = "12px ui-monospace, Menlo, Consolas, monospace";
  const w = ctx.measureText(text).width + 12;
  ctx.fillStyle = "rgba(8, 10, 12, 0.85)";
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 10, w, 20, 4);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y + 0.5);
}

function strokeDeviatingEdges(ctx, poly, T) {
  // Stroke only the parts of a floor outline that differ from the site
  // boundary, so stacked floors read as setback lines instead of one
  // thick multicolored border.
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (distToBoundary(mid, state.verts) < 0.08 && distToBoundary(a, state.verts) < 0.08) continue;
    const sa = T.toScreen(a);
    const sb = T.toScreen(b);
    ctx.beginPath();
    ctx.moveTo(sa.x, sa.y);
    ctx.lineTo(sb.x, sb.y);
    ctx.stroke();
  }
}

function drawPlan(floors) {
  const { ctx, w, h } = setupCanvas(planCanvas);
  const T = makePlanTransform(w, h);
  planTransform = T;

  // grid (5 m)
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  const origin = T.toWorld(0, h);
  const corner = T.toWorld(w, 0);
  for (let gx = Math.floor(origin.x / 5) * 5; gx <= corner.x; gx += 5) {
    const s = T.toScreen({ x: gx, y: 0 });
    ctx.beginPath();
    ctx.moveTo(s.x, 0);
    ctx.lineTo(s.x, h);
    ctx.stroke();
  }
  for (let gy = Math.floor(origin.y / 5) * 5; gy <= corner.y; gy += 5) {
    const s = T.toScreen({ x: 0, y: gy });
    ctx.beginPath();
    ctx.moveTo(0, s.y);
    ctx.lineTo(w, s.y);
    ctx.stroke();
  }

  // site fill + outline
  ctx.beginPath();
  state.verts.forEach((v, i) => {
    const s = T.toScreen(v);
    i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(80, 130, 190, 0.08)";
  ctx.fill();
  ctx.strokeStyle = "rgba(232, 234, 237, 0.85)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // per-floor setback lines (only where they deviate from the site boundary)
  ctx.lineWidth = 1.5;
  for (const f of floors) {
    ctx.strokeStyle = floorColor(f.level, floors.length);
    for (const poly of f.polys) strokeDeviatingEdges(ctx, poly, T);
  }

  // base setback line (red dashed) — the 1.5 m line every floor must respect
  const baseFp = footprintAt(state.verts, state.base);
  ctx.strokeStyle = "#e05d5d";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 5]);
  for (const poly of baseFp.polys) strokeDeviatingEdges(ctx, poly, T);
  ctx.setLineDash([]);

  // vertex handles
  for (const v of state.verts) {
    const s = T.toScreen(v);
    ctx.beginPath();
    ctx.arc(s.x, s.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "#0b0d10";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // edge length labels
  for (let i = 0; i < state.verts.length; i++) {
    const a = state.verts[i];
    const b = state.verts[(i + 1) % state.verts.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const mid = T.toScreen({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    chip(ctx, `E${i + 1}: ${len.toFixed(1)}m`, mid.x, mid.y);
  }

  // site area label
  let cx = 0;
  let cy = 0;
  for (const v of state.verts) {
    cx += v.x;
    cy += v.y;
  }
  const c = T.toScreen({ x: cx / state.verts.length, y: cy / state.verts.length });
  ctx.font = "700 18px ui-monospace, Menlo, Consolas, monospace";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${polyArea(state.verts).toFixed(1)} m²`, c.x, c.y);

  // north arrow
  ctx.strokeStyle = "#e05d5d";
  ctx.fillStyle = "#e05d5d";
  ctx.lineWidth = 3;
  const nx = w - 46;
  ctx.beginPath();
  ctx.moveTo(nx, 86);
  ctx.lineTo(nx, 38);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(nx, 26);
  ctx.lineTo(nx - 9, 44);
  ctx.lineTo(nx + 9, 44);
  ctx.closePath();
  ctx.fill();
  ctx.font = "700 16px ui-monospace, Menlo, Consolas, monospace";
  ctx.textAlign = "center";
  ctx.fillText("N", nx, 106);
}

/* --------------------------------------------------------------- iso view */

function isoProject(x, y, z) {
  return { x: (x - y) * 0.866, y: (x + y) * 0.5 + z * 1.05 };
}

function drawIso(floors) {
  const { ctx, w, h } = setupCanvas(isoCanvas);

  const baseFp = footprintAt(state.verts, state.base);
  const levels = [
    { z: 0, polys: [state.verts], color: "rgba(232,234,237,0.65)", label: "GL 0m", dash: false },
    ...floors.map((f) => ({
      z: f.topZ,
      polys: f.polys,
      color: floorColor(f.level, floors.length),
      label: `${f.level}F ${+f.topZ.toFixed(1)}m`,
      dash: false,
    })),
  ];
  if (state.threshold > 0 && floors.length * state.floorH > state.threshold) {
    // a floor topping out exactly at the threshold would overlap the 사선 label
    for (const lv of levels) {
      if (Math.abs(lv.z - state.threshold) < 0.01) lv.label = null;
    }
    levels.push({
      z: state.threshold,
      polys: baseFp.polys,
      color: "#e05d5d",
      label: `사선 ${+state.threshold.toFixed(1)}m`,
      dash: true,
    });
    levels.sort((a, b) => a.z - b.z);
  }

  // fit projected bounds (leave room on the right for labels)
  let minx = Infinity;
  let miny = Infinity;
  let maxx = -Infinity;
  let maxy = -Infinity;
  for (const lv of levels) {
    for (const poly of lv.polys) {
      for (const p of poly) {
        const q = isoProject(p.x, p.y, lv.z);
        minx = Math.min(minx, q.x);
        miny = Math.min(miny, q.y);
        maxx = Math.max(maxx, q.x);
        maxy = Math.max(maxy, q.y);
      }
    }
  }
  const padX = 90;
  const padY = 50;
  const k = Math.min((w - 2 * padX) / Math.max(1, maxx - minx), (h - 2 * padY) / Math.max(1, maxy - miny));
  const toScreen = (p, z) => {
    const q = isoProject(p.x, p.y, z);
    return {
      x: (w - k * (maxx - minx)) / 2 - k * minx + k * (q.x - 0) - 30,
      y: (h + k * (maxy - miny)) / 2 + k * miny - k * q.y,
    };
  };

  ctx.font = "13px ui-monospace, Menlo, Consolas, monospace";
  ctx.textBaseline = "middle";

  for (const lv of levels) {
    ctx.strokeStyle = lv.color;
    ctx.lineWidth = lv.dash ? 1.5 : 1.75;
    ctx.setLineDash(lv.dash ? [6, 5] : []);
    let rightmost = null;
    for (const poly of lv.polys) {
      ctx.beginPath();
      poly.forEach((p, i) => {
        const s = toScreen(p, lv.z);
        if (!rightmost || s.x > rightmost.x) rightmost = s;
        i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y);
      });
      ctx.closePath();
      ctx.stroke();
    }
    ctx.setLineDash([]);
    if (rightmost && lv.label) {
      ctx.fillStyle = lv.color;
      ctx.textAlign = "left";
      ctx.fillText(`–${lv.label}`, rightmost.x + 10, rightmost.y);
    }
  }
}

/* ------------------------------------------------------------------ stats */

function render() {
  const floors = computeFloors();
  drawPlan(floors);
  drawIso(floors);

  const built = floors.length;
  const height = built * state.floorH;
  const vol = floors.reduce((sum, f) => sum + f.area * state.floorH, 0);
  const groundArea = built ? floors[0].area : 0;
  statsEl.textContent =
    `Floors: ${built} | H: ${+height.toFixed(1)}m | ` +
    `Vol: ${Math.round(vol)} m³ | Area: ${Math.round(groundArea)} m²`;

  save();
}

/* ------------------------------------------------------------ interaction */

let dragIndex = -1;

function pointerWorld(ev) {
  const rect = planCanvas.getBoundingClientRect();
  return { sx: ev.clientX - rect.left, sy: ev.clientY - rect.top };
}

function hitVertex(sx, sy) {
  if (!planTransform) return -1;
  for (let i = 0; i < state.verts.length; i++) {
    const s = planTransform.toScreen(state.verts[i]);
    if (Math.hypot(s.x - sx, s.y - sy) < 11) return i;
  }
  return -1;
}

planCanvas.addEventListener("pointerdown", (ev) => {
  const { sx, sy } = pointerWorld(ev);
  const i = hitVertex(sx, sy);
  if (i < 0) return;
  if (ev.altKey) {
    if (state.verts.length > 3) {
      state.verts.splice(i, 1);
      render();
    }
    return;
  }
  dragIndex = i;
  planCanvas.setPointerCapture(ev.pointerId);
});

planCanvas.addEventListener("pointermove", (ev) => {
  if (dragIndex < 0) return;
  const { sx, sy } = pointerWorld(ev);
  const p = planTransform.toWorld(sx, sy);
  state.verts[dragIndex] = { x: +p.x.toFixed(2), y: +p.y.toFixed(2) };
  render();
});

planCanvas.addEventListener("pointerup", () => {
  dragIndex = -1;
});

planCanvas.addEventListener("dblclick", (ev) => {
  const { sx, sy } = pointerWorld(ev);
  if (hitVertex(sx, sy) >= 0) return;
  const p = planTransform.toWorld(sx, sy);
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < state.verts.length; i++) {
    const d = distToSegment(p, state.verts[i], state.verts[(i + 1) % state.verts.length]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  if (best >= 0 && bestD * planTransform.k < 10) {
    state.verts.splice(best + 1, 0, { x: +p.x.toFixed(2), y: +p.y.toFixed(2) });
    render();
  }
});

/* ---------------------------------------------------------------- controls */

const inputs = {
  floors: document.getElementById("in-floors"),
  floorH: document.getElementById("in-floorh"),
  threshold: document.getElementById("in-threshold"),
  base: document.getElementById("in-base"),
  ratio: document.getElementById("in-ratio"),
};

for (const [key, el] of Object.entries(inputs)) {
  el.addEventListener("input", () => {
    const v = parseFloat(el.value);
    if (!Number.isFinite(v)) return;
    state[key] = key === "floors" ? Math.max(1, Math.round(v)) : Math.max(0, v);
    render();
  });
}

document.getElementById("btn-reset").addEventListener("click", () => {
  state.verts = DEFAULT_VERTS.map((v) => ({ ...v }));
  render();
});

/* ------------------------------------------------------------- persistence */

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — view-only mode is fine */
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data.verts) && data.verts.length >= 3) state.verts = data.verts;
    for (const key of ["floors", "floorH", "threshold", "base", "ratio"]) {
      if (Number.isFinite(data[key])) state[key] = data[key];
    }
  } catch {
    /* corrupt state — fall back to defaults */
  }
}

load();
for (const [key, el] of Object.entries(inputs)) el.value = state[key];
window.addEventListener("resize", () => render());
render();
