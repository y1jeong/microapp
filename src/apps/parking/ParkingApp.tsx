import { useEffect, useMemo, useState } from 'react';
import {
  computeLayout,
  type Obstacle,
  type ObstacleKind,
  type ParkingParams,
  type Pt,
  polygonArea,
} from './geometry';
import PlanView from './PlanView';

const STORAGE_KEY = 'parking-state-v1';

const defaultVerts = (): Pt[] => [
  { x: 0, y: 52 },
  { x: 64, y: 56 },
  { x: 69, y: 38 },
  { x: 64, y: 0 },
  { x: 10.5, y: 4 },
  { x: 2, y: 22 },
];

const defaultParams = (): ParkingParams => ({ stallW: 2.5, stallD: 5, aisleW: 6 });

const OBSTACLE_KINDS: ObstacleKind[] = ['core', 'ramp', 'mech'];

/** default footprint per block kind, meters */
const OBSTACLE_SIZES: Record<ObstacleKind, [number, number]> = {
  core: [8, 6],
  ramp: [6, 12],
  mech: [5, 5],
};

function makeObstacle(kind: ObstacleKind, at: Pt): Obstacle {
  const [w, h] = OBSTACLE_SIZES[kind];
  return {
    id: `${kind}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    kind,
    verts: [
      { x: at.x - w / 2, y: at.y - h / 2 },
      { x: at.x + w / 2, y: at.y - h / 2 },
      { x: at.x + w / 2, y: at.y + h / 2 },
      { x: at.x - w / 2, y: at.y + h / 2 },
    ],
  };
}

interface Saved {
  verts: Pt[];
  params: ParkingParams;
  obstacles: Obstacle[];
}

const finiteVerts = (verts: Pt[]) =>
  verts.every((v) => Number.isFinite(v?.x) && Number.isFinite(v?.y));

function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<Saved>;
    if (!Array.isArray(data.verts) || data.verts.length < 3 || !finiteVerts(data.verts)) {
      return null;
    }
    const p = data.params;
    if (!p || !(p.stallW > 0) || !(p.stallD > 0) || !(p.aisleW > 0)) return null;
    const valid = Array.isArray(data.obstacles)
      ? data.obstacles.filter(
          (o) =>
            o &&
            typeof o.id === 'string' &&
            OBSTACLE_KINDS.includes(o.kind) &&
            Array.isArray(o.verts) &&
            o.verts.length >= 3 &&
            finiteVerts(o.verts),
        )
      : [];
    // duplicated ids would make a block uneditable — keep the first of each
    const seen = new Set<string>();
    const obstacles = valid.filter((o) => !seen.has(o.id) && Boolean(seen.add(o.id)));
    return { verts: data.verts, params: p, obstacles };
  } catch {
    return null;
  }
}

const inputCls =
  'w-16 border border-line bg-field px-2 py-1 font-mono text-ink focus:border-accent focus:outline-none';
const buttonCls =
  'cursor-pointer border border-line bg-field px-3 py-1.5 text-[10.5px] tracking-[0.16em] uppercase text-ink hover:border-ink';

export default function ParkingApp() {
  const saved = useMemo(loadSaved, []);
  const [verts, setVerts] = useState<Pt[]>(saved?.verts ?? defaultVerts());
  const [params, setParams] = useState<ParkingParams>(saved?.params ?? defaultParams());
  const [obstacles, setObstacles] = useState<Obstacle[]>(saved?.obstacles ?? []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ verts, params, obstacles }));
    } catch {
      // storage unavailable — view-only mode is fine
    }
  }, [verts, params, obstacles]);

  const layout = useMemo(
    () =>
      computeLayout(
        verts,
        params,
        obstacles.map((o) => o.verts),
      ),
    [verts, params, obstacles],
  );
  const area = useMemo(() => polygonArea(verts), [verts]);

  const edgeCount = layout.edge.length;
  const innerCount = layout.inner.length;
  const total = edgeCount + innerCount;
  const eff = area > 0 ? ((total * params.stallW * params.stallD) / area) * 100 : 0;

  const addObstacle = (kind: ObstacleKind) => {
    const xs = verts.map((v) => v.x);
    const ys = verts.map((v) => v.y);
    const nudge = obstacles.length * 5;
    const at = {
      x: (Math.min(...xs) + Math.max(...xs)) / 2 + nudge,
      y: (Math.min(...ys) + Math.max(...ys)) / 2 + nudge,
    };
    setObstacles((os) => [...os, makeObstacle(kind, at)]);
  };

  const num =
    (apply: (v: number) => void, min: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number.parseFloat(e.target.value);
      if (Number.isFinite(v)) apply(Math.max(min, v));
    };

  return (
    <div className="relative border border-line bg-card">
      <span className="absolute top-6 right-2.5 z-10 text-[10px] tracking-[0.22em] whitespace-nowrap text-faint uppercase [writing-mode:vertical-rl]">
        주차장법 시행규칙 제3조
      </span>
      <header className="px-6 pt-6 pb-2">
        <h1 className="m-0">
          <span className="block text-[28px] leading-tight font-semibold tracking-tight">
            parking layout
          </span>
          <span className="text-[12px] tracking-[0.14em] text-accent">주차 배치</span>
        </h1>
      </header>

      <div className="px-3 pt-2">
        <div className="border border-line bg-field/60">
          <PlanView
            verts={verts}
            obstacles={obstacles}
            layout={layout}
            onMove={(i, x, y) => setVerts((vs) => vs.map((v, j) => (j === i ? { x, y } : v)))}
            onInsert={(i, p) => setVerts((vs) => [...vs.slice(0, i + 1), p, ...vs.slice(i + 1)])}
            onRemove={(i) => setVerts((vs) => (vs.length > 3 ? vs.filter((_, j) => j !== i) : vs))}
            onObstacleChange={(id, ovs) =>
              setObstacles((os) => os.map((o) => (o.id === id ? { ...o, verts: ovs } : o)))
            }
          />
        </div>
      </div>

      <p className="px-6 pt-4 pb-1 font-mono text-[14px] tracking-[0.1em] text-muted">
        Edge: {edgeCount} | Inner: {innerCount} | Total: {total} | Area: {Math.round(area)} m² |
        Eff: {eff.toFixed(1)}%
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 pt-2 pb-2 text-[12.5px] text-muted">
        <label className="flex items-center gap-1.5">
          구획 너비 (m)
          <input
            type="number"
            min={2}
            max={4}
            step={0.1}
            value={params.stallW}
            onChange={num((v) => setParams((p) => ({ ...p, stallW: v })), 1)}
            className={inputCls}
          />
        </label>
        <label className="flex items-center gap-1.5">
          구획 길이 (m)
          <input
            type="number"
            min={3.5}
            max={7}
            step={0.1}
            value={params.stallD}
            onChange={num((v) => setParams((p) => ({ ...p, stallD: v })), 1)}
            className={inputCls}
          />
        </label>
        <label className="flex items-center gap-1.5">
          차로 (m)
          <input
            type="number"
            min={3}
            max={10}
            step={0.5}
            value={params.aisleW}
            onChange={num((v) => setParams((p) => ({ ...p, aisleW: v })), 1)}
            className={inputCls}
          />
        </label>
        <button
          type="button"
          className={buttonCls}
          onClick={() => {
            setVerts(defaultVerts());
            setParams(defaultParams());
            setObstacles([]);
          }}
        >
          Reset site
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-6 pt-1 pb-2 text-[12.5px] text-muted">
        <span className="text-[10px] tracking-[0.18em] text-faint uppercase">blocks</span>
        {OBSTACLE_KINDS.map((kind) => (
          <button key={kind} type="button" className={buttonCls} onClick={() => addObstacle(kind)}>
            + {kind}
          </button>
        ))}
        {obstacles.map((o, i) => {
          const n = obstacles.slice(0, i).filter((p) => p.kind === o.kind).length + 1;
          return (
            <button
              key={o.id}
              type="button"
              className="cursor-pointer border border-line bg-card px-2 py-1 text-[10.5px] tracking-[0.12em] text-muted uppercase hover:border-accent hover:text-accent"
              title="remove block"
              onClick={() => setObstacles((os) => os.filter((p) => p.id !== o.id))}
            >
              {o.kind} {n} ×
            </button>
          );
        })}
      </div>

      <p className="px-6 pb-5 text-[12px] leading-relaxed text-faint">
        드래그: 꼭지점·블록 이동 · 더블클릭: 꼭지점 추가/삭제 |{' '}
        <span className="text-accent">Edge + Inner + Circulation</span> — 일반형 직각주차 구획
        2.5×5.0m · 차로 6.0m 기준 (주차장법 시행규칙 제3조·제6조) · 코어/램프/설비 블록은 주차
        구획에서 제외.
      </p>
    </div>
  );
}
