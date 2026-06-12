import { useMemo, useState } from 'react';
import { type MicroApp, microApps } from './apps/registry';
import { groupByCategory, searchApps } from './apps/search';

function AppCard({ app }: { app: MicroApp }) {
  return (
    <a href={`#/${app.id}`} className="group block no-underline">
      <article className="flex h-full flex-col border border-line bg-card p-4 transition-colors group-hover:border-ink">
        <h2 className="m-0 text-[18px] leading-tight font-semibold tracking-tight text-ink">
          {app.title}
        </h2>
        <p className="mt-0.5 text-[11px] tracking-[0.14em] text-accent">{app.titleKo}</p>
        <p className="mt-2.5 line-clamp-2 text-[12px] leading-relaxed text-muted">
          {app.description}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-2.5 gap-y-1">
          {app.facts.map(([k]) => (
            <span key={k} className="text-[9.5px] tracking-[0.16em] text-faint uppercase">
              {k}
            </span>
          ))}
        </div>
        <p className="mt-auto pt-3 font-mono text-[10px] tracking-[0.1em] text-faint">
          {app.statute}
        </p>
      </article>
    </a>
  );
}

export default function Hub({ onOpenPalette }: { onOpenPalette: () => void }) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchApps(microApps, query), [query]);
  const groups = useMemo(() => groupByCategory(results), [results]);

  // Enter with a single result jumps straight to it.
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && results.length > 0) {
      window.location.hash = `#/${results[0].id}`;
    }
  };

  return (
    <>
      <header className="mt-8 mb-6">
        <h1 className="m-0 text-4xl font-semibold tracking-tight">micro apps</h1>
        <p className="mt-1 text-[12px] tracking-[0.18em] text-muted uppercase">
          건축 계산 도구 — calculators for architects
        </p>
      </header>

      <div className="mb-7 flex items-stretch gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`Search ${microApps.length} apps by name, 법규, or keyword…`}
          aria-label="Search apps"
          className="w-full border border-line bg-field px-3.5 py-2.5 text-[14px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={onOpenPalette}
          title="Command palette"
          className="hidden shrink-0 cursor-pointer items-center gap-2 border border-line bg-card px-3.5 text-[11px] tracking-[0.14em] text-muted uppercase hover:text-ink sm:flex"
        >
          <span className="font-mono text-[12px] tracking-normal normal-case">⌘K</span>
        </button>
      </div>

      {results.length === 0 ? (
        <p className="border border-line bg-card px-4 py-12 text-center text-[13px] text-muted">
          No apps match “{query}”.
        </p>
      ) : (
        <div className="space-y-9">
          {groups.map(([category, apps]) => (
            <section key={category}>
              <div className="mb-3 flex items-baseline justify-between border-b border-line pb-1.5">
                <h2 className="m-0 text-[11px] tracking-[0.2em] text-muted uppercase">
                  {category}
                </h2>
                <span className="font-mono text-[10px] text-faint">{apps.length}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {apps.map((app) => (
                  <AppCard key={app.id} app={app} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
