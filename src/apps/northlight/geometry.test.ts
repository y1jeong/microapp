import { describe, expect, it } from 'vitest';
import {
  columnInterval,
  computeFloors,
  deviatingEdges,
  footprintAt,
  polygonArea,
  setbackAt,
} from './geometry';

const square = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

// two towers (x 0..10 and x 20..30, depth 30) joined by a high bridge
// (x 10..20, y 20..30) — vertically simple but splits under a deep setback
const towers = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 20 },
  { x: 20, y: 20 },
  { x: 20, y: 0 },
  { x: 30, y: 0 },
  { x: 30, y: 30 },
  { x: 0, y: 30 },
];

const rule = { threshold: 9, base: 1.5, ratio: 0.5 };

describe('setbackAt', () => {
  it('uses the base setback up to the threshold', () => {
    expect(setbackAt(3, rule)).toBe(1.5);
    expect(setbackAt(9, rule)).toBe(1.5);
  });

  it('uses h * ratio above the threshold', () => {
    expect(setbackAt(12, rule)).toBe(6);
    expect(setbackAt(24, rule)).toBe(12);
  });

  it('never drops below the base setback', () => {
    expect(setbackAt(10, { threshold: 9, base: 6, ratio: 0.5 })).toBe(6);
  });
});

describe('columnInterval', () => {
  it('returns the vertical cross-section of the polygon', () => {
    expect(columnInterval(square, 5)).toEqual({ lo: 0, hi: 10 });
    expect(columnInterval(towers, 15)).toEqual({ lo: 20, hi: 30 });
  });

  it('returns null outside the polygon', () => {
    expect(columnInterval(square, 20)).toBeNull();
  });
});

describe('footprintAt', () => {
  it('reproduces the site at zero setback', () => {
    const fp = footprintAt(square, 0);
    expect(fp.area).toBeCloseTo(100);
    expect(fp.polys).toHaveLength(1);
  });

  it('trims the setback off the north side', () => {
    const fp = footprintAt(square, 1.5);
    expect(fp.area).toBeCloseTo(85);
    const ys = fp.polys[0].map((p) => p.y);
    expect(Math.max(...ys)).toBeCloseTo(8.5);
    expect(Math.min(...ys)).toBeCloseTo(0);
  });

  it('vanishes when the setback exceeds the site depth', () => {
    const fp = footprintAt(square, 12);
    expect(fp.area).toBe(0);
    expect(fp.polys).toHaveLength(0);
  });

  it('splits into components when the bridge falls away', () => {
    // s=15: bridge columns are y 20..30, so 30-15 < 20 leaves only the towers
    const fp = footprintAt(towers, 15);
    expect(fp.polys).toHaveLength(2);
    expect(fp.area).toBeCloseTo(2 * 10 * 15);
  });

  it('stays connected under a shallow setback', () => {
    const fp = footprintAt(towers, 5);
    expect(fp.polys).toHaveLength(1);
    expect(fp.area).toBeCloseTo(polygonArea(towers) - 30 * 5);
  });
});

describe('computeFloors', () => {
  it('caps the floor count where the footprint vanishes', () => {
    // square is 10 m deep: top of floor n is 3n, setback 1.5n above 9 m,
    // so floor 6 (top 18 m, setback 9 m) is the last with area >= 1 m²
    const floors = computeFloors(square, rule, 20, 3);
    expect(floors).toHaveLength(6);
    expect(floors[5].area).toBeCloseTo(10 * 1);
  });

  it('keeps full footprints below the threshold', () => {
    const floors = computeFloors(square, rule, 3, 3);
    for (const f of floors) expect(f.area).toBeCloseTo(85);
  });

  it('returns nothing when even the base setback consumes the site', () => {
    expect(computeFloors(square, { ...rule, base: 11 }, 5, 3)).toHaveLength(0);
  });
});

describe('deviatingEdges', () => {
  it('keeps only edges off the site boundary', () => {
    const fp = footprintAt(square, 1.5);
    const edges = deviatingEdges(fp.polys[0], square);
    // the lowered north edge plus the two short verticals reaching up to it
    expect(edges.length).toBeGreaterThanOrEqual(1);
    for (const [a, b] of edges) {
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      expect(mid.y).toBeGreaterThan(0);
    }
  });

  it('drops everything at zero setback', () => {
    const fp = footprintAt(square, 0);
    expect(deviatingEdges(fp.polys[0], square)).toHaveLength(0);
  });
});
