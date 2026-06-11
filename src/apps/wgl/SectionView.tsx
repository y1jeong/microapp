import { contourLevels, type Parcel, unfoldSection, type WglResult } from './geometry';

interface Props {
  parcel: Parcel;
  result: WglResult;
}

const W = 640;
const H = 320;
const PAD_L = 46;
const PAD_R = 78;
const PAD_T = 64;
const PAD_B = 44;

export default function SectionView({ parcel, result }: Props) {
  const pts = unfoldSection(parcel.vertices, parcel.closed);
  const total = pts[pts.length - 1].d;

  const range = Math.max(result.elMax - result.elMin, 0.1);
  const hTop = Math.max(result.elMax, result.gl) + range * 0.2 + 0.2;
  const hBase = result.elMin - range * 0.18 - 0.1;

  const px = (d: number) => PAD_L + (d / total) * (W - PAD_L - PAD_R);
  const py = (el: number) => PAD_T + (1 - (el - hBase) / (hTop - hBase)) * (H - PAD_T - PAD_B);

  const profile = pts.map((p) => `${px(p.d)},${py(p.el)}`).join(' ');
  const areaPoly = [
    ...pts.map((p) => `${px(p.d)},${py(p.el)}`),
    `${px(total)},${py(result.elMin)}`,
    `${px(0)},${py(result.elMin)}`,
  ].join(' ');

  const levels = contourLevels(parcel.vertices);
  const tickStep = range > 6 ? 2 : range > 2.5 ? 1 : 0.5;
  const ticks: number[] = [];
  for (let t = Math.ceil(hBase / tickStep) * tickStep; t <= hTop; t += tickStep) {
    ticks.push(Math.round(t * 100) / 100);
  }

  const dimY = 30;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full select-none">
      <title>Unfolded ground section with the weighted average level</title>
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

      {/* dimension band: numbered points and segment lengths, like the drawing */}
      <line x1={px(0)} y1={dimY} x2={px(total)} y2={dimY} stroke="#5a5a5a" strokeWidth={1} />
      {pts.map((p, i) => {
        const isClosing = parcel.closed && i === pts.length - 1;
        const n = isClosing ? 1 : i + 1;
        return (
          <g key={`dim-${p.label}-${p.d.toFixed(3)}`}>
            <line
              x1={px(p.d)}
              y1={dimY - 5}
              x2={px(p.d)}
              y2={dimY + 5}
              stroke="#5a5a5a"
              strokeWidth={1}
            />
            <circle
              cx={px(p.d)}
              cy={dimY - 16}
              r={9}
              fill="none"
              stroke="#8a8a8a"
              strokeWidth={1}
            />
            <text x={px(p.d)} y={dimY - 12.5} fill="#bfbfbf" fontSize={10.5} textAnchor="middle">
              {n}
            </text>
          </g>
        );
      })}
      {pts.slice(0, -1).map((p, i) => {
        const next = pts[i + 1];
        return (
          <text
            key={`len-${p.label}-${p.d.toFixed(3)}`}
            x={px((p.d + next.d) / 2)}
            y={dimY + 14}
            fill="#8a8a8a"
            fontSize={10.5}
            textAnchor="middle"
          >
            {(next.d - p.d).toFixed(2)}
          </text>
        );
      })}
      <text x={px(total) + 8} y={dimY + 3} fill="#6f6f6f" fontSize={10.5}>
        Σ {total.toFixed(2)}m
      </text>

      <polygon points={areaPoly} fill="url(#hatch)" stroke="none" />

      {ticks.map((t) => (
        <text key={t} x={PAD_L - 8} y={py(t) + 3} fill="#6f6f6f" fontSize={10} textAnchor="end">
          {t.toFixed(tickStep < 1 ? 1 : 0)}
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
          <text x={W - PAD_R + 6} y={py(l) + 3} fill="#9a6a3c" fontSize={11}>
            EL+{l.toFixed(1)}
          </text>
        </g>
      ))}

      <line
        x1={PAD_L}
        y1={py(result.gl)}
        x2={W - PAD_R}
        y2={py(result.gl)}
        stroke="#d98e3f"
        strokeWidth={2.5}
        strokeDasharray="10 6"
      />
      <text x={W - PAD_R + 6} y={py(result.gl) - 4} fill="#d98e3f" fontSize={11.5} fontWeight={700}>
        G.L±0
      </text>
      <text x={W - PAD_R + 6} y={py(result.gl) + 9} fill="#d98e3f" fontSize={11.5} fontWeight={700}>
        EL+{result.gl.toFixed(2)}
      </text>

      <polyline points={profile} fill="none" stroke="#fff" strokeWidth={2} />

      {pts.map((p, i) => {
        const isClosing = parcel.closed && i === pts.length - 1;
        // put the EL label below valleys, above peaks, to dodge the profile
        const prev = pts[Math.max(i - 1, 0)].el;
        const next = pts[Math.min(i + 1, pts.length - 1)].el;
        const below = p.el <= prev && p.el <= next;
        return (
          <g key={`${p.label}-${p.d.toFixed(3)}`}>
            <circle cx={px(p.d)} cy={py(p.el)} r={6} fill="#fff" />
            <text
              x={px(p.d)}
              y={py(p.el) + (below ? 21 : -13)}
              fill="#cfcfcf"
              fontSize={13.5}
              textAnchor={i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}
            >
              EL+{p.el.toFixed(2)}
            </text>
            <text
              x={px(p.d)}
              y={H - 12}
              fill="#fff"
              fontSize={17}
              fontWeight={700}
              textAnchor="middle"
            >
              {isClosing ? pts[0].label : p.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
