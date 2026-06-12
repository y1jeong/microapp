import { describe, expect, it } from 'vitest';
import type { MicroApp } from './registry';
import { groupByCategory, scoreApp, searchApps } from './search';

const make = (over: Partial<MicroApp>): MicroApp => ({
  id: 'x',
  title: 'sample app',
  titleKo: '샘플',
  category: 'misc',
  statute: '법 제1조',
  description: 'a description',
  facts: [],
  component: () => null,
  ...over,
});

const wgl = make({
  id: 'wgl',
  title: 'weighted ground level',
  titleKo: '가중평균 지표면',
  category: '건축법',
  keywords: ['elevation', '레벨'],
});
const northlight = make({
  id: 'northlight',
  title: 'northlight regulation',
  titleKo: '정북 일조사선',
  category: '건축법',
});
const parking = make({
  id: 'parking',
  title: 'parking layout',
  titleKo: '주차 배치',
  category: '주차장법',
  keywords: ['stall'],
});
const apps = [wgl, northlight, parking];

describe('scoreApp', () => {
  it('ranks a title prefix above a substring above a keyword hit', () => {
    expect(scoreApp(parking, 'parking')).toBe(4); // prefix
    expect(scoreApp(wgl, 'ground')).toBe(3); // title substring
    expect(scoreApp(wgl, 'elevation')).toBe(2); // keyword only
  });

  it('matches Korean titles', () => {
    expect(scoreApp(parking, '주차')).toBe(4);
    expect(scoreApp(wgl, '지표면')).toBe(3);
  });

  it('returns 0 when nothing matches', () => {
    expect(scoreApp(parking, 'zzzz')).toBe(0);
  });

  it('treats an empty query as a neutral match', () => {
    expect(scoreApp(parking, '')).toBe(1);
    expect(scoreApp(parking, '   ')).toBe(1);
  });

  it('falls back to a fuzzy subsequence on the title', () => {
    // p-a-r-k as a subsequence of "parking layout"
    expect(scoreApp(parking, 'prkl')).toBe(1);
  });
});

describe('searchApps', () => {
  it('keeps registry order for an empty query', () => {
    expect(searchApps(apps, '')).toEqual(apps);
  });

  it('filters and orders by relevance', () => {
    const r = searchApps(apps, 'regulation');
    expect(r).toEqual([northlight]);
  });

  it('finds across english, korean, and keywords', () => {
    expect(searchApps(apps, 'stall')).toEqual([parking]);
    expect(searchApps(apps, '일조')).toEqual([northlight]);
  });

  it('returns nothing for an unmatched query', () => {
    expect(searchApps(apps, 'spreadsheet')).toEqual([]);
  });
});

describe('groupByCategory', () => {
  it('groups while preserving first-seen order', () => {
    const groups = groupByCategory(apps);
    expect(groups.map(([c]) => c)).toEqual(['건축법', '주차장법']);
    expect(groups[0][1]).toEqual([wgl, northlight]);
    expect(groups[1][1]).toEqual([parking]);
  });
});
