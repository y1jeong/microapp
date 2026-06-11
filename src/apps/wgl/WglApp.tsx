import { useMemo, useState } from 'react';
import PlanView from './PlanView';
import SectionView from './SectionView';
import { Vertex, computeWgl, makeVertex, vertexLabel } from './geometry';

const sampleVertices = (): Vertex[] => [
  makeVertex(0.0, 4.8, 9.4),
  makeVertex(0.1, 3.2, 1.56),
  makeVertex(1.0, 2.2, 6.06),
  makeVertex(7.0, 2.0, 0.0),
  makeVertex(6.6, 3.9, 1.12),
  makeVertex(5.3, 4.9, 9.3),
];

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
    <div className="card">
      <header className="card-header">
        <h1>
          <span className="title-en">WEIGHTED GROUND LEVEL</span>
          <span className="title-ko">가중평균 지표면</span>
        </h1>
      </header>

      <section className="panel">
        <h2 className="panel-title">PLAN VIEW</h2>
        <PlanView
          vertices={vertices}
          wgl={result.wgl}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMove={(id, x, y) => update(id, { x, y })}
        />
      </section>

      <section className="panel panel-divided">
        <h2 className="panel-title">SECTION VIEW</h2>
        <SectionView vertices={vertices} result={result} />
        <p className="stats">
          Section Area: {result.sectionArea.toFixed(2)} | Perimeter: {result.perimeter.toFixed(2)} | h_min:{' '}
          {result.hMin.toFixed(2)} + ({result.sectionArea.toFixed(2)} / {result.perimeter.toFixed(2)}) ={' '}
          <strong className="wgl-value">WGL {result.wgl.toFixed(2)} m</strong>
        </p>
      </section>

      <section className="panel panel-divided">
        <h2 className="panel-title">VERTICES 꼭짓점</h2>
        <table className="vertex-table">
          <thead>
            <tr>
              <th></th>
              <th>X (m)</th>
              <th>Y (m)</th>
              <th>FH (m)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {vertices.map((v, i) => (
              <tr
                key={v.id}
                className={v.id === selectedId ? 'selected' : ''}
                onClick={() => setSelectedId(v.id)}
              >
                <td className="vtx-label">{vertexLabel(i)}</td>
                <td>
                  <input
                    type="number"
                    step={0.1}
                    value={v.x}
                    onChange={(e) => update(v.id, { x: Number(e.target.value) })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step={0.1}
                    value={v.y}
                    onChange={(e) => update(v.id, { y: Number(e.target.value) })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step={0.01}
                    value={v.fh}
                    onChange={(e) => update(v.id, { fh: Number(e.target.value) })}
                  />
                </td>
                <td className="vtx-actions">
                  <button title="Insert vertex after" onClick={() => insertAfter(v.id)}>
                    +
                  </button>
                  <button
                    title="Delete vertex"
                    disabled={vertices.length <= 3}
                    onClick={() => remove(v.id)}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="toolbar">
          <button onClick={() => setVertices(sampleVertices())}>Reset sample</button>
        </div>
        <p className="hint">
          Drag corners in the plan view, or edit coordinates and ground elevations (FH) here. WGL
          updates live: h_min + (section area ÷ perimeter).
        </p>
      </section>
    </div>
  );
}
