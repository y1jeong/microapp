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

- **Plan view** — drag corners to reshape the footprint; edge lengths, plan
  area, and elevation contours update live.
- **Section view** — the unfolded perimeter profile with the WGL line and the
  weighted-area hatch.
- **Vertex table** — edit X/Y/FH numerically, insert or delete corners.

## Development

```bash
npm install
npm run dev      # local dev server
npm test         # geometry unit tests (vitest)
npm run build    # type-check + production build to dist/
```

Stack: Vite + React + TypeScript, plain SVG rendering, no UI framework. The
build is fully static (`base: './'`), so `dist/` can be hosted anywhere —
GitHub Pages, Vercel, Netlify, or a plain file server.

## Adding a micro app

1. Create `src/apps/<id>/` with your app component.
2. Register it in `src/apps/registry.ts` — it appears on the hub and gets the
   `#/<id>` route automatically.
