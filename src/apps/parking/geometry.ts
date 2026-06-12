/**
 * Parking stall auto-layout inside a site polygon (주차 배치).
 *
 * Stall dimensions follow 주차장법 시행규칙 제3조 (일반형 직각주차 구획
 * 2.5 m × 5.0 m) with a 6.0 m drive aisle for 90° parking (제6조). The
 * layout has three parts:
 *
 *   edge  — perpendicular stalls along the inside of each boundary edge,
 *           longest edge first. A stall must keep an aisleW-deep
 *           maneuvering zone in front of its access face: the zone stays
 *           inside the site and clear of every other stall (and no stall
 *           may sit inside another's zone), so runs stop short of corners
 *           instead of trapping cars behind the perpendicular run.
 *   ring  — the circulation aisle between edge stalls and the core, i.e.
 *           the band at boundary distance stallD .. stallD + aisleW.
 *   inner — back-to-back stall column pairs in the core (every point at
 *           boundary distance ≥ stallD + aisleW), separated by aisles.
 *           Each column faces its access aisle.
 *
 * Obstacle polygons (코어/램프/설비 — stair and elevator cores, ramps,
 * mechanical rooms) exclude stalls: any stall whose rectangle or
 * maneuvering zone intersects an obstacle is dropped. Touching an
 * obstacle wall side-on or back-on is allowed.
 */

export interface Pt {
  x: number;
  y: number;
}

export interface ParkingParams {
  /** stall width along the aisle, meters (주차구획 너비) */
  stallW: number;
  /** stall depth, meters (주차구획 길이) */
  stallD: number;
  /** drive aisle width, meters (차로 너비) */
  aisleW: number;
}

/** one stall rectangle as its four corners in order */
export type Stall = [Pt, Pt, Pt, Pt];

export type ObstacleKind = 'core' | 'ramp' | 'mech';

/** parking-free area inside the site: stair/elevator core, ramp, mech room */
export interface Obstacle {
  id: string;
  kind: ObstacleKind;
  verts: Pt[];
}

export interface Layout {
  edge: Stall[];
  inner: Stall[];
  /** circulation band boundaries; null when the site is too small */
  ringOuter: Pt[] | null;
  ringInner: Pt[] | null;
}

