/**
 * Minimal DXF (ASCII) reader for importing surveyed site boundaries.
 *
 * Site-plan drawings (배치도) carry hundreds of entities, so importing is a
 * two-step affair: parse boundary-shaped geometry — LWPOLYLINE / POLYLINE
 * entities plus LINE segments chained into loops — then let the user pick
 * which candidates are the 대지/인접대지/도로 boundaries. TEXT/MTEXT labels
 * are matched to vertices to pick up "EL+25.62"-style spot elevations.
 */

export interface DxfPoint {
  x: number;
  y: number;
}

export interface DxfPolyline {
  points: DxfPoint[];
  closed: boolean;
  layer: string;
}

export interface DxfLine {
  a: DxfPoint;
  b: DxfPoint;
  layer: string;
}

export interface DxfText {
  x: number;
  y: number;
  text: string;
}

export interface DxfData {
  polylines: DxfPolyline[];
  lines: DxfLine[];
  texts: DxfText[];
}

interface Pair {
  code: number;
  value: string;
}

function* pairs(content: string): Generator<Pair> {
  const lines = content.split(/\r\n|\r|\n/);
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number.parseInt(lines[i].trim(), 10);
    if (Number.isNaN(code)) continue;
    yield { code, value: lines[i + 1].trim() };
  }
}

export function parseDxf(content: string): DxfData {
  const polylines: DxfPolyline[] = [];
  const lines: DxfLine[] = [];
  const texts: DxfText[] = [];

  let entity = '';
  let poly: DxfPolyline | null = null; // LWPOLYLINE or POLYLINE being collected
  let inPolylineBlock = false; // between POLYLINE and SEQEND
  let pendingX: number | null = null;
  let text: DxfText | null = null;
  let line: { x1?: number; y1?: number; x2?: number; y2?: number; layer: string } | null = null;

  const flush = () => {
    if (poly && poly.points.length >= 2) polylines.push(poly);
    poly = null;
    if (text?.text) texts.push(text);
    text = null;
    if (
      line &&
      line.x1 !== undefined &&
      line.y1 !== undefined &&
      line.x2 !== undefined &&
      line.y2 !== undefined
    ) {
      lines.push({
        a: { x: line.x1, y: line.y1 },
        b: { x: line.x2, y: line.y2 },
        layer: line.layer,
      });
    }
    line = null;
    pendingX = null;
  };

  for (const { code, value } of pairs(content)) {
    if (code === 0) {
      if (value === 'VERTEX' && inPolylineBlock) {
        entity = 'VERTEX';
        pendingX = null;
        continue;
      }
      if (value === 'SEQEND' && inPolylineBlock) {
        inPolylineBlock = false;
        flush();
        entity = '';
        continue;
      }
      if (!inPolylineBlock) flush();
      entity = value;
      if (value === 'LWPOLYLINE') {
        poly = { points: [], closed: false, layer: '' };
      } else if (value === 'POLYLINE') {
        poly = { points: [], closed: false, layer: '' };
        inPolylineBlock = true;
      } else if (value === 'LINE') {
        line = { layer: '' };
      } else if (value === 'TEXT' || value === 'MTEXT') {
        text = { x: 0, y: 0, text: '' };
      }
      continue;
    }

    switch (entity) {
      case 'LWPOLYLINE':
        if (!poly) break;
        if (code === 8) poly.layer = value;
        else if (code === 70) poly.closed = (Number.parseInt(value, 10) & 1) === 1;
        else if (code === 10) pendingX = Number.parseFloat(value);
        else if (code === 20 && pendingX !== null) {
          poly.points.push({ x: pendingX, y: Number.parseFloat(value) });
          pendingX = null;
        }
        break;
      case 'POLYLINE':
        if (!poly) break;
        if (code === 8) poly.layer = value;
        else if (code === 70) poly.closed = (Number.parseInt(value, 10) & 1) === 1;
        break;
      case 'VERTEX':
        if (!poly) break;
        if (code === 10) pendingX = Number.parseFloat(value);
        else if (code === 20 && pendingX !== null) {
          poly.points.push({ x: pendingX, y: Number.parseFloat(value) });
          pendingX = null;
        }
        break;
      case 'LINE':
        if (!line) break;
        if (code === 8) line.layer = value;
        else if (code === 10) line.x1 = Number.parseFloat(value);
        else if (code === 20) line.y1 = Number.parseFloat(value);
        else if (code === 11) line.x2 = Number.parseFloat(value);
        else if (code === 21) line.y2 = Number.parseFloat(value);
        break;
      case 'TEXT':
      case 'MTEXT':
        if (!text) break;
        if (code === 10) text.x = Number.parseFloat(value);
        else if (code === 20) text.y = Number.parseFloat(value);
        else if (code === 1 || code === 3) text.text += value;
        break;
      default:
        break;
    }
  }
  flush();

  return { polylines, lines, texts };
}

