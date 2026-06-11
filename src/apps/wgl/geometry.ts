/**
 * Weighted ground level (가중평균 지표면) math.
 *
 * Per 건축법 시행령 제119조 — when the ground a building touches has varying
 * elevation, the design ground level is the weighted average of the ground
 * elevations along the building perimeter. Unfolding the perimeter into a
 * straight section, this is:
 *
 *   WGL = h_min + (area between ground profile and h_min) / perimeter
 */

export interface Vertex {
  id: string;
  /** plan position, metres (x east, y north) */
  x: number;
  y: number;
  /** ground elevation at this corner, metres (지표고) */
  fh: number;
}

let nextId = 1;
export function makeVertex(x: number, y: number, fh: number): Vertex {
  return { id: `v${nextId++}`, x, y, fh };
}

export function vertexLabel(index: number): string {
  // A, B, ..., Z, AA, AB ...
  let label = '';
  let i = index;
  do {
    label = String.fromCharCode(65 + (i % 26)) + label;
    i = Math.floor(i / 26) - 1;
  } while (i >= 0);
  return label;
}

export function edgeLength(a: Vertex, b: Vertex): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Shoelace area of the plan polygon, m². */
export function polygonArea(vs: Vertex[]): number {
  let s = 0;
  for (let i = 0; i < vs.length; i++) {
    const a = vs[i];
    const b = vs[(i + 1) % vs.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

export function perimeter(vs: Vertex[]): number {
  let p = 0;
  for (let i = 0; i < vs.length; i++) {
    p += edgeLength(vs[i], vs[(i + 1) % vs.length]);
  }
  return p;
}

export interface SectionPoint {
  /** cumulative distance along the unfolded perimeter, m */
  d: number;
  /** ground elevation, m */
  h: number;
  label: string;
}

/** Unfold the perimeter A→B→…→A into section points. */
export function unfoldSection(vs: Vertex[]): SectionPoint[] {
  const pts: SectionPoint[] = [];
  let d = 0;
  for (let i = 0; i <= vs.length; i++) {
    const v = vs[i % vs.length];
    if (i > 0) d += edgeLength(vs[i - 1], v);
    pts.push({ d, h: v.fh, label: vertexLabel(i % vs.length) });
  }
  return pts;
}

export interface WglResult {
  planArea: number;
  perimeter: number;
  hMin: number;
  hMax: number;
  /** area between the unfolded ground profile and h_min, m² */
  sectionArea: number;
  /** weighted ground level = hMin + sectionArea / perimeter */
  wgl: number;
}

export function computeWgl(vs: Vertex[]): WglResult {
  const per = perimeter(vs);
  const hMin = Math.min(...vs.map((v) => v.fh));
  const hMax = Math.max(...vs.map((v) => v.fh));
  let sectionArea = 0;
  for (let i = 0; i < vs.length; i++) {
    const a = vs[i];
    const b = vs[(i + 1) % vs.length];
    sectionArea += ((a.fh - hMin + (b.fh - hMin)) / 2) * edgeLength(a, b);
  }
  return {
    planArea: polygonArea(vs),
    perimeter: per,
    hMin,
    hMax,
    sectionArea,
    wgl: hMin + (per > 0 ? sectionArea / per : 0),
  };
}

export interface ContourSegment {
  level: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Where the ground surface (linear along each edge) crosses a given
 * elevation. Crossing points are collected in perimeter order and paired
 * into chords across the footprint — purely a visual aid in the plan view.
 */
export function contourSegments(vs: Vertex[], level: number): ContourSegment[] {
  const crossings: { x: number; y: number }[] = [];
  for (let i = 0; i < vs.length; i++) {
    const a = vs[i];
    const b = vs[(i + 1) % vs.length];
    const da = a.fh - level;
    const db = b.fh - level;
    if ((da > 0 && db < 0) || (da < 0 && db > 0)) {
      const t = da / (da - db);
      crossings.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
    }
  }
  const segs: ContourSegment[] = [];
  for (let i = 0; i + 1 < crossings.length; i += 2) {
    segs.push({
      level,
      x1: crossings[i].x,
      y1: crossings[i].y,
      x2: crossings[i + 1].x,
      y2: crossings[i + 1].y,
    });
  }
  return segs;
}

/** Contour levels worth drawing: multiples of `step` within the FH range. */
export function contourLevels(vs: Vertex[], step = 3): number[] {
  const hMin = Math.min(...vs.map((v) => v.fh));
  const hMax = Math.max(...vs.map((v) => v.fh));
  const levels: number[] = [];
  for (let l = Math.ceil(hMin / step) * step; l < hMax; l += step) {
    if (l > hMin) levels.push(l);
  }
  return levels;
}
