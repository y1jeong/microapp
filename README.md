# Arch Micro Apps

작고 집중된 건축 계산 도구 모음 — a collection of small, focused web calculators
for architects. One hub page, one route per tool.

## Micro apps

### Weighted Ground Level · 가중평균 지표면 (`#/wgl`)

When a building sits on sloped ground, 건축법 시행령 제119조 defines the design
ground level as the weighted average of ground elevations along the building
perimeter. The tool unfolds the perimeter into a section and computes:

```
WGL = h_min + (area between ground profile and h_min) / perimeter
```

- **Multiple parcels** — 계획대지, 인접대지, 도로 in one project, each with its
  own weighted average (G.L±0 = 최저레벨 + 면적÷접하는 길이).
- **도로 가중평균 수평면** — road frontages are open polylines averaged over
  the contact length instead of a closed perimeter.
- **Plan view** — drag corners to reshape the active parcel; other parcels stay
  dimmed in context. Edge lengths, plan area, and EL contours update live.
- **Section view** — the unfolded profile with a dimension band (numbered
  points + segment lengths, like the survey drawing), EL labels, and the
  G.L±0 line over the weighted-area hatch.
- **DXF import** — built for full 배치도 site plans: parses LWPOLYLINE/POLYLINE
  boundaries and chains loose LINE work into loops, filters out annotation
  noise, then shows a picker (with previews, layers, and sizes) to choose
  which boundaries are 대지/인접대지/도로. Units mm→m auto-detected; nearby
  `EL+xx.xx` TEXT labels become vertex elevations.
- **Vertex table** — edit X/Y/EL numerically, insert or delete corners.

## Development

```bash
npm install
npm run dev      # local dev server
npm test         # geometry unit tests (vitest)
npm run lint     # biome lint + format check
npm run format   # biome autofix
npm run build    # type-check + production build to dist/
```

## Desktop app (Electron)

```bash
npm run desktop    # build and open the desktop window directly
npm run dist:win   # build a Windows portable .exe + installer into release/
npm run dist:mac   # macOS app
npm run dist:linux # Linux AppImage
```

`npm run desktop` needs Node installed; the `dist:*` outputs are standalone —
double-click, no Node, no browser, no server.

Stack: React 19 · Vite 8 (Rolldown) · TypeScript 6 · Tailwind CSS v4
(CSS-first `@theme` config) · Vitest 4 · Biome. Views are plain SVG — no
chart library. The build is fully static (`base: './'`), so `dist/` can be
hosted anywhere — GitHub Pages, Vercel, Netlify, or a plain file server.

## Adding a micro app

1. Create `src/apps/<id>/` with your app component.
2. Register it in `src/apps/registry.ts` — it appears on the hub and gets the
   `#/<id>` route automatically.
