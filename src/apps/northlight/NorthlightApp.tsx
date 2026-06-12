import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '../../theme';
import {
  computeFloors,
  DEFAULT_PARAMS,
  distToBoundary,
  distToSegment,
  type Floor,
  footprintAt,
  type Pt,
  polyArea,
  type RuleParams,
} from './geometry';

const STORAGE_KEY = 'northlight-state-v1';

/** Canvas colors come from the active theme's CSS variables. */
interface Palette {
  strong: string;
  mid: string;
  grid: string;
  card: string;
  tint: string;
  accent: string;
}

function readPalette(): Palette {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string) => s.getPropertyValue(name).trim();
  return {
    strong: v('--draw-strong'),
    mid: v('--draw-mid'),
    grid: v('--draw-grid'),
    card: v('--t-card'),
    tint: v('--surface-tint'),
    accent: v('--t-accent'),
  };
}

const DEFAULT_VERTS: Pt[] = [
  { x: 0.0, y: 31.5 },
  { x: 11.3, y: 32.0 },
  { x: 12.2, y: 22.3 },
  { x: 21.0, y: 21.6 },
  { x: 19.8, y: 2.5 },
  { x: 0.0, y: 0.0 },
];

interface PlanTransform {
  k: number;
  toScreen: (p: Pt) => Pt;
  toWorld: (sx: number, sy: number) => Pt;
}

function setupCanvas(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: rect.width, h: rect.height };
}

function floorColor(i: number, n: number): string {
  const hue = 215 - (n <= 1 ? 0 : ((i - 1) / (n - 1)) * 95);
  return `hsl(${hue} 75% 62%)`;
}

function makePlanTransform(verts: Pt[], w: number, h: number): PlanTransform {
  const xs = verts.map((v) => v.x);
  const ys = verts.map((v) => v.y);
  const minx = Math.min(...xs);
  const miny = Math.min(...ys);
  const maxx = Math.max(...xs);
  const maxy = Math.max(...ys);
  const pad = 70;
  const k = Math.min(
    (w - 2 * pad) / Math.max(1, maxx - minx),
    (h - 2 * pad) / Math.max(1, maxy - miny),
  );
  const ox = (w - k * (maxx - minx)) / 2 - k * minx;
  const oy = (h + k * (maxy - miny)) / 2 + k * miny;
  return {
    k,
    toScreen: (p) => ({ x: k * p.x + ox, y: oy - k * p.y }),
    toWorld: (sx, sy) => ({ x: (sx - ox) / k, y: (oy - sy) / k }),
  };
}

function chip(ctx: CanvasRenderingContext2D, pal: Palette, text: string, x: number, y: number) {
  ctx.font = '12px ui-monospace, Menlo, Consolas, monospace';
  const w = ctx.measureText(text).width + 12;
  ctx.fillStyle = pal.card;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 10, w, 20, 4);
  ctx.fill();
  ctx.fillStyle = pal.mid;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 0.5);
}

/**
 * Stroke only the parts of a floor outline that differ from the site
 * boundary, so stacked floors read as setback lines instead of one thick
 * multicolored border.
 */
function strokeDeviatingEdges(
  ctx: CanvasRenderingContext2D,
  poly: Pt[],
  verts: Pt[],
  T: PlanTransform,
) {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (distToBoundary(mid, verts) < 0.08 && distToBoundary(a, verts) < 0.08) continue;
    const sa = T.toScreen(a);
    const sb = T.toScreen(b);
    ctx.beginPath();
    ctx.moveTo(sa.x, sa.y);
    ctx.lineTo(sb.x, sb.y);
    ctx.stroke();
  }
}

