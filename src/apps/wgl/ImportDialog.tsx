import { useState } from 'react';
import type { BoundaryCandidate } from './dxf';
import type { ParcelKind } from './geometry';

export interface ImportSelection {
  candidate: BoundaryCandidate;
  kind: ParcelKind;
}

interface Props {
  fileName: string;
  candidates: BoundaryCandidate[];
  scale: number;
  onConfirm: (selections: ImportSelection[], keepExisting: boolean) => void;
  onCancel: () => void;
}

function Preview({ candidate }: { candidate: BoundaryCandidate }) {
  const S = 44;
  const pad = 4;
  const xs = candidate.points.map((p) => p.x);
  const ys = candidate.points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const span = Math.max(candidate.spanX, candidate.spanY, 0.1);
  const k = (S - 2 * pad) / span;
  const ox = pad + (S - 2 * pad - candidate.spanX * k) / 2;
  const oy = pad + (S - 2 * pad - candidate.spanY * k) / 2;
  const pts = candidate.points
    .map((p) => `${ox + (p.x - minX) * k},${S - (oy + (p.y - minY) * k)}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="h-11 w-11 shrink-0 border border-line bg-field">
      <title>{candidate.layer || 'boundary'} preview</title>
      {candidate.closed ? (
        <polygon
          points={pts}
          className="fill-(--surface-tint) stroke-(--draw-strong)"
          strokeWidth={1.2}
        />
      ) : (
        <polyline
          points={pts}
          fill="none"
          className="stroke-(--draw-strong)"
          strokeWidth={1.2}
          strokeDasharray="3 2"
        />
      )}
    </svg>
  );
}

export default function ImportDialog({ fileName, candidates, scale, onConfirm, onCancel }: Props) {
  // pre-select the largest closed boundary as the planning site
  const [picks, setPicks] = useState<Map<string, ParcelKind>>(() => {
    const first = candidates.find((c) => c.closed);
    return new Map(first ? [[first.key, 'site' as ParcelKind]] : []);
  });
  const [keepExisting, setKeepExisting] = useState(false);

  const toggle = (c: BoundaryCandidate) =>
    setPicks((m) => {
      const next = new Map(m);
      if (next.has(c.key)) next.delete(c.key);
      else next.set(c.key, c.closed ? (next.size === 0 ? 'site' : 'adjacent') : 'road');
      return next;
    });

  const setKind = (key: string, kind: ParcelKind) => setPicks((m) => new Map(m).set(key, kind));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden border border-line bg-card">
        <header className="border-b border-line px-5 py-3">
          <h2 className="text-[14px] font-medium tracking-[0.18em] text-ink">IMPORT FROM DXF</h2>
          <p className="mt-1 text-[12px] text-muted">
            {fileName} — {candidates.length} boundaries found
            {scale !== 1 ? ', units mm→m' : ''}. Pick the 대지/인접대지/도로 traces to import.
          </p>
        </header>

        <div className="grow overflow-y-auto px-3 py-2">
          {candidates.map((c) => {
            const picked = picks.get(c.key);
            return (
              <div
                key={c.key}
                className={`mb-1.5 flex items-center gap-3 border p-2 ${
                  picked ? 'border-accent bg-accent/10' : 'border-line bg-field'
                }`}
              >
                <input
                  type="checkbox"
                  checked={!!picked}
                  onChange={() => toggle(c)}
                  className="h-4 w-4 accent-(--color-accent)"
                  aria-label={`Import ${c.layer || c.key}`}
                />
                <Preview candidate={c} />
                <div className="min-w-0 grow text-[12px] leading-relaxed">
                  <span className="block truncate text-ink">
                    {c.layer || '(no layer)'}
                    <span className="ml-2 text-faint">
                      {c.source === 'lines'
                        ? 'chained lines'
                        : c.closed
                          ? 'polyline'
                          : 'open polyline'}
                    </span>
                  </span>
                  <span className="text-muted">
                    {c.closed
                      ? `${c.area.toFixed(1)}㎡ · ${c.spanX.toFixed(1)}×${c.spanY.toFixed(1)}m`
                      : `${c.length.toFixed(1)}m run`}
                    {' · '}
                    {c.points.length} pts · EL {c.elMatched}/{c.points.length}
                  </span>
                </div>
                {picked && (
                  <select
                    value={picked}
                    onChange={(e) => setKind(c.key, e.target.value as ParcelKind)}
                    className="border border-line bg-field px-1.5 py-1 text-[12px] text-ink focus:border-accent focus:outline-none"
                    aria-label="Parcel kind"
                  >
                    <option value="site">계획대지</option>
                    <option value="adjacent">인접대지</option>
                    <option value="road">도로</option>
                  </select>
                )}
              </div>
            );
          })}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
          <label className="flex items-center gap-2 text-[12px] text-muted">
            <input
              type="checkbox"
              checked={keepExisting}
              onChange={(e) => setKeepExisting(e.target.checked)}
              className="h-4 w-4 accent-(--color-accent)"
            />
            keep existing parcels
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="cursor-pointer border border-line bg-field px-3 py-1.5 text-[10.5px] tracking-[0.16em] text-ink uppercase hover:border-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={picks.size === 0}
              onClick={() =>
                onConfirm(
                  candidates
                    .filter((c) => picks.has(c.key))
                    .map((candidate) => ({
                      candidate,
                      kind: picks.get(candidate.key) as ParcelKind,
                    })),
                  keepExisting,
                )
              }
              className="cursor-pointer border border-accent bg-accent/15 px-3 py-1.5 text-[10.5px] tracking-[0.16em] text-accent uppercase hover:enabled:bg-accent/25 disabled:cursor-default disabled:opacity-35"
            >
              Import {picks.size > 0 ? `(${picks.size})` : ''}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
