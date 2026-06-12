import { describe, expect, it } from 'vitest';
import {
  computeFloors,
  DEFAULT_PARAMS,
  distToBoundary,
  footprintAt,
  polyArea,
  setbackFor,
} from './geometry';

// 20 m wide × 30 m deep rectangle, north edge at y=30
const rect = [
  { x: 0, y: 0 },
  { x: 20, y: 0 },
  { x: 20, y: 30 },
  { x: 0, y: 30 },
];

describe('footprintAt', () => {
  it('shrinks a rectangle from the north only', () => {
    const fp = footprintAt(rect, 5);
    expect(fp.area).toBeCloseTo(20 * 25);
    expect(fp.polys).toHaveLength(1);
    const maxY = Math.max(...fp.polys[0].map((p) => p.y));
    const minY = Math.min(...fp.polys[0].map((p) => p.y));
    expect(maxY).toBeCloseTo(25); // north edge moved south by the setback
    expect(minY).toBeCloseTo(0); // south edge untouched
  });

  it('vanishes when the setback exceeds the site depth', () => {
    const fp = footprintAt(rect, 31);
    expect(fp.area).toBeCloseTo(0);
    expect(fp.polys).toHaveLength(0);
  });
});

describe('setbackFor', () => {
  it('uses the base setback at or below the threshold', () => {
    expect(setbackFor(DEFAULT_PARAMS, 9)).toBe(1.5);
  });

  it('uses h × ratio above the threshold', () => {
    expect(setbackFor(DEFAULT_PARAMS, 12)).toBe(6);
    expect(setbackFor(DEFAULT_PARAMS, 30)).toBe(15);
  });
});

describe('computeFloors', () => {
  it('stops when the slope plane consumes the site', () => {
    // 3 m floors: 1–3F at 1.5 m setback; from 4F (12 m) setback = h/2,
    // the footprint vanishes once h/2 >= 30 m depth → 19F (57m, s=28.5) is
    // the last floor with ≥1 m² left
    const floors = computeFloors(rect, { ...DEFAULT_PARAMS, floors: 30 });
    expect(floors.length).toBe(19);
    expect(floors[0].area).toBeCloseTo(20 * 28.5);
    expect(floors.at(-1)?.area).toBeGreaterThan(1);
  });

  it('respects the requested floor cap', () => {
    expect(computeFloors(rect, { ...DEFAULT_PARAMS, floors: 5 })).toHaveLength(5);
  });
});

describe('helpers', () => {
  it('computes area and boundary distance', () => {
    expect(polyArea(rect)).toBeCloseTo(600);
    expect(distToBoundary({ x: 10, y: 15 }, rect)).toBeCloseTo(10);
  });
});
