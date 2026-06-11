import { useEffect, useState } from 'react';
import { microApps } from './apps/registry';

function useHashRoute(): string {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash.replace(/^#\/?/, '');
}

export default function App() {
  const route = useHashRoute();
  const active = microApps.find((a) => a.id === route);

  if (active) {
    const Active = active.component;
    return (
      <div className="mx-auto max-w-3xl p-4">
        <nav className="mb-3">
          <a
            href="#/"
            className="text-[13px] tracking-[0.18em] text-muted no-underline hover:text-ink"
          >
            ← ARCH MICRO APPS
          </a>
        </nav>
        <Active />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <header>
        <h1 className="mt-6 mb-1 text-xl font-medium tracking-[0.35em]">ARCH MICRO APPS</h1>
        <p className="mb-6 text-[13px] text-muted">
          건축 계산 도구 모음 — small, focused calculators for architects
        </p>
      </header>
      <div className="grid gap-3.5">
        {microApps.map((a) => (
          <a
            key={a.id}
            href={`#/${a.id}`}
            className="block rounded-2xl border border-line bg-card px-5 py-4 text-ink no-underline transition-colors hover:border-accent-dim"
          >
            <h2 className="text-base font-semibold tracking-[0.08em]">{a.title}</h2>
            <p className="mt-1 mb-2 text-[13px] text-accent">{a.titleKo}</p>
            <p className="text-[12.5px] leading-relaxed text-muted">{a.description}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
