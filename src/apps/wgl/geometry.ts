/**
 * Weighted ground level (가중평균 지표면) math.
 *
 * Per 건축법 시행령 제119조 — when the ground a building touches has varying
 * elevation, the design ground level is the weighted average of the ground
 * elevations along the building perimeter. Unfolding the perimeter into a
 * straight section:
 *
 *   G.L = el_min + (area between ground profile and el_min) / contact length
 *
 * The same formula applies to 도로 가중평균 수평면 (road weighted average
 * horizontal plane), where the trace is an open polyline along the road
 * frontage instead of a closed parcel boundary.
 */

export interface Vertex {
  id: string;
  /** plan position, metres (x east, y north) */
  x: number;
  y: number;
  /** ground elevation at this point, metres (EL) */
  el: number;
}

export type ParcelKind = 'site' | 'adjacent' | 'road';

export interface Parcel {
  id: string;
  name: string;
  kind: ParcelKind;
  /** closed = parcel boundary loop; open = road frontage polyline */
  closed: boolean;
  vertices: Vertex[];
}

let nextId = 1;
export function makeVertex(x: number, y: number, el: number): Vertex {
  return { id: `v${nextId++}`, x, y, el };
}

export function makeParcel(
  name: string,
  kind: ParcelKind,
  vertices: Vertex[],
  closed = kind !== 'road',
): Parcel {
  return { id: `p${nextId++}`, name, kind, closed, vertices };
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

/** Shoelace area of a closed plan polygon, m². 0 for open traces. */
export function polygonArea(vs: Vertex[], closed = true): number {
  if (!closed || vs.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < vs.length; i++) {
    const a = vs[i];
    const b = vs[(i + 1) % vs.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

/** Edge pairs along the trace: n edges when closed, n-1 when open. */
export function traceEdges(vs: Vertex[], closed: boolean): [Vertex, Vertex][] {
  const edges: [Vertex, Vertex][] = [];
  const n = closed ? vs.length : vs.length - 1;
  for (let i = 0; i < n; i++) {
    edges.push([vs[i], vs[(i + 1) % vs.length]]);
  }
  return edges;
}

/** Total ground-contact length: full loop when closed, open run otherwise. */
export function traceLength(vs: Vertex[], closed: boolean): number {
  return traceEdges(vs, closed).reduce((sum, [a, b]) => sum + edgeLength(a, b), 0);
}

export interface SectionPoint {
  /** cumulative distance along the unfolded trace, m */
  d: number;
  /** ground elevation, m */
  el: number;
  label: string;
}

/** Unfold the trace into section points (closed traces return to the start). */
export function unfoldSection(vs: Vertex[], closed: boolean): SectionPoint[] {
  const pts: SectionPoint[] = [];
  const count = closed ? vs.length + 1 : vs.length;
  let d = 0;
  for (let i = 0; i < count; i++) {
    const v = vs[i % vs.length];
    if (i > 0) d += edgeLength(vs[(i - 1) % vs.length], v);
    pts.push({ d, el: v.el, label: vertexLabel(i % vs.length) });
  }
  return pts;
}

export interface WglResult {
  planArea: number;
  /** ground-contact length (perimeter for closed, run length for open), m */
  contactLength: number;
  elMin: number;
  elMax: number;
  /** area between the unfolded ground profile and el_min, m² */
  sectionArea: number;
  /** weighted average height above el_min, m */
  avgHeight: number;
  /** weighted ground level = elMin + sectionArea / contactLength */
  gl: number;
}

export function computeWgl(vs: Vertex[], closed: boolean): WglResult {
  const contactLength = traceLength(vs, closed);
  const elMin = Math.min(...vs.map((v) => v.el));
  const elMax = Math.max(...vs.map((v) => v.el));
  let sectionArea = 0;
  for (const [a, b] of traceEdges(vs, closed)) {
    sectionArea += ((a.el - elMin + (b.el - elMin)) / 2) * edgeLength(a, b);
  }
  const avgHeight = contactLength > 0 ? sectionArea / contactLength : 0;
  return {
    planArea: polygonArea(vs, closed),
    contactLength,
    elMin,
    elMax,
    sectionArea,
    avgHeight,
    gl: elMin + avgHeight,
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
 * elevation. Crossing points are collected in trace order and paired
 * into chords — purely a visual aid in the plan view.
 */
export function contourSegments(vs: Vertex[], closed: boolean, level: number): ContourSegment[] {
  const crossings: { x: number; y: number }[] = [];
  for (const [a, b] of traceEdges(vs, closed)) {
    const da = a.el - level;
    const db = b.el - level;
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

/** A readable contour step for the given elevation range. */
export function contourStep(range: number): number {
  if (range <= 1.5) return 0.5;
  if (range <= 4) return 1;
  if (range <= 8) return 2;
  return 3;
}

/** Contour levels worth drawing: multiples of the step within the EL range. */
export function contourLevels(vs: Vertex[]): number[] {
  const elMin = Math.min(...vs.map((v) => v.el));
  const elMax = Math.max(...vs.map((v) => v.el));
  const step = contourStep(elMax - elMin);
  const levels: number[] = [];
  for (let l = Math.ceil(elMin / step) * step; l < elMax; l += step) {
    if (l > elMin) levels.push(Math.round(l * 100) / 100);
  }
  return levels;
}
