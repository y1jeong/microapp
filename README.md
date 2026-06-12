# Arch Micro Apps

작고 집중된 건축 계산 도구 모음 — a collection of small, focused web calculators
for architects. One hub page, one route per tool.

The hub is built to scale to many tools: a live **search** box filters by name
(en/ko), 법규, or keyword; apps are grouped into **categories**; and a global
**command palette** (`⌘K` / `Ctrl+K`) jumps to any app from anywhere, including
from inside another app — arrow keys to move, `↵` to open, `esc` to close.

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

### Northlight Regulation · 정북 일조사선 (`#/northlight`)

In residential zones, 건축법 시행령 제86조 caps building height near the north
property line: parts up to the threshold height must keep the base setback
(1.5 m), and parts above it must keep at least their own height × ratio
(default h/2) from the north boundary. The tool shows the buildable envelope
floor by floor:

- **Plan view** — editable site polygon (drag vertices, double-click an edge
  to add a point, Alt-click to delete) with edge lengths, site area, a 5 m
  grid, and the north arrow. Colored lines mark each floor's setback boundary;
  the red dashed line is the base setback.
- **Isometric view** — stacked floor plates colored blue (low) → green (high)
  with per-floor height labels and the 사선 threshold plane dashed in red.
  Notched sites clip per part, so wings under the slope plane drop out while
  taller parts keep shrinking.
- **Stats** — buildable floors, total height, volume, and ground-floor area,
  live while editing.
- **Adjustable rule** — floor count and height, slope threshold (default 9 m;
  current law uses 10 m), base setback, and above-threshold ratio.

### Parking Layout · 주차 배치 (`#/parking`)

Auto-fits parking inside a site polygon per 주차장법 시행규칙 제3조·제6조. Stalls
run perpendicular along each boundary edge, inner columns are double-loaded, and
a circulation aisle threads between them — runs stop short of corners so cars are
never trapped behind a perpendicular row.

- **Plan view** — draggable site polygon (drag corners, double-click an edge to
  add a point or a vertex to delete it) with live edge lengths. Stalls and the
  aisle ring re-fit on every edit.
- **Edge + inner + circulation** — perimeter stalls along each edge, double-loaded
  inner rows, and the 6 m aisle (직각주차 차로) between them, each kept an
  aisle-deep maneuvering zone in front of its access face.
- **Exclusion blocks** — drop in 코어 / 램프 / 설비 (core / ramp / mech) obstacle
  blocks; drag to position them and stalls clear out of the way.
- **Adjustable rule** — stall width and depth (default 2.5 × 5.0 m) and aisle
  width (default 6 m).
- **Stats** — edge, inner, and total stall counts, site area, and parking
  efficiency, live while editing. State persists to localStorage.

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
   `#/<id>` route automatically. Each entry needs:
   - `category` — the hub section it groups under (e.g. `건축법`, `주차장법`).
   - `keywords` *(optional)* — extra search terms (synonyms, en/ko) so it's
     findable from the search box and `⌘K` palette even by words not in its copy.

Search ranking and category grouping live in `src/apps/search.ts` (unit-tested
in `search.test.ts`).
