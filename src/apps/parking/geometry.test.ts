import { describe, expect, it } from 'vitest';
import {
  computeLayout,
  distToBoundary,
  insetPolygon,
  pointInPolygon,
  polygonArea,
  polysIntersect,
  rectsOverlap,
  type Stall,
  signedArea,
} from './geometry';

const square = [
  { x: 0, y: 0 },
  { x: 40, y: 0 },
  { x: 40, y: 40 },
  { x: 0, y: 40 },
];

// 50×50 with the top-right 25×25 quadrant removed
const lShape = [
  { x: 0, y: 0 },
  { x: 50, y: 0 },
  { x: 50, y: 25 },
  { x: 25, y: 25 },
  { x: 25, y: 50 },
  { x: 0, y: 50 },
];

const params = { stallW: 2.5, stallD: 5, aisleW: 6 };

const rect = (x0: number, y0: number, x1: number, y1: number): Stall => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

/** all corners inside the polygon, tested a hair toward the stall center */
const stallInside = (s: Stall, verts: { x: number; y: number }[]) => {
  const cx = (s[0].x + s[2].x) / 2;
  const cy = (s[0].y + s[2].y) / 2;
  return s.every((c) =>
    pointInPolygon({ x: c.x + (cx - c.x) * 1e-3, y: c.y + (cy - c.y) * 1e-3 }, verts),
  );
};

describe('polygonArea / signedArea', () => {
  it('measures the square and detects orientation', () => {
    expect(polygonArea(square)).toBe(1600);
    expect(signedArea(square)).toBe(1600);
    expect(signedArea([...square].reverse())).toBe(-1600);
    expect(polygonArea(lShape)).toBe(1875);
  });
});

describe('pointInPolygon', () => {
  it('classifies interior and exterior points', () => {
    expect(pointInPolygon({ x: 20, y: 20 }, square)).toBe(true);
    expect(pointInPolygon({ x: 41, y: 20 }, square)).toBe(false);
    expect(pointInPolygon({ x: 40, y: 40 }, lShape)).toBe(false);
    expect(pointInPolygon({ x: 10, y: 40 }, lShape)).toBe(true);
  });
});

describe('rectsOverlap', () => {
  const a = rect(0, 0, 2.5, 5);
  it('detects overlapping and contained rects', () => {
    expect(rectsOverlap(a, rect(2, 0, 4.5, 5))).toBe(true);
    expect(rectsOverlap(a, rect(1, 1, 1.5, 2))).toBe(true);
  });
  it('treats stalls sharing an edge as separate', () => {
    expect(rectsOverlap(a, rect(2.5, 0, 5, 5))).toBe(false);
  });
  it('rejects disjoint rects, including rotated ones', () => {
    expect(rectsOverlap(a, rect(10, 10, 12, 14))).toBe(false);
    const diamond: Stall = [
      { x: 1.25, y: 1.5 },
      { x: 2.25, y: 2.5 },
      { x: 1.25, y: 3.5 },
      { x: 0.25, y: 2.5 },
    ];
    expect(rectsOverlap(a, diamond)).toBe(true);
    const farDiamond: Stall = diamond.map((p) => ({ x: p.x + 20, y: p.y })) as Stall;
    expect(rectsOverlap(a, farDiamond)).toBe(false);
  });
});

describe('polysIntersect', () => {
  const a = rect(0, 0, 10, 10);
  it('detects crossing and contained polygons', () => {
    expect(polysIntersect(a, rect(5, 5, 15, 15))).toBe(true);
    expect(polysIntersect(a, rect(2, 2, 4, 4))).toBe(true);
    expect(polysIntersect(rect(2, 2, 4, 4), a)).toBe(true);
    // cross shape: edges intersect but no vertex inside the other
    expect(polysIntersect(rect(-1, 4, 11, 6), rect(4, -1, 6, 11))).toBe(true);
  });
  it('treats shared walls and disjoint polygons as clear', () => {
    expect(polysIntersect(a, rect(10, 0, 14, 10))).toBe(false);
    expect(polysIntersect(a, rect(20, 0, 24, 10))).toBe(false);
  });
  it('flags coincident polygons even though only boundaries touch', () => {
    expect(polysIntersect(a, rect(0, 0, 10, 10))).toBe(true);
  });
});

describe('insetPolygon', () => {
  it('shrinks a square by d on every side', () => {
    const inner = insetPolygon(square, 5);
    expect(inner).not.toBeNull();
    expect(polygonArea(inner as never)).toBeCloseTo(900);
    for (const p of inner ?? []) {
      expect(distToBoundary(p, square)).toBeCloseTo(5);
    }
  });

  it('normalizes clockwise input', () => {
    const inner = insetPolygon([...square].reverse(), 5);
    expect(inner).not.toBeNull();
    expect(polygonArea(inner as never)).toBeCloseTo(900);
  });

  it('returns null when the offset swallows the site', () => {
    expect(insetPolygon(square, 25)).toBeNull();
    expect(
      insetPolygon(
        [
          { x: 0, y: 0 },
          { x: 12, y: 0 },
          { x: 12, y: 12 },
          { x: 0, y: 12 },
        ],
        11,
      ),
    ).toBeNull();
  });
});