function extent(points: DxfPoint[]): { spanX: number; spanY: number } {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    spanX: Math.max(...xs) - Math.min(...xs),
    spanY: Math.max(...ys) - Math.min(...ys),
  };
}

/**
 * Chain individual LINE segments into polylines: boundaries in site plans
 * are often drawn as loose lines rather than polylines. Segments are
 * chained per layer wherever endpoints coincide (within `tol` drawing
 * units); a chain whose ends meet becomes a closed loop.
 */
export function chainLines(lines: DxfLine[], tol?: number): DxfPolyline[] {
  if (lines.length === 0) return [];
  const span = Math.max(
    ...lines.map((l) => Math.max(Math.abs(l.b.x - l.a.x), Math.abs(l.b.y - l.a.y))),
    1,
  );
  const t = tol ?? Math.max(span * 1e-6, 1e-9);

  const byLayer = new Map<string, DxfLine[]>();
  for (const l of lines) {
    const list = byLayer.get(l.layer) ?? [];
    list.push(l);
    byLayer.set(l.layer, list);
  }

  const result: DxfPolyline[] = [];
  for (const [layer, segs] of byLayer) {
    // endpoint spatial hash: cell key -> [segment index, which end]
    const key = (p: DxfPoint) => `${Math.round(p.x / t)},${Math.round(p.y / t)}`;
    const ends = new Map<string, [number, 0 | 1][]>();
    segs.forEach((s, i) => {
      for (const [p, e] of [
        [s.a, 0],
        [s.b, 1],
      ] as const) {
        const k = key(p);
        const list = ends.get(k) ?? [];
        list.push([i, e]);
        ends.set(k, list);
      }
    });
    const used = new Array(segs.length).fill(false);
    const same = (p: DxfPoint, q: DxfPoint) => Math.abs(p.x - q.x) <= t && Math.abs(p.y - q.y) <= t;

    const takeNext = (tip: DxfPoint): DxfPoint | null => {
      // search the tip's cell and its 8 neighbours
      const cx = Math.round(tip.x / t);
      const cy = Math.round(tip.y / t);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (const [i, e] of ends.get(`${cx + dx},${cy + dy}`) ?? []) {
            if (used[i]) continue;
            const here = e === 0 ? segs[i].a : segs[i].b;
            if (!same(tip, here)) continue;
            used[i] = true;
            return e === 0 ? segs[i].b : segs[i].a;
          }
        }
      }
      return null;
    };

    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      const chain: DxfPoint[] = [segs[i].a, segs[i].b];
      for (
        let next = takeNext(chain[chain.length - 1]);
        next;
        next = takeNext(chain[chain.length - 1])
      ) {
        chain.push(next);
      }
      for (let prev = takeNext(chain[0]); prev; prev = takeNext(chain[0])) {
        chain.unshift(prev);
      }
      let closed = false;
      if (chain.length > 3 && same(chain[0], chain[chain.length - 1])) {
        chain.pop();
        closed = true;
      }
      result.push({ points: chain, closed, layer });
    }
  }
  return result;
}

/** Drop vertices that sit on a straight line between their neighbours. */
export function simplifyCollinear(points: DxfPoint[], closed: boolean): DxfPoint[] {
  if (points.length < 3) return points;
  const keep: DxfPoint[] = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    if (!closed && (i === 0 || i === n - 1)) {
      keep.push(points[i]);
      continue;
    }
    const p = points[(i - 1 + n) % n];
    const c = points[i];
    const q = points[(i + 1) % n];
    const ax = c.x - p.x;
    const ay = c.y - p.y;
    const bx = q.x - c.x;
    const by = q.y - c.y;
    const cross = ax * by - ay * bx;
    const scale = Math.hypot(ax, ay) * Math.hypot(bx, by);
    if (scale === 0 || Math.abs(cross) / scale > 1e-6) keep.push(c);
  }
  return keep.length >= (closed ? 3 : 2) ? keep : points;
}

