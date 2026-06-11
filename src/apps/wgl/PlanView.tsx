import { useRef } from 'react';
import {
  Vertex,
  contourLevels,
  contourSegments,
  edgeLength,
  polygonArea,
  vertexLabel,
} from './geometry';

interface Props {
  vertices: Vertex[];
  wgl: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
}

const W = 640;
const H = 420;
const PAD = 70;

export default function PlanView({ vertices, wgl, selectedId, onSelect, onMove }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragId = useRef<string | null>(null);

  const xs = vertices.map((v) => v.x);
  const ys = vertices.map((v) => v.y);
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

  const toPlan = (clientX: number, clientY: number) => {
    const svg = svgRef.current!;
    const ctm = svg.getScreenCTM();
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

  const area = polygonArea(vertices);
  const cx = vertices.reduce((s, v) => s + v.x, 0) / vertices.length;
  const cy = vertices.reduce((s, v) => s + v.y, 0) / vertices.length;

  const levels = contourLevels(vertices);
  const contours = levels.flatMap((l) => contourSegments(vertices, l));
  const wglContours = contourSegments(vertices, wgl);

  const ring = vertices.map((v) => `${px(v.x)},${py(v.y)}`).join(' ');

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="view-svg"
      onPointerMove={handlePointerMove}
      onPointerUp={() => (dragId.current = null)}
      onPointerCancel={() => (dragId.current = null)}
    >
      <polygon points={ring} fill="rgba(255,255,255,0.04)" stroke="#cfcfcf" strokeWidth={1.5} />

      {contours.map((s, i) => (
        <g key={`c${i}`}>
          <line
            x1={px(s.x1)}
            y1={py(s.y1)}
            x2={px(s.x2)}
            y2={py(s.y2)}
            stroke="#b07a45"
            strokeWidth={1.2}
            strokeDasharray="6 5"
          />
          <text x={px(s.x1) - 6} y={py(s.y1) - 4} className="lbl-contour" textAnchor="end">
            {s.level.toFixed(1)}m
          </text>
        </g>
      ))}
      {wglContours.map((s, i) => (
        <line
          key={`w${i}`}
          x1={px(s.x1)}
          y1={py(s.y1)}
          x2={px(s.x2)}
          y2={py(s.y2)}
          stroke="#d98e3f"
          strokeWidth={2.5}
          strokeDasharray="9 6"
        />
      ))}

      {vertices.map((v, i) => {
        const b = vertices[(i + 1) % vertices.length];
        const mx = px((v.x + b.x) / 2);
        const my = py((v.y + b.y) / 2);
        return (
          <text key={`e${v.id}`} x={mx} y={my - 8} className="lbl-edge" textAnchor="middle">
            {edgeLength(v, b).toFixed(2)}
          </text>
        );
      })}

      <text x={px(cx)} y={py(cy)} className="lbl-area" textAnchor="middle">
        {area.toFixed(2)} m²
      </text>

      {vertices.map((v, i) => {
        // push labels outward from the centroid so they sit outside the ring
        const dx = v.x - cx;
        const dy = v.y - cy;
        const len = Math.hypot(dx, dy) || 1;
        const lx = px(v.x) + (dx / len) * 26;
        const ly = py(v.y) - (dy / len) * 26;
        return (
          <g
            key={v.id}
            className="vertex"
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
              fill="#fff"
              stroke={v.id === selectedId ? '#d98e3f' : 'none'}
              strokeWidth={3}
            />
            <text x={lx} y={ly - 8} className="lbl-vertex" textAnchor="middle">
              {vertexLabel(i)}
            </text>
            <text x={lx} y={ly + 10} className="lbl-fh" textAnchor="middle">
              FH:{v.fh.toFixed(2)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