describe('computeLayout', () => {
  it('fills a 40 m square with the expected stall counts', () => {
    const layout = computeLayout(square, params);
    // perimeter: 16 on the first edge, then 11/11/6 — later edges stop
    // an aisle short of every corner so no stall is trapped
    expect(layout.edge).toHaveLength(44);
    // core is 18×18: one back-to-back pair, 7 rows
    expect(layout.inner).toHaveLength(14);
    expect(layout.ringOuter).not.toBeNull();
    expect(layout.ringInner).not.toBeNull();
    expect(polygonArea(layout.ringOuter as never)).toBeCloseTo(30 * 30);
    expect(polygonArea(layout.ringInner as never)).toBeCloseTo(18 * 18);
  });

  it('keeps every stall inside the site without overlaps', () => {
    for (const verts of [square, lShape]) {
      const layout = computeLayout(verts, params);
      const all = [...layout.edge, ...layout.inner];
      expect(all.length).toBeGreaterThan(0);
      for (const s of all) {
        expect(stallInside(s, verts)).toBe(true);
      }
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          expect(rectsOverlap(all[i], all[j])).toBe(false);
        }
      }
    }
  });

  it('keeps an open maneuvering aisle in front of every edge stall', () => {
    for (const verts of [square, lShape]) {
      const layout = computeLayout(verts, params);
      const all = [...layout.edge, ...layout.inner];
      for (const s of layout.edge) {
        // corners 0/1 sit on the boundary, 3→0 is the inward direction
        const len = Math.hypot(s[3].x - s[0].x, s[3].y - s[0].y);
        const inward = { x: (s[3].x - s[0].x) / len, y: (s[3].y - s[0].y) / len };
        const zone: Stall = [
          s[3],
          s[2],
          { x: s[2].x + inward.x * params.aisleW, y: s[2].y + inward.y * params.aisleW },
          { x: s[3].x + inward.x * params.aisleW, y: s[3].y + inward.y * params.aisleW },
        ];
        for (const other of all) {
          if (other !== s) expect(rectsOverlap(zone, other)).toBe(false);
        }
      }
    }
  });

  it('keeps inner stalls clear of the circulation band', () => {
    const layout = computeLayout(lShape, params);
    const margin = params.stallD + params.aisleW;
    for (const s of layout.inner) {
      for (const c of s) {
        expect(distToBoundary(c, lShape)).toBeGreaterThanOrEqual(margin - 1e-6);
      }
    }
  });

  it('drops stalls under obstacle polygons', () => {
    // block exactly covering the square's inner column pair
    const core = rect(15, 11, 25, 29);
    const layout = computeLayout(square, params, [core]);
    expect(layout.inner).toHaveLength(0);
    expect(layout.edge).toHaveLength(44);

    // block lying across the bottom edge run
    const ramp = rect(10, 2, 30, 4);
    const withRamp = computeLayout(square, params, [ramp]);
    expect(withRamp.edge).toHaveLength(36);
    expect(withRamp.inner).toHaveLength(14);
  });

  it('keeps all stalls clear of every obstacle', () => {
    const blocks = [rect(13, 13, 21, 19), rect(6, 30, 12, 42)];
    for (const verts of [square, lShape]) {
      const layout = computeLayout(verts, params, blocks);
      for (const s of [...layout.edge, ...layout.inner]) {
        for (const b of blocks) {
          expect(polysIntersect(s, b)).toBe(false);
        }
      }
    }
  });

  it('blocks stalls on tall sites where columns run transposed', () => {
    const tall = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 60 },
      { x: 0, y: 60 },
    ];
    // core is 8×38: two pairs and a trailing single, 3 stalls each
    expect(computeLayout(tall, params).inner).toHaveLength(15);
    // covers the middle pair and sits within an aisle of the column facing it
    const block = rect(11, 25, 19, 35);
    const layout = computeLayout(tall, params, [block]);
    expect(layout.inner).toHaveLength(6);
    for (const s of layout.inner) {
      expect(polysIntersect(s, block)).toBe(false);
    }
  });

  it('ignores obstacles outside the site', () => {
    const far = rect(100, 100, 110, 110);
    expect(computeLayout(square, params, [far])).toEqual(computeLayout(square, params));
  });

  it('handles sites too small for anything', () => {
    const tiny = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 2, y: 3 },
    ];
    const layout = computeLayout(tiny, params);
    expect(layout.edge).toHaveLength(0);
    expect(layout.inner).toHaveLength(0);
    expect(layout.ringOuter).toBeNull();
    expect(layout.ringInner).toBeNull();
  });

  it('returns an empty layout for degenerate input', () => {
    const layout = computeLayout([{ x: 0, y: 0 }], params);
    expect(layout.edge).toHaveLength(0);
    expect(layout.inner).toHaveLength(0);
  });
});
