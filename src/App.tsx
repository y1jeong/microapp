import { useEffect, useState } from 'react';
import { type MicroApp, microApps } from './apps/registry';
import CommandPalette from './CommandPalette';
import Hub from './Hub';
import { useTheme } from './theme';

function useHashRoute(): string {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash.replace(/^#\/?/, '');
}

function TopBar({ active, onOpenPalette }: { active?: MicroApp; onOpenPalette: () => void }) {
  const { dark, toggle } = useTheme();
  return (
    <nav className="mb-4 flex items-center justify-between gap-3 border-b border-line pb-3">
      <div className="flex min-w-0 items-baseline gap-3">
        {active ? (
          <a
            href="#/"
            className="shrink-0 text-[15px] font-medium tracking-tight text-ink no-underline"
          >
            ← arch micro apps.
          </a>
        ) : (
          <span className="text-[15px] font-medium tracking-tight">arch micro apps.</span>
        )}
        {active && (
          <span className="truncate text-[12px] tracking-[0.14em] text-accent">
            {active.titleKo}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpenPalette}
          title="Find an app (⌘K)"
          className="flex cursor-pointer items-center gap-1.5 border border-line bg-card px-3 py-1 text-[10px] tracking-[0.2em] text-muted uppercase hover:text-ink"
        >
          <span>find</span>
          <span className="font-mono text-[11px] tracking-normal normal-case text-faint">⌘K</span>
        </button>
        <button
          type="button"
          onClick={toggle}
          className="cursor-pointer border border-line bg-card px-3 py-1 text-[10px] tracking-[0.2em] text-muted uppercase hover:text-ink"
        >
          {dark ? 'light' : 'dark'}
        </button>
      </div>
    </nav>
  );
}

export default function App() {
  const route = useHashRoute();
  const active = microApps.find((a) => a.id === route);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // ⌘K / Ctrl+K toggles the palette from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Navigating closes the palette.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on route change to dismiss the overlay
  useEffect(() => setPaletteOpen(false), [route]);

  const Active = active?.component;

  return (
    <>
      <div className={`mx-auto p-4 ${active ? 'max-w-3xl' : 'max-w-5xl'}`}>
        <TopBar active={active} onOpenPalette={() => setPaletteOpen(true)} />
        {Active ? <Active /> : <Hub onOpenPalette={() => setPaletteOpen(true)} />}
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
