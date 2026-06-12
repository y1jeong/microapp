import type { MicroApp } from './registry';

/** Lowercased searchable text for an app: every field a user might type. */
function haystack(app: MicroApp): string {
  return [
    app.title,
    app.titleKo,
    app.category,
    app.statute,
    app.description,
    ...(app.keywords ?? []),
    ...app.facts.flatMap(([k, v]) => [k, v]),
  ]
    .join(' ')
    .toLowerCase();
}

/** True if every char of `q` appears in `s` in order (loose fuzzy match). */
function isSubsequence(q: string, s: string): boolean {
  let i = 0;
  for (let j = 0; j < s.length && i < q.length; j++) {
    if (s[j] === q[i]) i++;
  }
  return i === q.length;
}

/**
 * Relevance of `query` to `app`. Higher is better; 0 means no match.
 * Ranking: title/Korean prefix > title/Korean substring > any-field
 * substring > fuzzy title subsequence.
 */
export function scoreApp(app: MicroApp, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const title = app.title.toLowerCase();
  const ko = app.titleKo.toLowerCase();
  if (title.startsWith(q) || ko.startsWith(q)) return 4;
  if (title.includes(q) || ko.includes(q)) return 3;
  if (haystack(app).includes(q)) return 2;
  if (isSubsequence(q, title)) return 1;
  return 0;
}

/** Apps matching `query`, most relevant first. Empty query keeps registry order. */
export function searchApps(apps: MicroApp[], query: string): MicroApp[] {
  if (!query.trim()) return apps;
  return apps
    .map((app, index) => ({ app, index, score: scoreApp(app, query) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((x) => x.app);
}

/** Group apps by `category`, preserving first-seen category order. */
export function groupByCategory(apps: MicroApp[]): [string, MicroApp[]][] {
  const groups = new Map<string, MicroApp[]>();
  for (const app of apps) {
    const list = groups.get(app.category);
    if (list) list.push(app);
    else groups.set(app.category, [app]);
  }
  return [...groups.entries()];
}
