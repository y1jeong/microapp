import { useRef } from 'react';
import {
  deviatingEdges,
  distToSegment,
  edgeLength,
  type Floor,
  type Footprint,
  floorColor,
  type Pt,
  polygonArea,
} from './geometry';

interface Props {
  verts: Pt[];
  floors: Floor[];
  baseFootprint: Footprint;
  onMove: (index: number, x: number, y: number) => void;
  onInsert: (afterIndex: number, p: Pt) => void;
  onRemove: (index: number) => void;
}

const W = 520;
const H = 560;
const PAD = 64;

export default function PlanView({
  verts,
  floors,
  baseFootprint,
  onMove,
  onInsert,
  onRemove,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragIdx = useRef<number | null>(null);

  const xs = verts.map((v) => v.x);
  const ys = verts.map((v) => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scale = Math.min(
    (W - 2 * PAD) / Math.max(maxX - minX, 0.1),
    (H - 2 * PAD) / Math.max(maxY - minY, 0.1),
  );
  const ox = (W - (maxX - minX) * scale) / 2;
  const oy = (H - (maxY - minY) * scale) / 2;
  const px = (x: number) => ox + (x - minX) * scale;
  const py = (y: number) => oy + (maxY - y) * scale; // north up

  const toPlan = (clientX: number, clientY: number): Pt | null => {
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return null;
    const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: minX + (pt.x - ox) / scale, y: maxY - (pt.y - oy) / scale };
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragIdx.current === null) return;
    const p = toPlan(e.clientX, e.clientY);
    if (p) onMove(dragIdx.current, Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100);
  };

  const handleDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const p = toPlan(e.clientX, e.clientY);
    if (!p) return;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < verts.length; i++) {
      const d = distToSegment(p, verts[i], verts[(i + 1) % verts.length]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0 && bestD * scale < 12) {
      onInsert(best, { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 });
    }
  };

  const gridLines = [];
  for (let gx = Math.ceil((minX - PAD / scale) / 5) * 5; gx <= maxX + PAD / scale; gx += 5) {
    gridLines.push(
      <line
        key={`gx${gx}`}
        x1={px(gx)}
        y1={0}
        x2={px(gx)}
        y2={H}
        className="stroke-(--draw-grid)"
      />,
    );
  }
  for (let gy = Math.ceil((minY - PAD / scale) / 5) * 5; gy <= maxY + PAD / scale; gy += 5) {
    gridLines.push(
      <line
        key={`gy${gy}`}
        x1={0}
        y1={py(gy)}
        x2={W}
        y2={py(gy)}
        className="stroke-(--draw-grid)"
      />,
    );
  }

  const cx = verts.reduce((s, v) => s + v.x, 0) / verts.length;
  const cy = verts.reduce((s, v) => s + v.y, 0) / verts.length;
  const sitePath = verts.map((v) => `${px(v.x)},${py(v.y)}`).join(' ');
  const edgeKey = (a: Pt, b: Pt) => `${a.x},${a.y}:${b.x},${b.y}`;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full touch-none font-mono select-none"
      onPointerMove={handlePointerMove}
      onPointerUp={() => {
        dragIdx.current = null;
      }}
      onPointerCancel={() => {
        dragIdx.current = null;
      }}
      onDoubleClick={handleDoubleClick}
    >
      <title>Site plan with per-floor northlight setback lines</title>

      {gridLines}

      <polygon
        points={sitePath}
        className="fill-(--surface-tint) stroke-(--draw-strong)"
        strokeWidth={1.5}
      />

      {floors.map((f) =>
        f.polys.flatMap((poly) =>
          deviatingEdges(poly, verts).map(([a, b]) => (
            <line
              key={`f${f.level}:${edgeKey(a, b)}`}
              x1={px(a.x)}
              y1={py(a.y)}
              x2={px(b.x)}
              y2={py(b.y)}
              stroke={floorColor(f.level, floors.length)}
              strokeWidth={1.5}
            />
          )),
        ),
      )}

      {baseFootprint.polys.flatMap((poly) =>
        deviatingEdges(poly, verts).map(([a, b]) => (
          <line
            key={`b${edgeKey(a, b)}`}
            x1={px(a.x)}
            y1={py(a.y)}
            x2={px(b.x)}
            y2={py(b.y)}
            className="stroke-(--color-accent)"
            strokeWidth={1.5}
            strokeDasharray="6 5"
          />
        )),
      )}

      {verts.map((v, i) => {
        const a = v;
        const b = verts[(i + 1) % verts.length];
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const dx = mx - cx;
        const dy = my - cy;
        const len = Math.hypot(dx, dy) || 1;
        return (
          <text
            key={`e${edgeKey(a, b)}`}
            x={px(mx) + (dx / len) * 26}
            y={py(my) - (dy / len) * 26}
            className="fill-(--draw-mid)"
            fontSize={13}
            textAnchor="middle"
          >
            E{i + 1}: {edgeLength(a, b).toFixed(1)}m
          </text>
        );
      })}

      <text
        x={px(cx)}
        y={py(cy)}
        className="fill-(--draw-strong)"
        fontSize={22}
        fontWeight={600}
        letterSpacing="0.04em"
        textAnchor="middle"
      >
        {polygonArea(verts).toFixed(1)} m²
      </text>

      {verts.map((v, i) => (
        <circle
          // biome-ignore lint/suspicious/noArrayIndexKey: vertices have no stable identity
          key={i}
          cx={px(v.x)}
          cy={py(v.y)}
          r={7}
          strokeWidth={2}
          className="cursor-grab fill-(--color-card) stroke-(--draw-strong)"
          onPointerDown={(e) => {
            if (e.altKey) {
              onRemove(i);
              return;
            }
            dragIdx.current = i;
          }}
        />
      ))}

      <g className="fill-(--color-accent) stroke-(--color-accent)">
        <line x1={W - 40} y1={88} x2={W - 40} y2={44} strokeWidth={3} />
        <path d={`M ${W - 40} 30 l -9 18 h 18 z`} stroke="none" />
        <text x={W - 40} y={112} fontSize={16} fontWeight={700} textAnchor="middle" stroke="none">
          N
        </text>
      </g>
    </svg>
  );
}
