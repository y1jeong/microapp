/**
 * Northlight regulation (정북 일조사선) math, per 건축법 시행령 제86조.
 *
 * World coordinates are metres with +Y pointing due north. A point is
 * buildable at height h if its due-north distance to the site boundary is
 * at least the required setback s(h):
 *
 *   h <= threshold : s = base setback (default 1.5 m)
 *   h >  threshold : s = max(base, h * ratio)   (default h × 1/2)
 *
 * For a vertically-simple polygon the buildable footprint equals the region
 * between the lower boundary chain and the upper chain lowered by s, which
 * footprintAt() computes strip by strip.
 */

export interface Pt {
  x: number;
  y: number;
}

export interface RuleParams {
  floors: number;
  floorH: number;
  threshold: number;
  base: number;
  ratio: number;
}

export const DEFAULT_PARAMS: RuleParams = {
  floors: 10,
  floorH: 3,
  threshold: 9,
  base: 1.5,
  ratio: 0.5,
};

export function polyArea(verts: Pt[]): number {
  let a = 0;
  for (let i = 0; i < verts.length; i++) {
    const p = verts[i];
    const q = verts[(i + 1) % verts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

/** min/max y of the polygon's cross-section on the vertical line at x. */
export function columnInterval(verts: Pt[], x: number): { lo: number; hi: number } | null {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
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

export interface Footprint {
  polys: Pt[][];
  area: number;
}

/** Buildable footprint after applying a due-north setback of s metres. */
export function footprintAt(verts: Pt[], s: number): Footprint {
  const xs = [...new Set(verts.map((v) => +v.x.toFixed(7)))].sort((a, b) => a - b);
  const polys: Pt[][] = [];
  let area = 0;
  let bot: Pt[] = [];
  let top: Pt[] = [];

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
    const lo = (x: number) => c0.lo + ((x - x0) / (x1 - x0)) * (c1.lo - c0.lo);
    const tp = (x: number) => c0.hi - s + ((x - x0) / (x1 - x0)) * (c1.hi - c0.hi);
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

export function setbackFor(params: RuleParams, h: number): number {
  return h <= params.threshold ? params.base : Math.max(params.base, h * params.ratio);
}

export function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function distToBoundary(p: Pt, verts: Pt[]): number {
  let d = Number.POSITIVE_INFINITY;
  for (let i = 0; i < verts.length; i++) {
    d = Math.min(d, distToSegment(p, verts[i], verts[(i + 1) % verts.length]));
  }
  return d;
}

export interface Floor extends Footprint {
  level: number;
  topZ: number;
}

export function computeFloors(verts: Pt[], params: RuleParams): Floor[] {
  const floors: Floor[] = [];
  for (let i = 1; i <= params.floors; i++) {
    const topZ = i * params.floorH;
    const fp = footprintAt(verts, setbackFor(params, topZ));
    if (fp.area < 1) break; // floor no longer buildable under the slope plane
    floors.push({ level: i, topZ, ...fp });
  }
  return floors;
}
