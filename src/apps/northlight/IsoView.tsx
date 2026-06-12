import {
  type Floor,
  type Footprint,
  floorColor,
  isoProject,
  type Pt,
  type SetbackRule,
} from './geometry';

interface Props {
  verts: Pt[];
  floors: Floor[];
  baseFootprint: Footprint;
  rule: SetbackRule;
}

interface Level {
  z: number;
  polys: Pt[][];
  color: string;
  label: string | null;
  dash: boolean;
}

const W = 520;
const H = 560;
const PAD_X = 92;
const PAD_Y = 46;

export default function IsoView({ verts, floors, baseFootprint, rule }: Props) {
  const levels: Level[] = [
    { z: 0, polys: [verts], color: 'rgba(232,234,237,0.65)', label: 'GL 0m', dash: false },
    ...floors.map((f) => ({
      z: f.topZ,
      polys: f.polys,
      color: floorColor(f.level, floors.length),
      label: `${f.level}F ${+f.topZ.toFixed(1)}m`,
      dash: false,
    })),
  ];
  if (rule.threshold > 0 && floors.length > 0 && floors[floors.length - 1].topZ > rule.threshold) {
    // a floor topping out exactly at the threshold would overlap the 사선 label
    for (const lv of levels) {
      if (Math.abs(lv.z - rule.threshold) < 0.01) lv.label = null;
    }
    levels.push({
      z: rule.threshold,
      polys: baseFootprint.polys,
      color: '#e05d5d',
      label: `사선 ${+rule.threshold.toFixed(1)}m`,
      dash: true,
    });
    levels.sort((a, b) => a.z - b.z);
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const lv of levels) {
    for (const poly of lv.polys) {
      for (const p of poly) {
        const q = isoProject(p.x, p.y, lv.z);
        minX = Math.min(minX, q.x);
        minY = Math.min(minY, q.y);
        maxX = Math.max(maxX, q.x);
        maxY = Math.max(maxY, q.y);
      }
    }
  }
  const scale = Math.min(
    (W - 2 * PAD_X) / Math.max(maxX - minX, 0.1),
    (H - 2 * PAD_Y) / Math.max(maxY - minY, 0.1),
  );
  const toScreen = (p: Pt, z: number): Pt => {
    const q = isoProject(p.x, p.y, z);
    return {
      x: (W - (maxX - minX) * scale) / 2 + (q.x - minX) * scale - 26,
      y: (H + (maxY - minY) * scale) / 2 - (q.y - minY) * scale,
    };
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full select-none">
      <title>Isometric stack of buildable floor plates</title>
      {levels.map((lv) => {
        let rightmost: Pt | null = null;
        const plates = lv.polys.map((poly) => {
          const pts = poly.map((p) => {
            const s = toScreen(p, lv.z);
            if (!rightmost || s.x > rightmost.x) rightmost = s;
            return `${s.x.toFixed(1)},${s.y.toFixed(1)}`;
          });
          return (
            <polygon
              key={pts[0]}
              points={pts.join(' ')}
              fill="none"
              stroke={lv.color}
              strokeWidth={lv.dash ? 1.5 : 1.75}
              strokeDasharray={lv.dash ? '6 5' : undefined}
            />
          );
        });
        const anchor = rightmost as Pt | null;
        return (
          <g key={`${lv.z}:${lv.label ?? 'level'}`}>
            {plates}
            {anchor && lv.label && (
              <text x={anchor.x + 10} y={anchor.y + 4} fill={lv.color} fontSize={13}>
                –{lv.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
