import { contourLevels, unfoldSection, type Vertex, type WglResult } from './geometry';

interface Props {
  vertices: Vertex[];
  result: WglResult;
}

const W = 640;
const H = 280;
const PAD_L = 42;
const PAD_R = 64;
const PAD_T = 36;
const PAD_B = 44;

export default function SectionView({ vertices, result }: Props) {
  const pts = unfoldSection(vertices);
  const total = pts[pts.length - 1].d;
  const hTop = Math.max(result.hMax, result.wgl) * 1.12 + 0.5;
  const hBase = Math.min(result.hMin, 0);

  const px = (d: number) => PAD_L + (d / total) * (W - PAD_L - PAD_R);
  const py = (h: number) => PAD_T + (1 - (h - hBase) / (hTop - hBase)) * (H - PAD_T - PAD_B);

  const profile = pts.map((p) => `${px(p.d)},${py(p.h)}`).join(' ');
  const areaPoly = [
    ...pts.map((p) => `${px(p.d)},${py(p.h)}`),
    `${px(total)},${py(result.hMin)}`,
    `${px(0)},${py(result.hMin)}`,
  ].join(' ');

  const levels = contourLevels(vertices);
  const ticks: number[] = [];
  for (let t = Math.ceil(hBase); t <= Math.floor(hTop); t++) ticks.push(t);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full select-none">
      <title>Unfolded perimeter section with the weighted ground level line</title>
      <defs>
        <pattern
          id="hatch"
          width="9"
          height="9"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="9" stroke="rgba(255,255,255,0.13)" strokeWidth="1" />
        </pattern>
      </defs>

      <polygon points={areaPoly} fill="url(#hatch)" stroke="none" />

      {ticks.map((t) => (
        <text key={t} x={PAD_L - 8} y={py(t) + 3} fill="#6f6f6f" fontSize={10} textAnchor="end">
          {t}
        </text>
      ))}

      {levels.map((l) => (
        <g key={l}>
          <line
            x1={PAD_L}
            y1={py(l)}
            x2={W - PAD_R}
            y2={py(l)}
            stroke="#9a6a3c"
            strokeWidth={1}
            strokeDasharray="6 5"
          />
          <text x={W - PAD_R + 6} y={py(l) + 3} fill="#9a6a3c" fontSize={12}>
            {l.toFixed(1)}
          </text>
        </g>
      ))}

      <line
        x1={PAD_L}
        y1={py(result.wgl)}
        x2={W - PAD_R}
        y2={py(result.wgl)}
        stroke="#d98e3f"
        strokeWidth={2.5}
        strokeDasharray="10 6"
      />
      <text
        x={W - PAD_R + 6}
        y={py(result.wgl) + 3}
        fill="#d98e3f"
        fontSize={12.5}
        fontWeight={700}
      >
        WGL {result.wgl.toFixed(2)}
      </text>

      <polyline points={profile} fill="none" stroke="#fff" strokeWidth={2} />

      {pts.map((p, i) => {
        const isClosing = i === pts.length - 1;
        // put the FH label below valleys, above peaks, to dodge the profile
        const prev = pts[Math.max(i - 1, 0)].h;
        const next = pts[Math.min(i + 1, pts.length - 1)].h;
        const below = p.h <= prev && p.h <= next;
        return (
          <g key={`${p.label}-${p.d.toFixed(3)}`}>
            <circle cx={px(p.d)} cy={py(p.h)} r={6.5} fill="#fff" />
            <text
              x={px(p.d)}
              y={py(p.h) + (below ? 22 : -14)}
              fill="#cfcfcf"
              fontSize={15}
              textAnchor={i === 0 ? 'start' : isClosing ? 'end' : 'middle'}
            >
              FH:{p.h.toFixed(2)}
            </text>
            <text
              x={px(p.d)}
              y={H - 12}
              fill="#fff"
              fontSize={19}
              fontWeight={700}
              textAnchor="middle"
            >
              {p.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
