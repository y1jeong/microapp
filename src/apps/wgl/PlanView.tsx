import { useRef } from 'react';
import {
  contourLevels,
  contourSegments,
  edgeLength,
  type Parcel,
  polygonArea,
  traceEdges,
  vertexLabel,
} from './geometry';

interface Props {
  parcels: Parcel[];
  activeId: string;
  gl: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
}

const W = 640;
const H = 420;
const PAD = 70;

export default function PlanView({ parcels, activeId, gl, selectedId, onSelect, onMove }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragId = useRef<string | null>(null);

  const all = parcels.flatMap((p) => p.vertices);
  const xs = all.map((v) => v.x);
  const ys = all.map((v) => v.y);
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

  const active = parcels.find((p) => p.id === activeId) ?? parcels[0];
  const vertices = active.vertices;

  const toPlan = (clientX: number, clientY: number) => {
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return null;
    const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return {
      x: minX + (pt.x - ox) / scale,
      y: maxY - (pt.y - oy) / scale,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragId.current) return;
    const p = toPlan(e.clientX, e.clientY);
    if (p) onMove(dragId.current, Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100);
  };

  const centroid = (p: Parcel) => ({
    x: p.vertices.reduce((s, v) => s + v.x, 0) / p.vertices.length,
    y: p.vertices.reduce((s, v) => s + v.y, 0) / p.vertices.length,
  });

  const area = polygonArea(vertices, active.closed);
  const { x: cx, y: cy } = centroid(active);

  const levels = active.closed ? contourLevels(vertices) : [];
  const contours = levels.flatMap((l) => contourSegments(vertices, active.closed, l));
  const glContours = active.closed ? contourSegments(vertices, active.closed, gl) : [];

  const path = (p: Parcel) => p.vertices.map((v) => `${px(v.x)},${py(v.y)}`).join(' ');

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full touch-none font-mono select-none"
      onPointerMove={handlePointerMove}
      onPointerUp={() => {
        dragId.current = null;
      }}
      onPointerCancel={() => {
        dragId.current = null;
      }}
    >
      <title>Plan view of parcels with surveyed ground elevations</title>

      {parcels
        .filter((p) => p.id !== active.id)
        .map((p) => {
          const c = centroid(p);
          return (
            <g key={p.id} opacity={0.55}>
              {p.closed ? (
                <polygon
                  points={path(p)}
                  fill="none"
                  className="stroke-(--draw-faint)"
                  strokeWidth={1}
                />
              ) : (
                <polyline
                  points={path(p)}
                  fill="none"
                  className="stroke-(--draw-faint)"
                  strokeWidth={1}
                  strokeDasharray="3 4"
                />
              )}
              {p.vertices.map((v) => (
                <circle
                  key={v.id}
                  cx={px(v.x)}
                  cy={py(v.y)}
                  r={3.5}
                  className="fill-(--draw-faint)"
                />
              ))}
              <text
                x={px(c.x)}
                y={py(c.y)}
                className="fill-(--draw-faint)"
                fontSize={12}
                textAnchor="middle"
              >
                {p.name}
              </text>
            </g>
          );
        })}

      {active.closed ? (
        <polygon
          points={path(active)}
          className="fill-(--surface-tint) stroke-(--draw-strong)"
          strokeWidth={1.5}
        />
      ) : (
        <polyline
          points={path(active)}
          fill="none"
          className="stroke-(--draw-strong)"
          strokeWidth={1.5}
          strokeDasharray="8 4"
        />
      )}

      {contours.map((s) => (
        <g
          key={`${s.level}:${s.x1.toFixed(3)},${s.y1.toFixed(3)},${s.x2.toFixed(3)},${s.y2.toFixed(3)}`}
        >
          <line
            x1={px(s.x1)}
            y1={py(s.y1)}
            x2={px(s.x2)}
            y2={py(s.y2)}
            className="stroke-(--color-accent-dim)"
            strokeWidth={1.2}
            strokeDasharray="6 5"
          />
          <text
            x={px(s.x1) - 6}
            y={py(s.y1) - 4}
            className="fill-(--color-accent-dim)"
            fontSize={12}
            textAnchor="end"
          >
            EL+{s.level.toFixed(1)}
          </text>
        </g>
      ))}
      {glContours.map((s) => (
        <line
          key={`g${s.x1.toFixed(3)},${s.y1.toFixed(3)}`}
          x1={px(s.x1)}
          y1={py(s.y1)}
          x2={px(s.x2)}
          y2={py(s.y2)}
          className="stroke-(--color-accent)"
          strokeWidth={2.5}
          strokeDasharray="9 6"
        />
      ))}

      {traceEdges(vertices, active.closed).map(([a, b]) => (
        <text
          key={`e${a.id}`}
          x={px((a.x + b.x) / 2)}
          y={py((a.y + b.y) / 2) - 8}
          className="fill-(--draw-mid)"
          fontSize={14}
          textAnchor="middle"
        >
          {edgeLength(a, b).toFixed(2)}
        </text>
      ))}

      {active.closed && (
        <text
          x={px(cx)}
          y={py(cy)}
          className="fill-(--draw-strong)"
          fontSize={26}
          fontWeight={600}
          letterSpacing="0.04em"
          textAnchor="middle"
        >
          {area.toFixed(2)} m²
        </text>
      )}

      {vertices.map((v, i) => {
        // push labels outward from the centroid so they sit outside the ring
        const dx = v.x - cx;
        const dy = v.y - cy;
        const len = Math.hypot(dx, dy) || 1;
        const lx = px(v.x) + (dx / len) * 26;
        const ly = py(v.y) - (dy / len) * 26;
        const selected = v.id === selectedId;
        return (
          <g
            key={v.id}
            className="cursor-grab"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture?.(e.pointerId);
              dragId.current = v.id;
              onSelect(v.id);
            }}
          >
            <circle
              cx={px(v.x)}
              cy={py(v.y)}
              r={11}
              className={`fill-(--color-card) ${selected ? 'stroke-(--color-accent)' : 'stroke-(--draw-strong)'}`}
              strokeWidth={selected ? 3 : 1.5}
            />
            <text
              x={lx}
              y={ly - 8}
              className="fill-(--draw-strong)"
              fontSize={19}
              fontWeight={700}
              textAnchor="middle"
            >
              {vertexLabel(i)}
            </text>
            <text
              x={lx}
              y={ly + 10}
              className="fill-(--draw-mid)"
              fontSize={15}
              textAnchor="middle"
            >
              EL+{v.el.toFixed(2)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
