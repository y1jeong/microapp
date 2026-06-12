import { describe, expect, it } from 'vitest';
import {
  computeWgl,
  contourLevels,
  contourSegments,
  makeVertex,
  polygonArea,
  traceLength,
  unfoldSection,
  vertexLabel,
} from './geometry';

const square = (els: [number, number, number, number]) => [
  makeVertex(0, 0, els[0]),
  makeVertex(10, 0, els[1]),
  makeVertex(10, 10, els[2]),
  makeVertex(0, 10, els[3]),
];

describe('polygon basics', () => {
  it('computes shoelace area regardless of winding', () => {
    const vs = square([0, 0, 0, 0]);
    expect(polygonArea(vs)).toBeCloseTo(100);
    expect(polygonArea([...vs].reverse())).toBeCloseTo(100);
  });

  it('returns zero area for open traces', () => {
    expect(polygonArea(square([0, 0, 0, 0]), false)).toBe(0);
  });

  it('computes contact length for closed and open traces', () => {
    const vs = square([0, 0, 0, 0]);
    expect(traceLength(vs, true)).toBeCloseTo(40);
    expect(traceLength(vs, false)).toBeCloseTo(30);
  });

  it('labels vertices A..Z then AA', () => {
    expect(vertexLabel(0)).toBe('A');
    expect(vertexLabel(25)).toBe('Z');
    expect(vertexLabel(26)).toBe('AA');
  });
});

describe('computeWgl on closed parcels', () => {
  it('equals the ground level on flat ground', () => {
    const r = computeWgl(square([5, 5, 5, 5]), true);
    expect(r.sectionArea).toBeCloseTo(0);
    expect(r.gl).toBeCloseTo(5);
  });

  it('averages a uniform slope', () => {
    const r = computeWgl(square([0, 4, 0, 4]), true);
    expect(r.elMin).toBe(0);
    // each 10 m edge contributes trapezoid (0+4)/2 * 10 = 20; 4 edges = 80
    expect(r.sectionArea).toBeCloseTo(80);
    expect(r.gl).toBeCloseTo(80 / 40);
  });

  it('weights longer edges more', () => {
    const long = [
      makeVertex(0, 0, 0),
      makeVertex(20, 0, 0),
      makeVertex(20, 5, 10),
      makeVertex(0, 5, 10),
    ];
    const r = computeWgl(long, true);
    // edges: 20m@(0,0)=0, 5m@(0,10)=25, 20m@(10,10)=200, 5m@(10,0)=25
    expect(r.sectionArea).toBeCloseTo(250);
    expect(r.gl).toBeCloseTo(250 / 50);
  });
});

describe('computeWgl on open road traces (도로 가중평균 수평면)', () => {
  it('reproduces the road calculation from the 심곡동 343-12,13 drawing', () => {
    // EL+25.73 → EL+26.01 over 20.88 m of road frontage:
    // area 2.92 m² / 20.88 m = 0.14 m; 25.73 + 0.14 = EL+25.87
    const road = [makeVertex(0, 0, 25.73), makeVertex(20.88, 0, 26.01)];
    const r = computeWgl(road, false);
    expect(r.contactLength).toBeCloseTo(20.88, 2);
    expect(r.sectionArea).toBeCloseTo(2.92, 2);
    expect(r.avgHeight).toBeCloseTo(0.14, 2);
    expect(r.gl).toBeCloseTo(25.87, 2);
  });

  it('does not include a closing edge', () => {
    // open V-shape: closing it would add a long flat edge and change the mean
    const vs = [makeVertex(0, 0, 2), makeVertex(10, 0, 0), makeVertex(20, 0, 2)];
    const r = computeWgl(vs, false);
    expect(r.contactLength).toBeCloseTo(20);
    expect(r.sectionArea).toBeCloseTo(20);
    expect(r.gl).toBeCloseTo(1);
  });
});

describe('unfoldSection', () => {
  it('closes back to the first vertex on closed traces', () => {
    const pts = unfoldSection(square([1, 2, 3, 4]), true);
    expect(pts).toHaveLength(5);
    expect(pts[0].label).toBe('A');
    expect(pts[4].label).toBe('A');
    expect(pts[4].d).toBeCloseTo(40);
    expect(pts[4].el).toBe(1);
  });

  it('stops at the last vertex on open traces', () => {
    const pts = unfoldSection(square([1, 2, 3, 4]), false);
    expect(pts).toHaveLength(4);
    expect(pts[3].label).toBe('D');
    expect(pts[3].d).toBeCloseTo(30);
  });
});

describe('contours', () => {
  it('finds chord across a sloped square', () => {
    const segs = contourSegments(square([0, 0, 10, 10]), true, 5);
    expect(segs).toHaveLength(1);
    expect(segs[0].y1).toBeCloseTo(5);
    expect(segs[0].y2).toBeCloseTo(5);
  });

  it('returns nothing when the level is outside the range', () => {
    expect(contourSegments(square([0, 0, 1, 1]), true, 5)).toHaveLength(0);
  });

  it('adapts the contour step to small EL ranges', () => {
    // EL 24.30..26.40 — a 3 m step would draw nothing; expect 1 m levels
    const levels = contourLevels(square([24.3, 25.8, 26.4, 25.6]));
    expect(levels).toEqual([25, 26]);
  });
});
