import type { ComponentType } from 'react';
import NorthlightApp from './northlight/NorthlightApp';
import WglApp from './wgl/WglApp';

export interface MicroApp {
  id: string;
  title: string;
  titleKo: string;
  /** statute reference shown as vertical edge text, editorial style */
  statute: string;
  description: string;
  facts: [string, string][];
  component: ComponentType;
}

export const microApps: MicroApp[] = [
  {
    id: 'wgl',
    title: 'weighted ground level',
    titleKo: '가중평균 지표면',
    statute: '건축법 시행령 제119조',
    description:
      'Average ground level along a building perimeter on sloped ground — plan and unfolded section, computed per parcel.',
    facts: [
      ['plan', 'parcels · drag corners · EL contours'],
      ['section', 'dimension band · G.L±0 line'],
      ['road', '도로 가중평균 수평면 · open trace'],
      ['import', 'DXF site plan · boundary picker'],
    ],
    component: WglApp,
  },
  {
    id: 'northlight',
    title: 'northlight regulation',
    titleKo: '정북 일조사선',
    statute: '건축법 시행령 제86조',
    description:
      'How the buildable envelope shrinks floor by floor under the north-side daylight slope plane.',
    facts: [
      ['plan', 'site polygon · per-floor setback lines'],
      ['iso', 'stacked floor plates · 사선 threshold'],
      ['stats', 'floors · height · volume · area'],
      ['rule', 'threshold · base setback · ratio'],
    ],
    component: NorthlightApp,
  },
];
