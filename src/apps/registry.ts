import type { ComponentType } from 'react';
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
];
