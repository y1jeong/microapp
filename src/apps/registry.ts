import type { ComponentType } from 'react';
import NorthlightApp from './northlight/NorthlightApp';
import ParkingApp from './parking/ParkingApp';
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
  {
    id: 'parking',
    title: 'parking layout',
    titleKo: '주차 배치',
    statute: '주차장법 시행규칙 제3조',
    description:
      'Auto-fitted parking inside a site polygon — perimeter stalls, inner double-loaded rows, and the circulation aisle between them.',
    facts: [
      ['plan', 'site polygon · drag corners · edge lengths'],
      ['stalls', 'edge rows · inner double rows · 2.5×5.0m'],
      ['aisle', 'circulation loop · 직각주차 차로 6.0m'],
      ['blocks', 'core · ramp · mech — 주차 제외 영역'],
      ['stats', 'stall counts · area · efficiency'],
    ],
    component: ParkingApp,
  },
];