export function signedArea(verts: Pt[]): number {
  let a = 0;
  for (let i = 0; i < verts.length; i++) {
    const p = verts[i];
    const q = verts[(i + 1) % verts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

export function polygonArea(verts: Pt[]): number {
  return Math.abs(signedArea(verts));
}

export function edgeLength(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function pointInPolygon(p: Pt, verts: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const a = verts[i];
    const b = verts[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
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

/** separating-axis overlap test for two convex quads; touching is not overlap */
export function rectsOverlap(a: Stall, b: Stall): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      const len = Math.hypot(q.y - p.y, q.x - p.x);
      if (len < 1e-12) continue;
      const nx = (p.y - q.y) / len;
      const ny = (q.x - p.x) / len;
      let minA = Infinity;
      let maxA = -Infinity;
      let minB = Infinity;
      let maxB = -Infinity;
      for (const v of a) {
        const t = v.x * nx + v.y * ny;
        minA = Math.min(minA, t);
        maxA = Math.max(maxA, t);
      }
      for (const v of b) {
        const t = v.x * nx + v.y * ny;
        minB = Math.min(minB, t);
        maxB = Math.max(maxB, t);
      }
      // tolerance lets stalls that share an edge count as non-overlapping
      if (maxA - minB < 1e-4 || maxB - minA < 1e-4) return false;
    }
  }
  return true;
}

/** contacts shallower than this distance (meters) count as touching */
const DIST_EPS = 1e-7;

function cross(o: Pt, a: Pt, b: Pt): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** which side of line ab the point p is on; offsets under DIST_EPS are 0 */
function sideOf(a: Pt, b: Pt, p: Pt): number {
  const len = edgeLength(a, b);
  if (len < 1e-12) return 0;
  const d = cross(a, b, p) / len; // signed point-to-line distance
  if (d > DIST_EPS) return 1;
  return d < -DIST_EPS ? -1 : 0;
}

/** proper segment crossing; shared endpoints and collinear touches do not count */
function segsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  return sideOf(c, d, a) * sideOf(c, d, b) < 0 && sideOf(a, b, c) * sideOf(a, b, d) < 0;
}

/**
 * Area intersection of two simple polygons: edges properly cross, a vertex
 * of one lies strictly inside the other, or one polygon is buried in the
 * other with only boundary contact (e.g. coincident rectangles). Touching
 * boundaries (a stall flush against a core wall) do not count.
 */
export function polysIntersect(a: Pt[], b: Pt[]): boolean {
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      if (segsCross(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true;
    }
  }
  const strictlyInside = (p: Pt, poly: Pt[]) =>
    pointInPolygon(p, poly) && distToBoundary(p, poly) > DIST_EPS;
  if (a.some((p) => strictlyInside(p, b)) || b.some((p) => strictlyInside(p, a))) return true;
  // containment with all vertices on the boundary: probe each polygon's
  // vertex average, but only where that average lies inside its own polygon
  // (a concave polygon's average can fall outside it)
  const center = (poly: Pt[]): Pt => ({
    x: poly.reduce((s, p) => s + p.x, 0) / poly.length,
    y: poly.reduce((s, p) => s + p.y, 0) / poly.length,
  });
  const ca = center(a);
  if (pointInPolygon(ca, a) && strictlyInside(ca, b)) return true;
  const cb = center(b);
  return pointInPolygon(cb, b) && strictlyInside(cb, a);
}

/**
 * Naive inward offset: shift every edge line inward by d and intersect
 * consecutive lines. Returns null when the result degenerates (offset
 * deeper than the site allows, or a vertex lands closer than d to some
 * other edge — the self-intersecting case).
 */
export function insetPolygon(verts: Pt[], d: number): Pt[] | null {
  const ccw = signedArea(verts) >= 0 ? verts : [...verts].reverse();
  const n = ccw.length;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = ccw[(i + n - 1) % n];
    const p1 = ccw[i];
    const p2 = ccw[(i + 1) % n];
    const l0 = edgeLength(p0, p1);
    const l1 = edgeLength(p1, p2);
    if (l0 < 1e-9 || l1 < 1e-9) return null;
    const n0 = { x: -(p1.y - p0.y) / l0, y: (p1.x - p0.x) / l0 };
    const n1 = { x: -(p2.y - p1.y) / l1, y: (p2.x - p1.x) / l1 };
    const a0 = { x: p0.x + n0.x * d, y: p0.y + n0.y * d };
    const a1 = { x: p1.x + n1.x * d, y: p1.y + n1.y * d };
    const denom = (p1.x - p0.x) * (p2.y - p1.y) - (p1.y - p0.y) * (p2.x - p1.x);
    if (Math.abs(denom) < 1e-9) {
      out.push({ x: p1.x + n0.x * d, y: p1.y + n0.y * d });
    } else {
      const t = ((a1.x - a0.x) * (p2.y - p1.y) - (a1.y - a0.y) * (p2.x - p1.x)) / denom;
      out.push({ x: a0.x + (p1.x - p0.x) * t, y: a0.y + (p1.y - p0.y) * t });
    }
  }
  if (signedArea(out) < 1e-6) return null;
  for (const p of out) {
    if (!pointInPolygon(p, ccw) || distToBoundary(p, ccw) < d - 1e-3) return null;
  }
  return out;
}

function stallRect(origin: Pt, u: Pt, v: Pt, w: number, d: number): Stall {
  return [
    { x: origin.x, y: origin.y },
    { x: origin.x + u.x * w, y: origin.y + u.y * w },
    { x: origin.x + u.x * w + v.x * d, y: origin.y + u.y * w + v.y * d },
    { x: origin.x + v.x * d, y: origin.y + v.y * d },
  ];
}

/**
 * Corners and edge midpoints inside the polygon (tested a hair toward the
 * stall center so boundary-flush stalls pass) and, when margin > 0, at
 * least margin from the boundary.
 */
function rectFits(rect: Stall, verts: Pt[], margin: number): boolean {
  const cx = (rect[0].x + rect[1].x + rect[2].x + rect[3].x) / 4;
  const cy = (rect[0].y + rect[1].y + rect[2].y + rect[3].y) / 4;
  for (let i = 0; i < 4; i++) {
    const c = rect[i];
    const m = { x: (c.x + rect[(i + 1) % 4].x) / 2, y: (c.y + rect[(i + 1) % 4].y) / 2 };
    for (const p of [c, m]) {
      const q = { x: p.x + (cx - p.x) * 1e-4, y: p.y + (cy - p.y) * 1e-4 };
      if (!pointInPolygon(q, verts)) return false;
      if (margin > 0 && distToBoundary(p, verts) < margin - 1e-6) return false;
    }
  }
  return true;
}

const blocked = (rect: Stall, blocks: Pt[][]) => blocks.some((b) => polysIntersect(rect, b));

function edgeStalls(ccw: Pt[], { stallW, stallD, aisleW }: ParkingParams, blocks: Pt[][]): Stall[] {
  const n = ccw.length;
  const order = [...Array(n).keys()].sort(
    (i, j) => edgeLength(ccw[j], ccw[(j + 1) % n]) - edgeLength(ccw[i], ccw[(i + 1) % n]),
  );
  const placed: Stall[] = [];
  const zones: Stall[] = [];
  for (const i of order) {
    const a = ccw[i];
    const b = ccw[(i + 1) % n];
    const len = edgeLength(a, b);
    const count = Math.floor(len / stallW);
    if (count === 0) continue;
    const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    // interior lies to the left of a CCW edge
    const inward = { x: -u.y, y: u.x };
    const off = (len - count * stallW) / 2;
    for (let k = 0; k < count; k++) {
      const s = off + k * stallW;
      const o = { x: a.x + u.x * s, y: a.y + u.y * s };
      const rect = stallRect(o, u, inward, stallW, stallD);
      const zone = stallRect(
        { x: o.x + inward.x * stallD, y: o.y + inward.y * stallD },
        u,
        inward,
        stallW,
        aisleW,
      );
      if (!rectFits(rect, ccw, 0) || !rectFits(zone, ccw, 0)) continue;
      if (blocked(rect, blocks) || blocked(zone, blocks)) continue;
      // no collision, no parking inside someone's zone, no blocking theirs
      if (placed.some((other) => rectsOverlap(other, rect) || rectsOverlap(other, zone))) continue;
      if (zones.some((z) => rectsOverlap(z, rect))) continue;
      placed.push(rect);
      zones.push(zone);
    }
  }
  return placed;
}

const swapXY = (p: Pt): Pt => ({ x: p.y, y: p.x });

function innerStalls(ccw: Pt[], params: ParkingParams, blocks: Pt[][]): Stall[] {
  const { stallW, stallD, aisleW } = params;
  // columns run along the longer bounding-box dimension
  const xs = ccw.map((v) => v.x);
  const ys = ccw.map((v) => v.y);
  const transposed = Math.max(...ys) - Math.min(...ys) > Math.max(...xs) - Math.min(...xs);
  const verts = transposed ? ccw.map(swapXY) : ccw;
  const blockPolys = transposed ? blocks.map((b) => b.map(swapXY)) : blocks;
  const vx = verts.map((v) => v.x);
  const vy = verts.map((v) => v.y);

  const margin = stallD + aisleW;
  const x0 = Math.min(...vx) + margin;
  const x1 = Math.max(...vx) - margin;
  const y0 = Math.min(...vy) + margin;
  const y1 = Math.max(...vy) - margin;
  const w = x1 - x0;
  const h = y1 - y0;
  if (w < stallD || h < stallW) return [];

  // back-to-back column pairs separated by aisles, plus a trailing single
  // column when it still fits, all centered in the core box
  const pairW = 2 * stallD;
  const nPairs = Math.max(0, Math.floor((w + aisleW) / (pairW + aisleW)));
  const pairsW = nPairs > 0 ? nPairs * pairW + (nPairs - 1) * aisleW : 0;
  const single = pairsW + (nPairs > 0 ? aisleW : 0) + stallD <= w;
  const used = pairsW + (single ? (nPairs > 0 ? aisleW : 0) + stallD : 0);

  // each column faces the aisle its cars back out into
  const cols: { x: number; face: 1 | -1 }[] = [];
  let x = x0 + (w - used) / 2;
  for (let p = 0; p < nPairs; p++) {
    cols.push({ x, face: -1 }, { x: x + stallD, face: 1 });
    x += pairW + aisleW;
  }
  if (single) cols.push({ x, face: -1 });

  const rows = Math.floor(h / stallW);
  const yStart = y0 + (h - rows * stallW) / 2;

  const stalls: Stall[] = [];
  for (const col of cols) {
    for (let r = 0; r < rows; r++) {
      const y = yStart + r * stallW;
      const rect = stallRect({ x: col.x, y }, { x: 0, y: 1 }, { x: 1, y: 0 }, stallW, stallD);
      const zoneX = col.face === 1 ? col.x + stallD : col.x - aisleW;
      const zone = stallRect({ x: zoneX, y }, { x: 0, y: 1 }, { x: 1, y: 0 }, stallW, aisleW);
      if (!rectFits(rect, verts, margin)) continue;
      if (blocked(rect, blockPolys) || blocked(zone, blockPolys)) continue;
      stalls.push(transposed ? (rect.map(swapXY) as Stall) : rect);
    }
  }
  return stalls;
}

export function computeLayout(verts: Pt[], params: ParkingParams, blocks: Pt[][] = []): Layout {
  if (verts.length < 3 || params.stallW <= 0 || params.stallD <= 0 || params.aisleW <= 0) {
    return { edge: [], inner: [], ringOuter: null, ringInner: null };
  }
  const ccw = signedArea(verts) >= 0 ? verts : [...verts].reverse();
  return {
    edge: edgeStalls(ccw, params, blocks),
    inner: innerStalls(ccw, params, blocks),
    ringOuter: insetPolygon(ccw, params.stallD),
    ringInner: insetPolygon(ccw, params.stallD + params.aisleW),
  };
}
