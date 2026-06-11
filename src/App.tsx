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
      <div className="page">
        <nav className="topnav">
          <a href="#/">← ARCH MICRO APPS</a>
        </nav>
        <Active />
      </div>
    );
  }

  return (
    <div className="page">
      <header className="hub-header">
        <h1>ARCH MICRO APPS</h1>
        <p>건축 계산 도구 모음 — small, focused calculators for architects</p>
      </header>
      <div className="hub-grid">
        {microApps.map((a) => (
          <a key={a.id} className="hub-card" href={`#/${a.id}`}>
            <h2>{a.title}</h2>
            <p className="hub-card-ko">{a.titleKo}</p>
            <p className="hub-card-desc">{a.description}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
