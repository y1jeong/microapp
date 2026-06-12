/**
 * Headless visual snapshot: server-render the real PlanView/SectionView
 * components with the sample data into a standalone SVG (used when no
 * browser is available in the environment).
 */
import { writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { computeWgl, makeParcel, makeVertex } from '../src/apps/wgl/geometry';
import PlanView from '../src/apps/wgl/PlanView';
import SectionView from '../src/apps/wgl/SectionView';

const parcels = [
  makeParcel('계획대지 343-12,13', 'site', [
    makeVertex(0.0, 11.0, 24.3),
    makeVertex(18.1, 11.3, 25.8),
    makeVertex(28.4, 10.8, 26.3),
    makeVertex(28.0, 5.0, 26.4),
    makeVertex(27.5, 0.0, 25.6),
    makeVertex(0.5, 0.4, 25.6),
  ]),
  makeParcel('도로', 'road', [makeVertex(30.5, 10.6, 25.73), makeVertex(30.5, -10.3, 26.01)]),
  makeParcel('인접대지 343-5', 'adjacent', [
    makeVertex(-12.0, 11.2, 23.32),
    makeVertex(-1.2, 11.4, 23.56),
    makeVertex(-1.4, 1.3, 23.56),
    makeVertex(-13.4, 0.9, 23.64),
  ]),
];

const active = parcels[0];
const result = computeWgl(active.vertices, active.closed);
const road = parcels[1];
const roadResult = computeWgl(road.vertices, road.closed);

const embed = (markup: string, x: number, y: number, h: number) =>
  markup.replace('<svg', `<svg x="${x}" y="${y}" width="640" height="${h}"`);

const plan = embed(
  renderToStaticMarkup(
    <PlanView
      parcels={parcels}
      activeId={active.id}
      gl={result.gl}
      selectedId={null}
      onSelect={() => {}}
      onMove={() => {}}
    />,
  ),
  20,
  120,
  420,
);
const section = embed(
  renderToStaticMarkup(<SectionView parcel={active} result={result} />),
  20,
  600,
  320,
);
const roadSection = embed(
  renderToStaticMarkup(<SectionView parcel={road} result={roadResult} />),
  20,
  990,
  320,
);

const stats = (label: string, r: typeof result) =>
  `${label}: ${r.sectionArea.toFixed(2)}m2 / ${r.contactLength.toFixed(2)}m = ${r.avgHeight.toFixed(
    2,
  )}m | EL+${r.elMin.toFixed(2)} + ${r.avgHeight.toFixed(2)} = EL+${r.gl.toFixed(2)}`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="680" height="1390" viewBox="0 0 680 1390" font-family="DejaVu Sans Mono, monospace">
<rect width="680" height="1390" rx="18" fill="#141414" stroke="#2e2e2e"/>
<text x="34" y="56" fill="#d4d4d4" font-size="20" letter-spacing="6">WEIGHTED GROUND LEVEL</text>
<text x="34" y="100" fill="#8a8a8a" font-size="13" letter-spacing="3">PLAN VIEW</text>
${plan}
<line x1="20" y1="560" x2="660" y2="560" stroke="#2e2e2e"/>
<text x="34" y="590" fill="#8a8a8a" font-size="13" letter-spacing="3">SECTION VIEW (SITE)</text>
${section}
<text x="34" y="950" fill="#8a8a8a" font-size="12">${stats('site', result)}</text>
<line x1="20" y1="965" x2="660" y2="965" stroke="#2e2e2e"/>
<text x="34" y="985" fill="#8a8a8a" font-size="13" letter-spacing="3">SECTION VIEW (ROAD)</text>
${roadSection}
<text x="34" y="1345" fill="#8a8a8a" font-size="12">${stats('road', roadResult)}</text>
</svg>`;

writeFileSync('/tmp/wgl-snapshot.svg', svg);
console.log('wrote /tmp/wgl-snapshot.svg');
console.log(stats('site', result));
console.log(stats('road', roadResult));
