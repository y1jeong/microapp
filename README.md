# microapp — Northlight Regulation (정북 일조사선)

An interactive visualizer for the Korean north-side daylight setback regulation
(정북방향 일조권 사선제한, 건축법 시행령 제86조). It shows how the buildable
envelope of a site shrinks floor by floor under the slope plane.

## Run

No build step, no dependencies — open `index.html` in a browser, or serve the
folder statically:

```sh
npx http-server .
```

## Features

- **Plan view** — editable site polygon (drag the white vertices, double-click
  an edge to add a point, Alt-click a vertex to delete one), edge lengths,
  site area, 5 m grid, north arrow. Colored lines show each floor's setback
  boundary; the red dashed line is the base (1.5 m) setback.
- **Isometric view** — stacked floor plates colored from blue (low) to green
  (high), with per-floor height labels and the 사선 threshold marked in red.
- **Stats** — buildable floors, total height, volume, and ground-floor area.
- **Adjustable rule parameters** — floor count, floor height, slope threshold
  (default 9 m), base setback (default 1.5 m), and the above-threshold ratio
  (default h × 1/2).

## Rule model

A point is buildable at height *h* if its due-north distance to the site
boundary is at least:

- *h* ≤ threshold → base setback (1.5 m)
- *h* > threshold → max(base, *h* × ratio)

The footprint of each floor is evaluated at the floor's top height. State is
persisted to `localStorage`.

> Note: this is a study/visualization tool, not a code-compliance check —
> adjacent roads, 공동주택 채광 규정, district plans, etc. are out of scope.
