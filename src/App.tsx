import { useEffect, useState } from 'react';
import { microApps } from './apps/registry';
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

function TopBar({ backLink }: { backLink?: boolean }) {
  const { dark, toggle } = useTheme();
  return (
    <nav className="mb-4 flex items-center justify-between border-b border-line pb-3">
      {backLink ? (
        <a href="#/" className="text-[15px] font-medium tracking-tight text-ink no-underline">
          ← arch micro apps.
        </a>
      ) : (
        <span className="text-[15px] font-medium tracking-tight">arch micro apps.</span>
      )}
      <button
        type="button"
        onClick={toggle}
        className="cursor-pointer border border-line bg-card px-3 py-1 text-[10px] tracking-[0.2em] text-muted uppercase hover:text-ink"
      >
        {dark ? 'light' : 'dark'}
      </button>
    </nav>
  );
}

export default function App() {
  const route = useHashRoute();
  const active = microApps.find((a) => a.id === route);

  if (active) {
    const Active = active.component;
    return (
      <div className="mx-auto max-w-3xl p-4">
        <TopBar backLink />
        <Active />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <TopBar />
      <header className="mt-8 mb-6">
        <h1 className="m-0 text-4xl font-semibold tracking-tight">micro apps</h1>
        <p className="mt-1 text-[12px] tracking-[0.18em] text-muted uppercase">
          건축 계산 도구 — calculators for architects
        </p>
      </header>

      <div className="grid gap-4">
        {microApps.map((a) => (
          <a key={a.id} href={`#/${a.id}`} className="group relative block no-underline">
            <article className="grid border border-line bg-card text-ink transition-colors group-hover:border-ink sm:grid-cols-[1fr_240px]">
              <div className="relative p-6 pr-10">
                <h2 className="m-0 text-[27px] leading-tight font-semibold tracking-tight">
                  {a.title}
                </h2>
                <p className="mt-0.5 text-[12px] tracking-[0.14em] text-accent">{a.titleKo}</p>
                <p className="mt-4 max-w-[36ch] text-[12px] leading-relaxed text-muted">
                  {a.description}
                </p>
                <span className="absolute top-6 right-3 text-[10px] tracking-[0.22em] whitespace-nowrap text-faint uppercase [writing-mode:vertical-rl]">
                  {a.statute}
                </span>
              </div>
              <ul className="m-0 list-none border-line p-0 max-sm:border-t sm:border-l">
                {a.facts.map(([k, v]) => (
                  <li
                    key={k}
                    className="flex items-baseline gap-3 border-b border-line px-4 py-2.5 last:border-b-0"
                  >
                    <span className="w-12 shrink-0 text-[10px] tracking-[0.18em] text-faint uppercase">
                      {k}
                    </span>
                    <span className="text-[11.5px] leading-snug text-muted">{v}</span>
                  </li>
                ))}
              </ul>
            </article>
          </a>
        ))}
      </div>
    </div>
  );
}
