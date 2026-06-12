import { useEffect, useMemo, useRef, useState } from 'react';
import { microApps } from './apps/registry';
import { searchApps } from './apps/search';

/**
 * Global ⌘K / Ctrl+K launcher. Fuzzy-search every app and jump to it with the
 * keyboard, from the hub or from inside another app. This is the primary way to
 * navigate once the registry grows past a screenful of cards.
 */
export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const selRef = useRef<HTMLButtonElement>(null);

  const results = useMemo(() => searchApps(microApps, query), [query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSel(0);
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    setSel((s) => Math.min(s, Math.max(results.length - 1, 0)));
  }, [results]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when the selection moves to keep it in view
  useEffect(() => {
    selRef.current?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  if (!open) return null;

  const go = (id: string) => {
    window.location.hash = `#/${id}`;
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const app = results[sel];
      if (app) go(app.id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-to-close is a standard dialog affordance
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Find an app"
        className="w-full max-w-xl border border-line bg-card shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Jump to an app…"
          aria-label="Search apps"
          className="w-full border-b border-line bg-transparent px-4 py-3 text-[15px] text-ink placeholder:text-faint focus:outline-none"
        />
        <ul className="m-0 max-h-[52vh] list-none overflow-auto p-0">
          {results.length === 0 ? (
            <li className="px-4 py-8 text-center text-[13px] text-muted">
              No apps match “{query}”.
            </li>
          ) : (
            results.map((app, i) => (
              <li key={app.id}>
                <button
                  ref={i === sel ? selRef : undefined}
                  type="button"
                  onMouseMove={() => setSel(i)}
                  onClick={() => go(app.id)}
                  className={`flex w-full cursor-pointer items-baseline gap-3 px-4 py-2.5 text-left ${
                    i === sel ? 'bg-field' : ''
                  }`}
                >
                  <span className="truncate text-[14px] text-ink">{app.title}</span>
                  <span className="shrink-0 text-[11px] text-accent">{app.titleKo}</span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] tracking-[0.1em] text-faint">
                    {app.category}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-[10px] tracking-[0.1em] text-faint uppercase">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