function drawPlan(
  canvas: HTMLCanvasElement,
  pal: Palette,
  verts: Pt[],
  params: RuleParams,
  floors: Floor[],
): PlanTransform {
  const { ctx, w, h } = setupCanvas(canvas);
  const T = makePlanTransform(verts, w, h);

  // grid (5 m)
  ctx.strokeStyle = pal.grid;
  ctx.lineWidth = 1;
  const origin = T.toWorld(0, h);
  const corner = T.toWorld(w, 0);
  for (let gx = Math.floor(origin.x / 5) * 5; gx <= corner.x; gx += 5) {
    const s = T.toScreen({ x: gx, y: 0 });
    ctx.beginPath();
    ctx.moveTo(s.x, 0);
    ctx.lineTo(s.x, h);
    ctx.stroke();
  }
  for (let gy = Math.floor(origin.y / 5) * 5; gy <= corner.y; gy += 5) {
    const s = T.toScreen({ x: 0, y: gy });
    ctx.beginPath();
    ctx.moveTo(0, s.y);
    ctx.lineTo(w, s.y);
    ctx.stroke();
  }

  // site fill + outline
  ctx.beginPath();
  verts.forEach((v, i) => {
    const s = T.toScreen(v);
    if (i === 0) ctx.moveTo(s.x, s.y);
    else ctx.lineTo(s.x, s.y);
  });
  ctx.closePath();
  ctx.fillStyle = pal.tint;
  ctx.fill();
  ctx.strokeStyle = pal.strong;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // per-floor setback lines (only where they deviate from the site boundary)
  ctx.lineWidth = 1.5;
  for (const f of floors) {
    ctx.strokeStyle = floorColor(f.level, floors.length);
    for (const poly of f.polys) strokeDeviatingEdges(ctx, poly, verts, T);
  }

  // base setback line (red dashed) — the line every floor must respect
  const baseFp = footprintAt(verts, params.base);
  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 5]);
  for (const poly of baseFp.polys) strokeDeviatingEdges(ctx, poly, verts, T);
  ctx.setLineDash([]);

  // vertex handles
  for (const v of verts) {
    const s = T.toScreen(v);
    ctx.beginPath();
    ctx.arc(s.x, s.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = pal.card;
    ctx.fill();
    ctx.strokeStyle = pal.strong;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // edge length labels
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const mid = T.toScreen({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    chip(ctx, pal, `E${i + 1}: ${len.toFixed(1)}m`, mid.x, mid.y);
  }

  // site area label
  let cx = 0;
  let cy = 0;
  for (const v of verts) {
    cx += v.x;
    cy += v.y;
  }
  const c = T.toScreen({ x: cx / verts.length, y: cy / verts.length });
  ctx.font = '700 18px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillStyle = pal.strong;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${polyArea(verts).toFixed(1)} m²`, c.x, c.y);

  // north arrow
  ctx.strokeStyle = pal.accent;
  ctx.fillStyle = pal.accent;
  ctx.lineWidth = 3;
  const nx = w - 46;
  ctx.beginPath();
  ctx.moveTo(nx, 86);
  ctx.lineTo(nx, 38);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(nx, 26);
  ctx.lineTo(nx - 9, 44);
  ctx.lineTo(nx + 9, 44);
  ctx.closePath();
  ctx.fill();
  ctx.font = '700 16px ui-monospace, Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('N', nx, 106);

  return T;
}

function isoProject(x: number, y: number, z: number): Pt {
  return { x: (x - y) * 0.866, y: (x + y) * 0.5 + z * 1.05 };
}

interface IsoLevel {
  z: number;
  polys: Pt[][];
  color: string;
  label: string | null;
  dash: boolean;
}

function drawIso(
  canvas: HTMLCanvasElement,
  pal: Palette,
  verts: Pt[],
  params: RuleParams,
  floors: Floor[],
) {
  const { ctx, w, h } = setupCanvas(canvas);

  const baseFp = footprintAt(verts, params.base);
  const levels: IsoLevel[] = [
    { z: 0, polys: [verts], color: pal.mid, label: 'GL 0m', dash: false },
    ...floors.map((f) => ({
      z: f.topZ,
      polys: f.polys,
      color: floorColor(f.level, floors.length),
      label: `${f.level}F ${+f.topZ.toFixed(1)}m` as string | null,
      dash: false,
    })),
  ];
  if (params.threshold > 0 && floors.length * params.floorH > params.threshold) {
    // a floor topping out exactly at the threshold would overlap the 사선 label
    for (const lv of levels) {
      if (Math.abs(lv.z - params.threshold) < 0.01) lv.label = null;
    }
    levels.push({
      z: params.threshold,
      polys: baseFp.polys,
      color: pal.accent,
      label: `사선 ${+params.threshold.toFixed(1)}m`,
      dash: true,
    });
    levels.sort((a, b) => a.z - b.z);
  }

  // fit projected bounds (leave room on the right for labels)
  let minx = Number.POSITIVE_INFINITY;
  let miny = Number.POSITIVE_INFINITY;
  let maxx = Number.NEGATIVE_INFINITY;
  let maxy = Number.NEGATIVE_INFINITY;
  for (const lv of levels) {
    for (const poly of lv.polys) {
      for (const p of poly) {
        const q = isoProject(p.x, p.y, lv.z);
        minx = Math.min(minx, q.x);
        miny = Math.min(miny, q.y);
        maxx = Math.max(maxx, q.x);
        maxy = Math.max(maxy, q.y);
      }
    }
  }
  const padX = 90;
  const padY = 50;
  const k = Math.min(
    (w - 2 * padX) / Math.max(1, maxx - minx),
    (h - 2 * padY) / Math.max(1, maxy - miny),
  );
  const toScreen = (p: Pt, z: number): Pt => {
    const q = isoProject(p.x, p.y, z);
    return {
      x: (w - k * (maxx - minx)) / 2 - k * minx + k * q.x - 30,
      y: (h + k * (maxy - miny)) / 2 + k * miny - k * q.y,
    };
  };

  ctx.font = '13px ui-monospace, Menlo, Consolas, monospace';
  ctx.textBaseline = 'middle';

  for (const lv of levels) {
    ctx.strokeStyle = lv.color;
    ctx.lineWidth = lv.dash ? 1.5 : 1.75;
    ctx.setLineDash(lv.dash ? [6, 5] : []);
    let rightmost: Pt | null = null;
    for (const poly of lv.polys) {
      ctx.beginPath();
      poly.forEach((p, i) => {
        const s = toScreen(p, lv.z);
        if (!rightmost || s.x > rightmost.x) rightmost = s;
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      ctx.closePath();
      ctx.stroke();
    }
    ctx.setLineDash([]);
    if (rightmost && lv.label) {
      ctx.fillStyle = lv.color;
      ctx.textAlign = 'left';
      ctx.fillText(`–${lv.label}`, (rightmost as Pt).x + 10, (rightmost as Pt).y);
    }
  }
}

const inputCls =
  'w-20 border border-line bg-field px-2 py-1.5 font-mono text-ink focus:border-accent focus:outline-none';

export default function NorthlightApp() {
  const { dark } = useTheme();
  const [verts, setVerts] = useState<Pt[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.verts) && data.verts.length >= 3) return data.verts;
      }
    } catch {
      /* corrupt state — fall back to defaults */
    }
    return DEFAULT_VERTS.map((v) => ({ ...v }));
  });
  const [params, setParams] = useState<RuleParams>(() => {
    const p = { ...DEFAULT_PARAMS };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        for (const key of Object.keys(p) as (keyof RuleParams)[]) {
          if (Number.isFinite(data[key])) p[key] = data[key];
        }
      }
    } catch {
      /* corrupt state — fall back to defaults */
    }
    return p;
  });

  const planRef = useRef<HTMLCanvasElement>(null);
  const isoRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef<PlanTransform | null>(null);
  const dragIndex = useRef(-1);

  const floors = computeFloors(verts, params);
  const height = floors.length * params.floorH;
  const volume = floors.reduce((sum, f) => sum + f.area * params.floorH, 0);
  const groundArea = floors.length ? floors[0].area : 0;

  const render = useCallback(() => {
    const pal = readPalette();
    if (planRef.current)
      transformRef.current = drawPlan(planRef.current, pal, verts, params, floors);
    if (isoRef.current) drawIso(isoRef.current, pal, verts, params, floors);
  }, [verts, params, floors, dark]);

  useEffect(() => {
    render();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ verts, ...params }));
    } catch {
      /* storage unavailable — view-only mode is fine */
    }
  }, [render, verts, params]);

  useEffect(() => {
    const onResize = () => render();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [render]);

  const pointerPos = (e: React.PointerEvent | React.MouseEvent) => {
    const rect = (planRef.current as HTMLCanvasElement).getBoundingClientRect();
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
  };

  const hitVertex = (sx: number, sy: number) => {
    const T = transformRef.current;
    if (!T) return -1;
    for (let i = 0; i < verts.length; i++) {
      const s = T.toScreen(verts[i]);
      if (Math.hypot(s.x - sx, s.y - sy) < 11) return i;
    }
    return -1;
  };

  const setParam = (key: keyof RuleParams, raw: string) => {
    const v = Number.parseFloat(raw);
    if (!Number.isFinite(v)) return;
    setParams((p) => ({
      ...p,
      [key]: key === 'floors' ? Math.max(1, Math.round(v)) : Math.max(0, v),
    }));
  };

  return (
    <div className="relative border border-line bg-card">
      <span className="absolute top-6 right-2.5 z-10 text-[10px] tracking-[0.22em] whitespace-nowrap text-faint uppercase [writing-mode:vertical-rl]">
        건축법 시행령 제86조
      </span>
      <header className="px-6 pt-6 pb-2">
        <h1 className="m-0">
          <span className="block text-[28px] leading-tight font-semibold tracking-tight">
            northlight regulation
          </span>
          <span className="text-[12px] tracking-[0.14em] text-accent">정북 일조사선</span>
        </h1>
      </header>

      <div className="grid gap-2.5 px-4 pt-3 pb-1 md:grid-cols-2">
        <div className="h-[420px] overflow-hidden border border-line bg-field">
          <canvas
            ref={planRef}
            className="block h-full w-full cursor-crosshair touch-none"
            onPointerDown={(e) => {
              const { sx, sy } = pointerPos(e);
              const i = hitVertex(sx, sy);
              if (i < 0) return;
              if (e.altKey) {
                if (verts.length > 3) setVerts((vs) => vs.filter((_, j) => j !== i));
                return;
              }
              dragIndex.current = i;
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (dragIndex.current < 0 || !transformRef.current) return;
              const { sx, sy } = pointerPos(e);
              const p = transformRef.current.toWorld(sx, sy);
              setVerts((vs) =>
                vs.map((v, j) =>
                  j === dragIndex.current ? { x: +p.x.toFixed(2), y: +p.y.toFixed(2) } : v,
                ),
              );
            }}
            onPointerUp={() => {
              dragIndex.current = -1;
            }}
            onDoubleClick={(e) => {
              const T = transformRef.current;
              if (!T) return;
              const { sx, sy } = pointerPos(e);
              if (hitVertex(sx, sy) >= 0) return;
              const p = T.toWorld(sx, sy);
              let best = -1;
              let bestD = Number.POSITIVE_INFINITY;
              for (let i = 0; i < verts.length; i++) {
                const d = distToSegment(p, verts[i], verts[(i + 1) % verts.length]);
                if (d < bestD) {
                  bestD = d;
                  best = i;
                }
              }
              if (best >= 0 && bestD * T.k < 10) {
                setVerts((vs) => [
                  ...vs.slice(0, best + 1),
                  { x: +p.x.toFixed(2), y: +p.y.toFixed(2) },
                  ...vs.slice(best + 1),
                ]);
              }
            }}
          />
        </div>
        <div className="h-[420px] overflow-hidden border border-line bg-field">
          <canvas ref={isoRef} className="block h-full w-full" />
        </div>
      </div>

      <p className="mx-6 my-2 font-mono text-[13px] tracking-[0.1em] text-muted">
        Floors: {floors.length} | H: {+height.toFixed(1)}m | Vol: {Math.round(volume)} m³ | Area:{' '}
        {Math.round(groundArea)} m²
      </p>

      <section className="flex flex-wrap items-center gap-4 border-t border-line px-6 py-3 text-[13px] text-muted">
        <label className="flex items-center gap-2 whitespace-nowrap">
          Floors
          <input
            type="number"
            min={1}
            max={60}
            step={1}
            value={params.floors}
            onChange={(e) => setParam('floors', e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex items-center gap-2 whitespace-nowrap">
          Floor H (m)
          <input
            type="number"
            min={2}
            max={6}
            step={0.1}
            value={params.floorH}
            onChange={(e) => setParam('floorH', e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex items-center gap-2 whitespace-nowrap">
          사선 기준 (m)
          <input
            type="number"
            min={0}
            max={20}
            step={0.5}
            value={params.threshold}
            onChange={(e) => setParam('threshold', e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex items-center gap-2 whitespace-nowrap">
          기준이하 이격 (m)
          <input
            type="number"
            min={0}
            max={10}
            step={0.1}
            value={params.base}
            onChange={(e) => setParam('base', e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex items-center gap-2 whitespace-nowrap">
          초과부 비율
          <input
            type="number"
            min={0}
            max={2}
            step={0.05}
            value={params.ratio}
            onChange={(e) => setParam('ratio', e.target.value)}
            className={inputCls}
          />
        </label>
        <button
          type="button"
          onClick={() => setVerts(DEFAULT_VERTS.map((v) => ({ ...v })))}
          className="cursor-pointer border border-line bg-field px-3 py-1.5 text-[10.5px] tracking-[0.16em] text-ink uppercase hover:border-ink"
        >
          Reset site
        </button>
        <p className="w-full text-[11.5px] leading-relaxed text-faint">
          Drag vertices · double-click an edge to add a point · Alt-click a vertex to delete · North
          is up — h ≤ 기준: base setback, h &gt; 기준: h × 비율 from the north boundary. Study tool
          only, not a code-compliance check.
        </p>
      </section>
    </div>
  );
}
