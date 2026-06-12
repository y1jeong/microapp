import { useEffect, useMemo, useState } from 'react';
import { computeFloors, footprintAt, type Pt, type SetbackRule } from './geometry';
import IsoView from './IsoView';
import PlanView from './PlanView';

const STORAGE_KEY = 'northlight-state-v1';

const defaultVerts = (): Pt[] => [
  { x: 0.0, y: 31.5 },
  { x: 11.3, y: 32.0 },
  { x: 12.2, y: 22.3 },
  { x: 21.0, y: 21.6 },
  { x: 19.8, y: 2.5 },
  { x: 0.0, y: 0.0 },
];

interface Saved {
  verts: Pt[];
  floorCount: number;
  floorH: number;
  rule: SetbackRule;
}

function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Saved;
    if (!Array.isArray(data.verts) || data.verts.length < 3) return null;
    return data;
  } catch {
    return null;
  }
}

const inputCls =
  'w-16 rounded-md border border-line bg-field px-2 py-1 font-mono text-ink focus:border-accent-dim focus:outline-none';
const buttonCls =
  'cursor-pointer rounded-md border border-line bg-field px-2.5 py-1 font-mono text-ink hover:border-accent-dim';

export default function NorthlightApp() {
  const saved = useMemo(loadSaved, []);
  const [verts, setVerts] = useState<Pt[]>(saved?.verts ?? defaultVerts());
  const [floorCount, setFloorCount] = useState(saved?.floorCount ?? 10);
  const [floorH, setFloorH] = useState(saved?.floorH ?? 3);
  const [rule, setRule] = useState<SetbackRule>(
    saved?.rule ?? { threshold: 9, base: 1.5, ratio: 0.5 },
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ verts, floorCount, floorH, rule }));
    } catch {
      // storage unavailable — view-only mode is fine
    }
  }, [verts, floorCount, floorH, rule]);

  const floors = useMemo(
    () => computeFloors(verts, rule, floorCount, floorH),
    [verts, rule, floorCount, floorH],
  );
  const baseFootprint = useMemo(() => footprintAt(verts, rule.base), [verts, rule.base]);

  const volume = floors.reduce((s, f) => s + f.area * floorH, 0);
  const groundArea = floors[0]?.area ?? 0;

  const num =
    (apply: (v: number) => void, min = 0) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number.parseFloat(e.target.value);
      if (Number.isFinite(v)) apply(Math.max(min, v));
    };

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      <header className="flex flex-wrap items-baseline justify-between gap-3 px-6 pt-5 pb-1.5">
        <h1 className="m-0 flex flex-wrap items-baseline gap-4">
          <span className="text-[19px] font-medium tracking-[0.32em] text-[#d4d4d4]">
            NORTHLIGHT REGULATION
          </span>
          <span className="text-sm font-normal text-muted">정북 일조사선</span>
        </h1>
      </header>

      <div className="grid gap-2 px-3 pt-2 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-field/60">
          <PlanView
            verts={verts}
            floors={floors}
            baseFootprint={baseFootprint}
            onMove={(i, x, y) => setVerts((vs) => vs.map((v, j) => (j === i ? { x, y } : v)))}
            onInsert={(i, p) => setVerts((vs) => [...vs.slice(0, i + 1), p, ...vs.slice(i + 1)])}
            onRemove={(i) => setVerts((vs) => (vs.length > 3 ? vs.filter((_, j) => j !== i) : vs))}
          />
        </div>
        <div className="rounded-xl border border-line bg-field/60">
          <IsoView verts={verts} floors={floors} baseFootprint={baseFootprint} rule={rule} />
        </div>
      </div>

      <p className="px-6 pt-4 pb-1 text-[15px] tracking-[0.1em] text-muted">
        Floors: {floors.length} | H: {+(floors.length * floorH).toFixed(1)}m | Vol:{' '}
        {Math.round(volume)} m³ | Area: {Math.round(groundArea)} m²
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 pt-2 pb-2 text-[12.5px] text-muted">
        <label className="flex items-center gap-1.5">
          Floors
          <input
            type="number"
            min={1}
            max={60}
            step={1}
            value={floorCount}
            onChange={num((v) => setFloorCount(Math.round(v)), 1)}
            className={inputCls}
          />
        </label>
        <label className="flex items-center gap-1.5">
          Floor H (m)
          <input
            type="number"
            min={2}
            max={6}
            step={0.1}
            value={floorH}
            onChange={num(setFloorH, 0.1)}
            className={inputCls}
          />
        </label>
        <label className="flex items-center gap-1.5">
          사선 기준 (m)
          <input
            type="number"
            min={0}
            max={20}
            step={0.5}
            value={rule.threshold}
            onChange={num((v) => setRule((r) => ({ ...r, threshold: v })))}
            className={inputCls}
          />
        </label>
        <label className="flex items-center gap-1.5">
          기준이하 이격 (m)
          <input
            type="number"
            min={0}
            max={10}
            step={0.1}
            value={rule.base}
            onChange={num((v) => setRule((r) => ({ ...r, base: v })))}
            className={inputCls}
          />
        </label>
        <label className="flex items-center gap-1.5">
          초과부 비율
          <input
            type="number"
            min={0}
            max={2}
            step={0.05}
            value={rule.ratio}
            onChange={num((v) => setRule((r) => ({ ...r, ratio: v })))}
            className={inputCls}
          />
        </label>
        <button type="button" className={buttonCls} onClick={() => setVerts(defaultVerts())}>
          Reset site
        </button>
      </div>

      <p className="px-6 pb-5 text-[12px] leading-relaxed text-faint">
        Drag vertices · double-click an edge to add a point · Alt-click a vertex to delete · North
        is up — h ≤ 기준: 기준이하 이격 setback, h &gt; 기준: h × 비율 from the north boundary
        (건축법 시행령 제86조).
      </p>
    </div>
  );
}
