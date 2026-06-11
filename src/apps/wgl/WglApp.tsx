import { useMemo, useState } from 'react';
import { computeWgl, makeVertex, type Vertex, vertexLabel } from './geometry';
import PlanView from './PlanView';
import SectionView from './SectionView';

const sampleVertices = (): Vertex[] => [
  makeVertex(0.0, 4.8, 9.4),
  makeVertex(0.1, 3.2, 1.56),
  makeVertex(1.0, 2.2, 6.06),
  makeVertex(7.0, 2.0, 0.0),
  makeVertex(6.6, 3.9, 1.12),
  makeVertex(5.3, 4.9, 9.3),
];

const inputCls =
  'w-full max-w-24 rounded-md border border-line bg-field px-2 py-1 font-mono text-ink focus:border-accent-dim focus:outline-none';
const buttonCls =
  'ml-1 cursor-pointer rounded-md border border-line bg-field px-2.5 py-1 font-mono text-ink hover:enabled:border-accent-dim disabled:cursor-default disabled:opacity-35';

export default function WglApp() {
  const [vertices, setVertices] = useState<Vertex[]>(sampleVertices);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const result = useMemo(() => computeWgl(vertices), [vertices]);

  const update = (id: string, patch: Partial<Vertex>) =>
    setVertices((vs) => vs.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  const insertAfter = (id: string) =>
    setVertices((vs) => {
      const i = vs.findIndex((v) => v.id === id);
      const a = vs[i];
      const b = vs[(i + 1) % vs.length];
      const mid = makeVertex(
        Math.round(((a.x + b.x) / 2) * 100) / 100,
        Math.round(((a.y + b.y) / 2) * 100) / 100,
        Math.round(((a.fh + b.fh) / 2) * 100) / 100,
      );
      return [...vs.slice(0, i + 1), mid, ...vs.slice(i + 1)];
    });

  const remove = (id: string) => {
    if (vertices.length <= 3) return;
    setVertices((vs) => vs.filter((v) => v.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      <header className="px-6 pt-5 pb-1.5">
        <h1 className="m-0 flex flex-wrap items-baseline gap-4">
          <span className="text-[19px] font-medium tracking-[0.32em] text-[#d4d4d4]">
            WEIGHTED GROUND LEVEL
          </span>
          <span className="text-sm font-normal text-muted">가중평균 지표면</span>
        </h1>
      </header>

      <section className="px-4 pt-3.5 pb-2.5">
        <h2 className="mb-1 ml-2 text-[13px] font-medium tracking-[0.22em] text-muted">
          PLAN VIEW
        </h2>
        <PlanView
          vertices={vertices}
          wgl={result.wgl}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMove={(id, x, y) => update(id, { x, y })}
        />
      </section>

      <section className="border-t border-line px-4 pt-3.5 pb-2.5">
        <h2 className="mb-1 ml-2 text-[13px] font-medium tracking-[0.22em] text-muted">
          SECTION VIEW
        </h2>
        <SectionView vertices={vertices} result={result} />
        <p className="mx-2 my-2 text-[12.5px] leading-relaxed text-muted">
          Section Area: {result.sectionArea.toFixed(2)} | Perimeter: {result.perimeter.toFixed(2)} |
          h_min: {result.hMin.toFixed(2)} + ({result.sectionArea.toFixed(2)} /{' '}
          {result.perimeter.toFixed(2)}) ={' '}
          <strong className="text-accent">WGL {result.wgl.toFixed(2)} m</strong>
        </p>
      </section>

      <section className="border-t border-line px-4 pt-3.5 pb-2.5">
        <h2 className="mb-1 ml-2 text-[13px] font-medium tracking-[0.22em] text-muted">
          VERTICES 꼭짓점
        </h2>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th>
                <span className="sr-only">Vertex</span>
              </th>
              {['X (m)', 'Y (m)', 'FH (m)'].map((h) => (
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
            {vertices.map((v, i) => (
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
                    onChange={(e) => update(v.id, { x: Number(e.target.value) })}
                    className={inputCls}
                  />
                </td>
                <td className="px-1.5 py-0.5">
                  <input
                    type="number"
                    step={0.1}
                    value={v.y}
                    onChange={(e) => update(v.id, { y: Number(e.target.value) })}
                    className={inputCls}
                  />
                </td>
                <td className="px-1.5 py-0.5">
                  <input
                    type="number"
                    step={0.01}
                    value={v.fh}
                    onChange={(e) => update(v.id, { fh: Number(e.target.value) })}
                    className={inputCls}
                  />
                </td>
                <td className="whitespace-nowrap px-1.5 py-0.5 text-right">
                  <button
                    type="button"
                    title="Insert vertex after"
                    onClick={() => insertAfter(v.id)}
                    className={buttonCls}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    title="Delete vertex"
                    disabled={vertices.length <= 3}
                    onClick={() => remove(v.id)}
                    className={buttonCls}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mx-1.5 my-2.5">
          <button type="button" onClick={() => setVertices(sampleVertices())} className={buttonCls}>
            Reset sample
          </button>
        </div>
        <p className="mx-2 mt-1 mb-2.5 text-[11.5px] leading-relaxed text-faint">
          Drag corners in the plan view, or edit coordinates and ground elevations (FH) here. WGL
          updates live: h_min + (section area ÷ perimeter).
        </p>
      </section>
    </div>
  );
}
