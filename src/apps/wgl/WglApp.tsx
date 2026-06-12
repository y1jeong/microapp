import { useMemo, useRef, useState } from 'react';
import { type BoundaryCandidate, extractCandidates, parseDxf } from './dxf';
import {
  computeWgl,
  makeParcel,
  makeVertex,
  type Parcel,
  type Vertex,
  vertexLabel,
  type WglResult,
} from './geometry';
import ImportDialog, { type ImportSelection } from './ImportDialog';
import PlanView from './PlanView';
import SectionView from './SectionView';

interface ImportState {
  fileName: string;
  scale: number;
  candidates: BoundaryCandidate[];
}

// sample mirroring the 부천 심곡동 343-12,13 drawing: one planning site,
// a road frontage, and two adjacent sites, each averaged separately
const sampleParcels = (): Parcel[] => [
  makeParcel('계획대지 343-12,13', 'site', [
    makeVertex(0.0, 11.0, 24.3),
    makeVertex(18.1, 11.3, 25.8),
    makeVertex(28.4, 10.8, 26.3),
    makeVertex(28.0, 5.0, 26.4),
    makeVertex(27.5, 0.0, 25.6),
    makeVertex(0.5, 0.4, 25.6),
  ]),
  makeParcel('도로', 'road', [makeVertex(30.5, 10.6, 25.73), makeVertex(30.5, -10.3, 26.01)]),
  makeParcel('인접대지 343-5', 'adjacent', [
    makeVertex(-12.0, 11.2, 23.32),
    makeVertex(-1.2, 11.4, 23.56),
    makeVertex(-1.4, 1.3, 23.56),
    makeVertex(-13.4, 0.9, 23.64),
  ]),
  makeParcel('인접대지 343-11', 'adjacent', [
    makeVertex(-13.0, -0.4, 23.18),
    makeVertex(-3.2, -0.5, 23.2),
    makeVertex(-3.0, -8.1, 23.64),
    makeVertex(-14.8, -8.6, 23.56),
  ]),
];

const kindLabel: Record<Parcel['kind'], string> = {
  site: '계획대지',
  adjacent: '인접대지',
  road: '도로',
};

function formulaLine(parcel: Parcel, r: WglResult) {
  const ratio = `${r.sectionArea.toFixed(2)}㎡ / ${r.contactLength.toFixed(2)}m = ${r.avgHeight.toFixed(2)}m`;
  if (parcel.kind === 'road') {
    return (
      <>
        당해 부분의 면적 / 도로길이 = {ratio} | 도로최저레벨 + 가중평균높이 = EL+
        {r.elMin.toFixed(2)} + {r.avgHeight.toFixed(2)} ={' '}
        <strong className="text-accent">수평면 EL+{r.gl.toFixed(2)}</strong>
      </>
    );
  }
  return (
    <>
      지표면에 접하는 면적 / 길이 = {ratio} | 대지최저레벨 + 가중평균높이 = EL+
      {r.elMin.toFixed(2)} + {r.avgHeight.toFixed(2)} ={' '}
      <strong className="text-accent">G.L±0 = EL+{r.gl.toFixed(2)}</strong>
    </>
  );
}

const inputCls =
  'w-full max-w-24 rounded-md border border-line bg-field px-2 py-1 font-mono text-ink focus:border-accent-dim focus:outline-none';
const buttonCls =
  'cursor-pointer rounded-md border border-line bg-field px-2.5 py-1 font-mono text-ink hover:enabled:border-accent-dim disabled:cursor-default disabled:opacity-35';

