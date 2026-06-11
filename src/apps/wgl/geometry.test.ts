import { describe, expect, it } from 'vitest';
import {
  computeWgl,
  contourSegments,
  makeVertex,
  perimeter,
  polygonArea,
  unfoldSection,
  vertexLabel,
} from './geometry';

const square = (fhs: [number, number, number, number]) => [
  makeVertex(0, 0, fhs[0]),
  makeVertex(10, 0, fhs[1]),
  makeVertex(10, 10, fhs[2]),
  makeVertex(0, 10, fhs[3]),
];

describe('polygon basics', () => {
  it('computes shoelace area regardless of winding', () => {
    const vs = square([0, 0, 0, 0]);
    expect(polygonArea(vs)).toBeCloseTo(100);
    expect(polygonArea([...vs].reverse())).toBeCloseTo(100);
  });

  it('computes perimeter', () => {
    expect(perimeter(square([0, 0, 0, 0]))).toBeCloseTo(40);
  });

  it('labels vertices A..Z then AA', () => {
    expect(vertexLabel(0)).toBe('A');
    expect(vertexLabel(25)).toBe('Z');
    expect(vertexLabel(26)).toBe('AA');
  });
});

describe('computeWgl', () => {
  it('equals the ground level on flat ground', () => {
    const r = computeWgl(square([5, 5, 5, 5]));
    expect(r.sectionArea).toBeCloseTo(0);
    expect(r.wgl).toBeCloseTo(5);
  });

  it('averages a uniform slope', () => {
    // Two opposite sides at 0, two at 4, linear in between: the unfolded
    // profile is a symmetric zig-zag whose mean height is 2.
    const r = computeWgl(square([0, 4, 0, 4]));
    expect(r.hMin).toBe(0);
    // each 10 m edge contributes trapezoid (0+4)/2 * 10 = 20; 4 edges = 80
    expect(r.sectionArea).toBeCloseTo(80);
    expect(r.wgl).toBeCloseTo(80 / 40);
  });

  it('weights longer edges more', () => {
    // 20×5 rectangle, one short side raised: the high corner pair sits on
    // the short 5 m edge, so it should pull the average up less than if it
    // were on a 20 m edge.
    const long = [
      makeVertex(0, 0, 0),
      makeVertex(20, 0, 0),
      makeVertex(20, 5, 10),
      makeVertex(0, 5, 10),
    ];
    const r = computeWgl(long);
    // edges: 20m@(0,0)=0, 5m@(0,10)=25, 20m@(10,10)=200, 5m@(10,0)=25
    expect(r.sectionArea).toBeCloseTo(250);
    expect(r.wgl).toBeCloseTo(250 / 50);
  });
});

describe('unfoldSection', () => {
  it('closes back to the first vertex', () => {
    const pts = unfoldSection(square([1, 2, 3, 4]));
    expect(pts).toHaveLength(5);
    expect(pts[0].label).toBe('A');
    expect(pts[4].label).toBe('A');
    expect(pts[4].d).toBeCloseTo(40);
    expect(pts[4].h).toBe(1);
  });
});

describe('contourSegments', () => {
  it('finds chord across a sloped square', () => {
    const segs = contourSegments(square([0, 0, 10, 10]), 5);
    expect(segs).toHaveLength(1);
    // crossings at midpoints of the two side edges
    expect(segs[0].y1).toBeCloseTo(5);
    expect(segs[0].y2).toBeCloseTo(5);
  });

  it('returns nothing when the level is outside the range', () => {
    expect(contourSegments(square([0, 0, 1, 1]), 5)).toHaveLength(0);
  });
});
