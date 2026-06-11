/**
 * Headless visual snapshot: server-render the real PlanView/SectionView
 * components with the sample data into a standalone SVG (used when no
 * browser is available in the environment).
 */
import { writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { computeWgl, makeVertex } from '../src/apps/wgl/geometry';
import PlanView from '../src/apps/wgl/PlanView';
import SectionView from '../src/apps/wgl/SectionView';

const vertices = [
  makeVertex(0.0, 4.8, 9.4),
  makeVertex(0.1, 3.2, 1.56),
  makeVertex(1.0, 2.2, 6.06),
  makeVertex(7.0, 2.0, 0.0),
  makeVertex(6.6, 3.9, 1.12),
  makeVertex(5.3, 4.9, 9.3),
];
const result = computeWgl(vertices);

const embed = (markup: string, x: number, y: number, h: number) =>
  markup.replace('<svg', `<svg x="${x}" y="${y}" width="640" height="${h}"`);

const plan = embed(
  renderToStaticMarkup(
    <PlanView
      vertices={vertices}
      wgl={result.wgl}
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
  renderToStaticMarkup(<SectionView vertices={vertices} result={result} />),
  20,
  590,
  280,
);

const stats = `Section Area: ${result.sectionArea.toFixed(2)} | Perimeter: ${result.perimeter.toFixed(
  2,
)} | h_min: ${result.hMin.toFixed(2)} + (${result.sectionArea.toFixed(2)} / ${result.perimeter.toFixed(
  2,
)}) = WGL ${result.wgl.toFixed(2)} m`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="680" height="940" viewBox="0 0 680 940" font-family="DejaVu Sans Mono, monospace">
<rect width="680" height="940" rx="18" fill="#141414" stroke="#2e2e2e"/>
<text x="34" y="56" fill="#d4d4d4" font-size="20" letter-spacing="6">WEIGHTED GROUND LEVEL</text>
<text x="34" y="100" fill="#8a8a8a" font-size="13" letter-spacing="3">PLAN VIEW</text>
${plan}
<line x1="20" y1="555" x2="660" y2="555" stroke="#2e2e2e"/>
<text x="34" y="582" fill="#8a8a8a" font-size="13" letter-spacing="3">SECTION VIEW</text>
${section}
<text x="34" y="905" fill="#8a8a8a" font-size="13">${stats}</text>
</svg>`;

writeFileSync('/tmp/wgl-snapshot.svg', svg);
console.log('wrote /tmp/wgl-snapshot.svg');
console.log(stats);