export default function WglApp() {
  const [parcels, setParcels] = useState<Parcel[]>(sampleParcels);
  const [activeId, setActiveId] = useState<string>(() => parcels[0]?.id ?? '');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);
  const [importState, setImportState] = useState<ImportState | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const active = parcels.find((p) => p.id === activeId) ?? parcels[0];
  const results = useMemo(
    () => new Map(parcels.map((p) => [p.id, computeWgl(p.vertices, p.closed)])),
    [parcels],
  );
  const result = results.get(active.id) as WglResult;

  const patchParcel = (id: string, patch: Partial<Parcel>) =>
    setParcels((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const updateVertex = (id: string, patch: Partial<Vertex>) =>
    patchParcel(active.id, {
      vertices: active.vertices.map((v) => (v.id === id ? { ...v, ...patch } : v)),
    });

  const insertAfter = (id: string) => {
    const vs = active.vertices;
    const i = vs.findIndex((v) => v.id === id);
    const a = vs[i];
    const b = vs[(i + 1) % vs.length];
    const mid = makeVertex(
      Math.round(((a.x + b.x) / 2) * 100) / 100,
      Math.round(((a.y + b.y) / 2) * 100) / 100,
      Math.round(((a.el + b.el) / 2) * 100) / 100,
    );
    patchParcel(active.id, { vertices: [...vs.slice(0, i + 1), mid, ...vs.slice(i + 1)] });
  };

  const removeVertex = (id: string) => {
    const min = active.closed ? 3 : 2;
    if (active.vertices.length <= min) return;
    patchParcel(active.id, { vertices: active.vertices.filter((v) => v.id !== id) });
    if (selectedId === id) setSelectedId(null);
  };

  const addParcel = (kind: Parcel['kind']) => {
    const base = active.vertices[0] ?? makeVertex(0, 0, 0);
    const ox = base.x + 6;
    const oy = base.y - 6;
    const p =
      kind === 'road'
        ? makeParcel('도로', 'road', [makeVertex(ox, oy, 0), makeVertex(ox + 15, oy, 0)])
        : makeParcel(kindLabel[kind], kind, [
            makeVertex(ox, oy, 0),
            makeVertex(ox + 10, oy, 0),
            makeVertex(ox + 10, oy - 8, 0),
            makeVertex(ox, oy - 8, 0),
          ]);
    setParcels((ps) => [...ps, p]);
    setActiveId(p.id);
  };

  const removeParcel = (id: string) => {
    if (parcels.length <= 1) return;
    const next = parcels.filter((p) => p.id !== id);
    setParcels(next);
    if (activeId === id) setActiveId(next[0].id);
  };

  const importDxf = async (file: File) => {
    try {
      const data = parseDxf(await file.text());
      const { scale, candidates } = extractCandidates(data);
      if (candidates.length === 0) {
        setImportNote(
          `${file.name}: no usable boundaries found (LWPOLYLINE, POLYLINE, and chained LINE work supported)`,
        );
        return;
      }
      setImportState({ fileName: file.name, scale, candidates });
    } catch (err) {
      setImportNote(`${file.name}: import failed (${err instanceof Error ? err.message : err})`);
    }
  };

  const confirmImport = (selections: ImportSelection[], keepExisting: boolean) => {
    let matched = 0;
    let total = 0;
    const imported = selections.map(({ candidate, kind }, i) => {
      const vertices = candidate.points.map((p) => {
        total++;
        if (p.el !== null) matched++;
        return makeVertex(p.x, p.y, p.el ?? 0);
      });
      const name = candidate.layer || `DXF ${i + 1}`;
      return makeParcel(name, kind, vertices, kind !== 'road');
    });
    setParcels((ps) => (keepExisting ? [...ps, ...imported] : imported));
    setActiveId(imported[0].id);
    setSelectedId(null);
    setImportState(null);
    setImportNote(
      `${imported.length} parcel${imported.length === 1 ? '' : 's'} imported, ` +
        `${matched}/${total} EL labels matched — fill in the rest in the vertex table`,
    );
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      {importState && (
        <ImportDialog
          fileName={importState.fileName}
          candidates={importState.candidates}
          scale={importState.scale}
          onConfirm={confirmImport}
          onCancel={() => setImportState(null)}
        />
      )}
      <header className="flex flex-wrap items-baseline justify-between gap-3 px-6 pt-5 pb-1.5">
        <h1 className="m-0 flex flex-wrap items-baseline gap-4">
          <span className="text-[19px] font-medium tracking-[0.32em] text-[#d4d4d4]">
            WEIGHTED GROUND LEVEL
          </span>
          <span className="text-sm font-normal text-muted">가중평균 지표면</span>
        </h1>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".dxf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importDxf(f);
              e.target.value = '';
            }}
          />
          <button type="button" className={buttonCls} onClick={() => fileRef.current?.click()}>
            Import DXF
          </button>
        </div>
      </header>
      {importNote && <p className="mx-6 my-1 text-[12px] text-accent-dim">{importNote}</p>}

      <section className="px-4 pt-3 pb-1">
        <div className="flex flex-wrap gap-1.5">
          {parcels.map((p) => {
            const r = results.get(p.id) as WglResult;
            const isActive = p.id === active.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setActiveId(p.id);
                  setSelectedId(null);
                }}
                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-left text-[12px] ${
                  isActive
                    ? 'border-accent-dim bg-accent/10 text-ink'
                    : 'border-line bg-field text-muted hover:border-accent-dim'
                }`}
              >
                <span className="block">{p.name}</span>
                <span className={isActive ? 'text-accent' : ''}>
                  {p.kind === 'road' ? '수평면' : 'G.L'} EL+{r.gl.toFixed(2)}
                </span>
              </button>
            );
          })}
          <button type="button" className={buttonCls} onClick={() => addParcel('adjacent')}>
            + 대지
          </button>
          <button type="button" className={buttonCls} onClick={() => addParcel('road')}>
            + 도로
          </button>
        </div>
      </section>

      <section className="px-4 pt-2 pb-2.5">
        <h2 className="mb-1 ml-2 text-[13px] font-medium tracking-[0.22em] text-muted">
          PLAN VIEW
        </h2>
        <PlanView
          parcels={parcels}
          activeId={active.id}
          gl={result.gl}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMove={(id, x, y) => updateVertex(id, { x, y })}
        />
      </section>

      <section className="border-t border-line px-4 pt-3.5 pb-2.5">
        <h2 className="mb-1 ml-2 text-[13px] font-medium tracking-[0.22em] text-muted">
          SECTION VIEW — {active.name}
        </h2>
        <SectionView parcel={active} result={result} />
        <p className="mx-2 my-2 text-[12.5px] leading-relaxed text-muted">
          {formulaLine(active, result)}
        </p>
      </section>

      <section className="border-t border-line px-4 pt-3.5 pb-2.5">
        <div className="mb-1 ml-2 flex flex-wrap items-center gap-3">
          <h2 className="text-[13px] font-medium tracking-[0.22em] text-muted">VERTICES</h2>
          <input
            value={active.name}
            onChange={(e) => patchParcel(active.id, { name: e.target.value })}
            className={`${inputCls} max-w-44`}
            aria-label="Parcel name"
          />
          <select
            value={active.kind}
            onChange={(e) => {
              const kind = e.target.value as Parcel['kind'];
              patchParcel(active.id, { kind, closed: kind !== 'road' });
            }}
            className="rounded-md border border-line bg-field px-2 py-1 font-mono text-[13px] text-ink focus:border-accent-dim focus:outline-none"
            aria-label="Parcel kind"
          >
            <option value="site">계획대지 (closed)</option>
            <option value="adjacent">인접대지 (closed)</option>
            <option value="road">도로 (open)</option>
          </select>
          <button
            type="button"
            className={buttonCls}
            disabled={parcels.length <= 1}
            onClick={() => removeParcel(active.id)}
          >
            Delete parcel
          </button>
        </div>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th>
                <span className="sr-only">Vertex</span>
              </th>
              {['X (m)', 'Y (m)', 'EL (m)'].map((h) => (
                <th key={h} className="px-1.5 py-1 text-left text-[11.5px] font-normal text-muted">
                  {h}
                </th>
              ))}
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {active.vertices.map((v, i) => (
              <tr
                key={v.id}
                className={v.id === selectedId ? 'bg-accent/10' : ''}
                onClick={() => setSelectedId(v.id)}
              >
                <td className="w-7 px-1.5 py-0.5 font-bold">{vertexLabel(i)}</td>
                <td className="px-1.5 py-0.5">
                  <input
                    type="number"
                    step={0.1}
                    value={v.x}
                    onChange={(e) => updateVertex(v.id, { x: Number(e.target.value) })}
                    className={inputCls}
                  />
                </td>
                <td className="px-1.5 py-0.5">
                  <input
                    type="number"
                    step={0.1}
                    value={v.y}
                    onChange={(e) => updateVertex(v.id, { y: Number(e.target.value) })}
                    className={inputCls}
                  />
                </td>
                <td className="px-1.5 py-0.5">
                  <input
                    type="number"
                    step={0.01}
                    value={v.el}
                    onChange={(e) => updateVertex(v.id, { el: Number(e.target.value) })}
                    className={inputCls}
                  />
                </td>
                <td className="whitespace-nowrap px-1.5 py-0.5 text-right">
                  <button
                    type="button"
                    title="Insert vertex after"
                    onClick={() => insertAfter(v.id)}
                    className={`${buttonCls} ml-1`}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    title="Delete vertex"
                    disabled={active.vertices.length <= (active.closed ? 3 : 2)}
                    onClick={() => removeVertex(v.id)}
                    className={`${buttonCls} ml-1`}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mx-1.5 my-2.5">
          <button
            type="button"
            onClick={() => {
              const ps = sampleParcels();
              setParcels(ps);
              setActiveId(ps[0].id);
              setSelectedId(null);
              setImportNote(null);
            }}
            className={buttonCls}
          >
            Reset sample
          </button>
        </div>
        <p className="mx-2 mt-1 mb-2.5 text-[11.5px] leading-relaxed text-faint">
          Each parcel gets its own weighted average: closed boundaries use the full perimeter
          (지표면 가중평균), open road traces use the frontage length (도로 가중평균 수평면). Drag
          corners in the plan view or edit values here; import boundaries and EL labels from a DXF.
        </p>
      </section>
    </div>
  );
}
