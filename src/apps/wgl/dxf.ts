/**
 * Minimal DXF (ASCII) reader for importing surveyed site boundaries.
 *
 * Supports the entities that matter for a site plan: LWPOLYLINE and
 * POLYLINE/VERTEX boundaries, and TEXT/MTEXT labels (used to pick up
 * "EL+25.62"-style spot elevations near boundary vertices).
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

export interface DxfText {
  x: number;
  y: number;
  text: string;
}

export interface DxfData {
  polylines: DxfPolyline[];
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
  const texts: DxfText[] = [];

  let entity = '';
  let poly: DxfPolyline | null = null; // LWPOLYLINE or POLYLINE being collected
  let inPolylineBlock = false; // between POLYLINE and SEQEND
  let pendingX: number | null = null;
  let text: DxfText | null = null;

  const flush = () => {
    if (poly && poly.points.length >= 2) polylines.push(poly);
    poly = null;
    if (text?.text) texts.push(text);
    text = null;
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

  return { polylines, texts };
}

/**
 * Korean survey drawings are usually drawn in millimetres. If the model
 * extents look implausibly large for metres, scale down by 1000.
 */
export function detectScale(polylines: DxfPolyline[]): number {
  let maxSpan = 0;
  for (const p of polylines) {
    const xs = p.points.map((pt) => pt.x);
    const ys = p.points.map((pt) => pt.y);
    maxSpan = Math.max(
      maxSpan,
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
    );
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
