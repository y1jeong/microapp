import { describe, expect, it } from 'vitest';
import { detectScale, nearestElevation, parseDxf, parseElevation } from './dxf';

const lw = (closed: boolean, pts: [number, number][], layer = 'SITE') =>
  [
    '0',
    'LWPOLYLINE',
    '8',
    layer,
    '90',
    String(pts.length),
    '70',
    closed ? '1' : '0',
    ...pts.flatMap(([x, y]) => ['10', String(x), '20', String(y)]),
  ].join('\n');

const text = (x: number, y: number, value: string) =>
  ['0', 'TEXT', '10', String(x), '20', String(y), '1', value].join('\n');

const wrap = (entities: string) =>
  ['0', 'SECTION', '2', 'ENTITIES', entities, '0', 'ENDSEC', '0', 'EOF'].join('\n');

describe('parseDxf', () => {
  it('reads LWPOLYLINE vertices, closed flag, and layer', () => {
    const data = parseDxf(
      wrap(
        [
          lw(true, [
            [0, 0],
            [10, 0],
            [10, 5],
          ]),
          lw(false, [
            [0, 0],
            [20, 0],
          ]),
        ].join('\n'),
      ),
    );
    expect(data.polylines).toHaveLength(2);
    expect(data.polylines[0].closed).toBe(true);
    expect(data.polylines[0].layer).toBe('SITE');
    expect(data.polylines[0].points).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
    ]);
    expect(data.polylines[1].closed).toBe(false);
  });

  it('reads legacy POLYLINE/VERTEX/SEQEND blocks', () => {
    const entities = [
      '0',
      'POLYLINE',
      '8',
      'BNDRY',
      '70',
      '1',
      '0',
      'VERTEX',
      '10',
      '1.5',
      '20',
      '2.5',
      '0',
      'VERTEX',
      '10',
      '3.0',
      '20',
      '4.0',
      '0',
      'SEQEND',
    ].join('\n');
    const data = parseDxf(wrap(entities));
    expect(data.polylines).toHaveLength(1);
    expect(data.polylines[0].closed).toBe(true);
    expect(data.polylines[0].points).toEqual([
      { x: 1.5, y: 2.5 },
      { x: 3, y: 4 },
    ]);
  });

  it('reads TEXT labels with position', () => {
    const data = parseDxf(wrap(text(5, 6, 'EL+25.62')));
    expect(data.texts).toEqual([{ x: 5, y: 6, text: 'EL+25.62' }]);
  });
});

describe('elevation labels', () => {
  it('parses EL formats', () => {
    expect(parseElevation('EL+25.62')).toBe(25.62);
    expect(parseElevation('EL + 23.18')).toBe(23.18);
    expect(parseElevation('el-1.5')).toBe(-1.5);
    expect(parseElevation('① EL+58.45')).toBe(58.45);
    expect(parseElevation('도로중심선')).toBeNull();
  });

  it('finds the nearest elevation label within tolerance', () => {
    const texts = [
      { x: 0.5, y: 0.5, text: 'EL+10.00' },
      { x: 100, y: 100, text: 'EL+99.00' },
    ];
    expect(nearestElevation(0, 0, texts, 1)).toBe(10);
    expect(nearestElevation(50, 50, texts, 1)).toBeNull();
  });
});

describe('detectScale', () => {
  it('detects millimetre drawings', () => {
    const mm = parseDxf(
      wrap(
        lw(true, [
          [0, 0],
          [77996, 0],
          [77996, 40294],
        ]),
      ),
    );
    expect(detectScale(mm.polylines)).toBe(0.001);
  });

  it('keeps metre drawings unscaled', () => {
    const m = parseDxf(
      wrap(
        lw(true, [
          [0, 0],
          [78, 0],
          [78, 40],
        ]),
      ),
    );
    expect(detectScale(m.polylines)).toBe(1);
  });
});
