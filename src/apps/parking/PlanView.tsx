import { useRef } from 'react';
import {
  distToSegment,
  edgeLength,
  type Layout,
  type Obstacle,
  type Pt,
  type Stall,
} from './geometry';

interface Props {
  verts: Pt[];
  obstacles: Obstacle[];
  layout: Layout;
  onMove: (index: number, x: number, y: number) => void;
  onInsert: (afterIndex: number, p: Pt) => void;
  onRemove: (index: number) => void;
  onObstacleChange: (id: string, verts: Pt[]) => void;
}

type Drag =
  | { kind: 'site'; index: number }
  | { kind: 'obsVert'; id: string; index: number }
  | { kind: 'obsBody'; id: string; start: Pt; orig: Pt[] };

const W = 760;
const H = 560;
const PAD = 64;

const stallKey = (s: Stall) => s.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
const round2 = (v: number) => Math.round(v * 100) / 100;

export default function PlanView({
  verts,
  obstacles,
  layout,
  onMove,
  onInsert,
  onRemove,
  onObstacleChange,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);

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
    const drag = dragRef.current;
    if (!drag) return;
    const p = toPlan(e.clientX, e.clientY);
    if (!p) return;
    if (drag.kind === 'site') {
      onMove(drag.index, round2(p.x), round2(p.y));
    } else if (drag.kind === 'obsVert') {
      const o = obstacles.find((ob) => ob.id === drag.id);
      if (o) {
        onObstacleChange(
          drag.id,
          o.verts.map((v, j) => (j === drag.index ? { x: round2(p.x), y: round2(p.y) } : v)),
        );
      }
    } else {
      const dx = round2(p.x - drag.start.x);
      const dy = round2(p.y - drag.start.y);
      onObstacleChange(
        drag.id,
        drag.orig.map((v) => ({ x: round2(v.x + dx), y: round2(v.y + dy) })),
      );
    }
  };

  // double-click a vertex to delete it, an edge to insert a vertex on it;
  // obstacle handles win over the site boundary
  const handleDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const p = toPlan(e.clientX, e.clientY);
    if (!p) return;
    const hit = 12 / scale; // pick radius in meters

    let obsVert: { o: Obstacle; index: number; d: number } | null = null;
    let obsEdge: { o: Obstacle; index: number; d: number } | null = null;
    for (const o of obstacles) {
      for (let i = 0; i < o.verts.length; i++) {
        const dv = Math.hypot(p.x - o.verts[i].x, p.y - o.verts[i].y);
        if (!obsVert || dv < obsVert.d) obsVert = { o, index: i, d: dv };
        const de = distToSegment(p, o.verts[i], o.verts[(i + 1) % o.verts.length]);
        if (!obsEdge || de < obsEdge.d) obsEdge = { o, index: i, d: de };
      }
    }
    if (obsVert && obsVert.d < hit) {
      const { o, index } = obsVert;
      if (o.verts.length > 3) {
        onObstacleChange(
          o.id,
          o.verts.filter((_, j) => j !== index),
        );
      }
      return;
    }
    if (obsEdge && obsEdge.d < hit) {
      const { o, index } = obsEdge;
      onObstacleChange(o.id, [
        ...o.verts.slice(0, index + 1),
        { x: round2(p.x), y: round2(p.y) },
        ...o.verts.slice(index + 1),
      ]);
      return;
    }

    let bestVert = -1;
    let bestVertD = Infinity;
    for (let i = 0; i < verts.length; i++) {
      const d = Math.hypot(p.x - verts[i].x, p.y - verts[i].y);
      if (d < bestVertD) {
        bestVertD = d;
        bestVert = i;
      }
    }
    if (bestVert >= 0 && bestVertD < hit) {
      onRemove(bestVert);
      return;
    }
    let bestEdge = -1;
    let bestEdgeD = Infinity;
    for (let i = 0; i < verts.length; i++) {
      const d = distToSegment(p, verts[i], verts[(i + 1) % verts.length]);
      if (d < bestEdgeD) {
        bestEdgeD = d;
        bestEdge = i;
      }
    }
    if (bestEdge >= 0 && bestEdgeD < hit) {
      onInsert(bestEdge, { x: round2(p.x), y: round2(p.y) });
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
  const toPath = (poly: Pt[]) =>
    `M ${poly.map((p) => `${px(p.x).toFixed(2)} ${py(p.y).toFixed(2)}`).join(' L ')} Z`;
  const toPoints = (poly: Pt[]) => poly.map((p) => `${px(p.x)},${py(p.y)}`).join(' ');
  const edgeKey = (a: Pt, b: Pt) => `${a.x},${a.y}:${b.x},${b.y}`;

  const { ringOuter, ringInner } = layout;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full touch-none font-mono select-none"
      onPointerMove={handlePointerMove}
      onPointerUp={() => {
        dragRef.current = null;
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      onDoubleClick={handleDoubleClick}
    >
      <title>Parking layout — edge stalls, inner stalls, circulation aisle and blocks</title>
      <defs>
        <pattern
          id="parking-hatch"
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="7" height="7" className="fill-amber-600/10 dark:fill-amber-500/10" />
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="7"
            strokeWidth="1.1"
            className="stroke-amber-700/40 dark:stroke-amber-400/35"
          />
        </pattern>
        <pattern
          id="parking-block-hatch"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-45)"
        >
          <rect width="6" height="6" className="fill-(--color-card)" />
          <line x1="0" y1="0" x2="0" y2="6" strokeWidth="1" className="stroke-(--hatch)" />
        </pattern>
      </defs>

      {gridLines}

      <text x={14} y={24} fontSize={11} letterSpacing="0.22em" className="fill-(--draw-faint)">
        ① LAYOUT
      </text>

      <polygon
        points={toPoints(verts)}
        className="fill-(--surface-tint) stroke-(--draw-strong)"
        strokeWidth={1.5}
      />

      {ringOuter && ringInner && (
        <path
          d={`${toPath(ringOuter)} ${toPath(ringInner)}`}
          fillRule="evenodd"
          fill="url(#parking-hatch)"
          stroke="none"
        />
      )}
      {ringOuter && (
        <polygon
          points={toPoints(ringOuter)}
          fill="none"
          strokeWidth={1.2}
          strokeDasharray="6 5"
          className="stroke-amber-700/70 dark:stroke-amber-400/60"
        />
      )}
      {ringInner && (
        <polygon
          points={toPoints(ringInner)}
          fill="none"
          strokeWidth={1.2}
          strokeDasharray="6 5"
          className="stroke-amber-700/70 dark:stroke-amber-400/60"
        />
      )}

      {[...layout.edge, ...layout.inner].map((s) => (
        <polygon
          key={stallKey(s)}
          points={toPoints(s)}
          strokeWidth={1}
          className="fill-(--surface-tint) stroke-(--draw-strong)"
        />
      ))}

      {obstacles.map((o) => {
        const ocx = o.verts.reduce((s, v) => s + v.x, 0) / o.verts.length;
        const ocy = o.verts.reduce((s, v) => s + v.y, 0) / o.verts.length;
        return (
          <g key={o.id}>
            <polygon
              points={toPoints(o.verts)}
              fill="url(#parking-block-hatch)"
              strokeWidth={1.5}
              className="cursor-move stroke-(--draw-strong)"
              onPointerDown={(e) => {
                const p = toPlan(e.clientX, e.clientY);
                if (p) dragRef.current = { kind: 'obsBody', id: o.id, start: p, orig: o.verts };
              }}
            />
            <text
              x={px(ocx)}
              y={py(ocy)}
              fontSize={11}
              letterSpacing="0.18em"
              textAnchor="middle"
              dominantBaseline="middle"
              className="pointer-events-none fill-(--draw-mid) uppercase"
            >
              {o.kind}
            </text>
            {o.verts.map((v, i) => (
              <circle
                // biome-ignore lint/suspicious/noArrayIndexKey: vertices have no stable identity
                key={i}
                cx={px(v.x)}
                cy={py(v.y)}
                r={4.5}
                strokeWidth={1.5}
                className="cursor-grab fill-(--color-card) stroke-(--draw-strong)"
                onPointerDown={() => {
                  dragRef.current = { kind: 'obsVert', id: o.id, index: i };
                }}
              />
            ))}
          </g>
        );
      })}

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
            {edgeLength(a, b).toFixed(1)}m
          </text>
        );
      })}

      {verts.map((v, i) => (
        <circle
          // biome-ignore lint/suspicious/noArrayIndexKey: vertices have no stable identity
          key={i}
          cx={px(v.x)}
          cy={py(v.y)}
          r={6.5}
          strokeWidth={1.5}
          className="cursor-grab fill-(--draw-strong) stroke-(--color-card)"
          onPointerDown={() => {
            dragRef.current = { kind: 'site', index: i };
          }}
        />
      ))}
    </svg>
  );
}
