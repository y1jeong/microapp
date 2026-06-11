import { describe, expect, it } from 'vitest';
import {
  chainLines,
  detectScale,
  extractCandidates,
  nearestElevation,
  parseDxf,
  parseElevation,
  simplifyCollinear,
} from './dxf';

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

const ln = (x1: number, y1: number, x2: number, y2: number, layer = 'BND') =>
  [
    '0',
    'LINE',
    '8',
    layer,
    '10',
    String(x1),
    '20',
    String(y1),
    '11',
    String(x2),
    '21',
    String(y2),
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

  it('reads LINE entities', () => {
    const data = parseDxf(wrap(ln(0, 0, 5, 5)));
    expect(data.lines).toEqual([{ a: { x: 0, y: 0 }, b: { x: 5, y: 5 }, layer: 'BND' }]);
  });

  it('reads TEXT labels with position', () => {
    const data = parseDxf(wrap(text(5, 6, 'EL+25.62')));
    expect(data.texts).toEqual([{ x: 5, y: 6, text: 'EL+25.62' }]);
  });
});

describe('chainLines', () => {
  it('chains shuffled, partly reversed lines into a closed loop', () => {
    const data = parseDxf(
      wrap([ln(10, 0, 10, 8), ln(0, 0, 10, 0), ln(0, 8, 0, 0), ln(0, 8, 10, 8)].join('\n')),
    );
    const polys = chainLines(data.lines);
    expect(polys).toHaveLength(1);
    expect(polys[0].closed).toBe(true);
    expect(polys[0].points).toHaveLength(4);
    expect(polys[0].layer).toBe('BND');
  });

  it('keeps an unclosed run open', () => {
    const data = parseDxf(wrap([ln(0, 0, 10, 0), ln(10, 0, 10, 8)].join('\n')));
    const polys = chainLines(data.lines);
    expect(polys).toHaveLength(1);
    expect(polys[0].closed).toBe(false);
    expect(polys[0].points).toHaveLength(3);
  });

  it('does not chain across layers', () => {
    const data = parseDxf(wrap([ln(0, 0, 10, 0, 'A'), ln(10, 0, 10, 8, 'B')].join('\n')));
    expect(chainLines(data.lines)).toHaveLength(2);
  });
});

describe('simplifyCollinear', () => {
  it('drops redundant mid-edge points', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 8 },
      { x: 0, y: 8 },
    ];
    expect(simplifyCollinear(pts, true)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 8 },
      { x: 0, y: 8 },
    ]);
  });

  it('preserves the endpoints of open traces', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(simplifyCollinear(pts, false)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
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

describe('extractCandidates', () => {
  it('combines polylines and chained lines, mm-scaled, largest closed first', () => {
    // a millimetre site plan: a big closed parcel polyline, a boundary drawn
    // as loose lines, a tiny annotation box (noise), and EL spot labels
    const entities = [
      lw(
        true,
        [
          [0, 0],
          [28000, 0],
          [28000, 11000],
          [0, 11000],
        ],
        '대지경계',
      ),
      ln(40000, 0, 40000, 10000, '도로'),
      ln(40000, 10000, 41000, 21000, '도로'),
      lw(
        true,
        [
          [100, 100],
          [400, 100],
          [400, 400],
          [100, 400],
        ],
        'TITLE',
      ),
      text(100, -300, 'EL+24.30'),
      text(28100, 200, 'EL+26.30'),
    ].join('\n');
    const { scale, candidates } = extractCandidates(parseDxf(wrap(entities)));

    expect(scale).toBe(0.001);
    // the 0.3 m title box is filtered out as noise
    expect(candidates).toHaveLength(2);
    expect(candidates[0].closed).toBe(true);
    expect(candidates[0].layer).toBe('대지경계');
    expect(candidates[0].area).toBeCloseTo(28 * 11);
    expect(candidates[0].points[0].el).toBe(24.3);
    expect(candidates[0].points[1].el).toBe(26.3);
    expect(candidates[1].closed).toBe(false);
    expect(candidates[1].source).toBe('lines');
    expect(candidates[1].points).toHaveLength(3);
  });
});
