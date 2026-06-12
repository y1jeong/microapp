import type { ComponentType } from 'react';
import NorthlightApp from './northlight/NorthlightApp';
import WglApp from './wgl/WglApp';

export interface MicroApp {
  id: string;
  title: string;
  titleKo: string;
  description: string;
  component: ComponentType;
}

export const microApps: MicroApp[] = [
  {
    id: 'wgl',
    title: 'Weighted Ground Level',
    titleKo: '가중평균 지표면',
    description:
      'Average ground level along a building perimeter on sloped ground — plan + unfolded section, per 건축법 시행령 제119조.',
    component: WglApp,
  },
  {
    id: 'northlight',
    title: 'Northlight Regulation',
    titleKo: '정북 일조사선',
    description:
      'How the buildable envelope shrinks floor by floor under the north-side daylight slope plane, per 건축법 시행령 제86조 — plan setback lines + isometric stack.',
    component: NorthlightApp,
  },
];
