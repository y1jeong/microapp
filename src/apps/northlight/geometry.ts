/**
 * North-side daylight setback (정북 일조사선) math, per 건축법 시행령 제86조.
 *
 * Coordinates are in meters with +Y pointing due north. A point is buildable
 * at height h if its due-north distance to the site boundary is at least the
 * required setback s(h):
 *
 *   h <= threshold : s = base setback (default 1.5 m)
 *   h >  threshold : s = max(base, h * ratio) (default h / 2)
 *
 * For a vertically-simple site polygon that region is exactly the area between
 * the lower boundary chain and the upper boundary chain lowered by s, which
 * footprintAt() computes strip by strip between consecutive vertex x's (the
 * boundaries are linear inside each strip, so areas and crossings are exact).
 */

export interface Pt {
  x: number;
  y: number;
}

export interface SetbackRule {
  /** height up to which only the base setback applies, meters */
  threshold: number;
  /** minimum setback from the north boundary, meters */
  base: number;
  /** setback ratio above the threshold (s = h * ratio) */
  ratio: number;
}

export interface Footprint {
  /** buildable region, possibly several disjoint components */
  polys: Pt[][];
  area: number;
}

export interface Floor extends Footprint {
  level: number;
  /** top of this floor above ground, meters */
  topZ: number;
}

export function setbackAt(h: number, rule: SetbackRule): number {
  return h <= rule.threshold ? rule.base : Math.max(rule.base, h * rule.ratio);
}

export function polygonArea(verts: Pt[]): number {
  let a = 0;
  for (let i = 0; i < verts.length; i++) {
    const p = verts[i];
    const q = verts[(i + 1) % verts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

export function edgeLength(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** min/max y of the polygon's cross-section on the vertical line at x */
export function columnInterval(verts: Pt[], x: number): { lo: number; hi: number } | null {
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

/** buildable footprint after applying a due-north setback of s meters */
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
    // Sample at interior points: at the strip boundaries vertical edges (and
    // vertices of adjacent strips) contaminate the column min/max. lo and hi
    // are linear inside the strip, so two samples extrapolate exactly.
    const cA = columnInterval(verts, x0 + (x1 - x0) * 0.25);
    const cB = columnInterval(verts, x0 + (x1 - x0) * 0.75);
    if (!cA || !cB) {
      flush();
      continue;
    }
    const c0 = { lo: (3 * cA.lo - cB.lo) / 2, hi: (3 * cA.hi - cB.hi) / 2 };
    const c1 = { lo: (3 * cB.lo - cA.lo) / 2, hi: (3 * cB.hi - cA.hi) / 2 };
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

/** floors that remain buildable under the slope plane, bottom up */
export function computeFloors(
  verts: Pt[],
  rule: SetbackRule,
  count: number,
  floorH: number,
): Floor[] {
  const floors: Floor[] = [];
  for (let i = 1; i <= count; i++) {
    const topZ = i * floorH;
    const fp = footprintAt(verts, setbackAt(topZ, rule));
    if (fp.area < 1) break;
    floors.push({ level: i, topZ, ...fp });
  }
  return floors;
}

export function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function distToBoundary(p: Pt, verts: Pt[]): number {
  let d = Infinity;
  for (let i = 0; i < verts.length; i++) {
    d = Math.min(d, distToSegment(p, verts[i], verts[(i + 1) % verts.length]));
  }
  return d;
}

/**
 * Edges of a footprint outline that deviate from the site boundary, so stacked
 * floors render as setback lines instead of one thick multicolored border.
 */
export function deviatingEdges(poly: Pt[], site: Pt[], tol = 0.08): [Pt, Pt][] {
  const edges: [Pt, Pt][] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (distToBoundary(mid, site) < tol && distToBoundary(a, site) < tol) continue;
    edges.push([a, b]);
  }
  return edges;
}

/** dimetric projection used by the floor-stack view (screen y grows up) */
export function isoProject(x: number, y: number, z: number): Pt {
  return { x: (x - y) * 0.866, y: (x + y) * 0.5 + z * 1.05 };
}

export function floorColor(level: number, count: number): string {
  const hue = 215 - (count <= 1 ? 0 : ((level - 1) / (count - 1)) * 95);
  return `hsl(${hue} 75% 62%)`;
}