/**
 * Korean survey drawings are usually drawn in millimetres. If the model
 * extents look implausibly large for metres, scale down by 1000.
 */
export function detectScale(polylines: DxfPolyline[]): number {
  let maxSpan = 0;
  for (const p of polylines) {
    const { spanX, spanY } = extent(p.points);
    maxSpan = Math.max(maxSpan, spanX, spanY);
  }
  return maxSpan > 2000 ? 0.001 : 1;
}

const EL_RE = /EL\s*[+]?\s*(-?\d+(?:\.\d+)?)/i;

/** Parse "EL+25.62"-style spot elevation labels. */
export function parseElevation(label: string): number | null {
  const m = EL_RE.exec(label);
  return m ? Number.parseFloat(m[1]) : null;
}

/**
 * Find the elevation label nearest to a point (within `tolerance` metres),
 * so imported boundary vertices pick up their surveyed EL automatically.
 */
export function nearestElevation(
  x: number,
  y: number,
  texts: DxfText[],
  scale: number,
  tolerance = 5,
): number | null {
  let best: number | null = null;
  let bestDist = tolerance;
  for (const t of texts) {
    const el = parseElevation(t.text);
    if (el === null) continue;
    const d = Math.hypot(t.x * scale - x, t.y * scale - y);
    if (d < bestDist) {
      bestDist = d;
      best = el;
    }
  }
  return best;
}

export interface CandidatePoint {
  x: number;
  y: number;
  el: number | null;
}

/** A boundary the user can pick from the import dialog, in metres. */
export interface BoundaryCandidate {
  key: string;
  points: CandidatePoint[];
  closed: boolean;
  layer: string;
  source: 'polyline' | 'lines';
  /** plan area m² (closed candidates only) */
  area: number;
  /** ground-contact length, m */
  length: number;
  spanX: number;
  spanY: number;
  elMatched: number;
}

function shoelace(points: DxfPoint[]): number {
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

function runLength(points: DxfPoint[], closed: boolean): number {
  let len = 0;
  const n = closed ? points.length : points.length - 1;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}

export interface ExtractOptions {
  /** ignore boundaries smaller than this span, metres */
  minSpan?: number;
  /** keep at most this many candidates */
  limit?: number;
}

/**
 * Boil a parsed site plan down to boundary candidates: explicit polylines
 * plus loops chained from LINE work, scaled to metres, de-noised, with
 * spot elevations matched to vertices. Sorted with closed boundaries
 * first (largest area first), then open traces by length.
 */
export function extractCandidates(
  data: DxfData,
  { minSpan = 2, limit = 30 }: ExtractOptions = {},
): { scale: number; candidates: BoundaryCandidate[] } {
  const chained = chainLines(data.lines);
  const all: { poly: DxfPolyline; source: 'polyline' | 'lines' }[] = [
    ...data.polylines.map((poly) => ({ poly, source: 'polyline' as const })),
    ...chained.map((poly) => ({ poly, source: 'lines' as const })),
  ];
  const scale = detectScale(all.map((a) => a.poly));

  const candidates: BoundaryCandidate[] = [];
  all.forEach(({ poly, source }, idx) => {
    const raw = simplifyCollinear(poly.points, poly.closed).map((p) => ({
      x: Math.round(p.x * scale * 100) / 100,
      y: Math.round(p.y * scale * 100) / 100,
    }));
    if (poly.closed ? raw.length < 3 : raw.length < 2) return;
    const { spanX, spanY } = extent(raw);
    if (Math.max(spanX, spanY) < minSpan) return;
    const tolerance = Math.max(5, Math.max(spanX, spanY) * 0.05);
    const points = raw.map((p) => ({
      ...p,
      el: nearestElevation(p.x, p.y, data.texts, scale, tolerance),
    }));
    candidates.push({
      key: `${source}-${idx}`,
      points,
      closed: poly.closed,
      layer: poly.layer,
      source,
      area: poly.closed ? shoelace(raw) : 0,
      length: runLength(raw, poly.closed),
      spanX,
      spanY,
      elMatched: points.filter((p) => p.el !== null).length,
    });
  });

  candidates.sort((a, b) => {
    if (a.closed !== b.closed) return a.closed ? -1 : 1;
    return a.closed ? b.area - a.area : b.length - a.length;
  });
  return { scale, candidates: candidates.slice(0, limit) };
}
