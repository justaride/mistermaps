# Mister Maps

Personal map design system built with React + TypeScript + Vite + Mapbox GL JS.

A full-screen map pattern browser focused on **Rendalen Kommune, Norway**. Browse patterns, interact with live demos, and copy implementation code.

**Live Demo:** [mister-maps.vercel.app](https://mister-maps.vercel.app)

## Quick Start

```bash
npm install
```

Add your Mapbox token to `.env.local`:

```
VITE_MAPBOX_TOKEN=pk.your_token_here
```

```bash
npm run dev
```

## Environment Variables

| Key               | Required | Notes                          |
| ----------------- | -------- | ------------------------------ |
| `VITE_MAPBOX_TOKEN` | Yes      | Mapbox token for Mapbox GL JS. |

On Vercel, set `VITE_MAPBOX_TOKEN` as a **Production** environment variable.

## Routes

| Path              | View                      |
| ----------------- | ------------------------- |
| `/`               | Landing page with mascot  |
| `/map`            | Full-screen map browser   |
| `/map?pattern=ID` | Map with specific pattern |

## Patterns

| Pattern         | Description                                           |
| --------------- | ----------------------------------------------------- |
| Rendalen Data   | Live Norwegian data (boundary, nature, water, trails) |
| Layer Inspector | Click to inspect features                             |

## Rendalen Data Sources

The app loads live data from Norwegian public APIs:

| Source             | Data             | API                                                       |
| ------------------ | ---------------- | --------------------------------------------------------- |
| Geonorge           | Kommune boundary | `ws.geonorge.no/kommuneinfo/v1`                           |
| Miljødirektoratet  | Nature reserves  | `kart.miljodirektoratet.no/arcgis/rest/services/vern`     |
| NVE Innsjødatabase | Lakes            | `kart.nve.no/enterprise/rest/services/Innsjodatabase2`    |
| NVE ELVIS          | Rivers           | `kart.nve.no/enterprise/rest/services/Elvenett1`          |
| Turrutebasen       | Hiking trails    | `wfs.geonorge.no/skwms1/wfs.turogfriluftsruter` (WFS/GML) |

**Rendalen Kommune Code:** 3424

Notes:
- Some sources return `MultiPolygon` / `MultiLineString` geometries; the map layer filters handle both.
- Some endpoints may return empty results depending on bounding box and upstream availability.

### Featured Locations

- Sølensjøen, Osensjøen, Lomnessjøen (lakes)
- Jutulhogget Canyon (Northern Europe's largest)
- Sølen landskapsvernområde (nature reserve)
- Glåma river

## Design System

Field explorer identity — like a weathered field journal meets modern topographic tool.

| Token    | Value                | Role                     |
| -------- | -------------------- | ------------------------ |
| `bg`     | `#eae6de` parchment  | Aged paper background    |
| `fg`     | `#2c2c2c` charcoal   | Pencil-like text         |
| `card`   | `#f7f5f0` linen      | Warm card surfaces       |
| `accent` | `#c85a2a` sienna     | Contour lines, CTAs      |
| `warn`   | `#d4a847` aged gold  | Compass brass highlights |
| `border` | `#3d3530` brown-gray | Leather-binding borders  |
| `topo`   | `#6b8f71` sage green | Topographic accents      |
| `water`  | `#5b8fa8` steel blue | Water features           |

**Typography:** Oswald (display) · Source Sans 3 (body) · JetBrains Mono (code)

**Visual effects:** Noise overlay, scanlines, grid-paper texture, topographic contour patterns, compass rose watermarks

### MrMaps Mascot

Sibling to MrNews — same 100x100 SVG architecture, shared animation patterns (spring physics, idle bob, AnimatePresence), distinct cartographic personality:

| Trait        | MrNews              | MrMaps                         |
| ------------ | ------------------- | ------------------------------ |
| Antenna      | Radar ball (accent) | Compass rose with N-S needle   |
| Body color   | Theme `--card`      | Khaki `#d4cbb5`                |
| Face color   | Theme `--fg`        | Sage green `#6b8f71`           |
| Badge text   | `MISTER NEWS`       | `MISTER MAPS` (burnt sienna)   |
| Scan tool    | Magnifying glass    | Magnifier with water-blue tint |
| Stamp tool   | Clipboard           | Folded map with contour lines  |
| Detail       | —                   | Folded map poking out of body  |
| State colors | Theme-based         | Earthy (sage, gold, sienna)    |

5 expressions (neutral, happy, alert, thinking, wink) · 5 poses (idle, wave, scan, stamp, point) · 5 states (offline, online, scanning, alert, presenting)

## Features

- Field explorer landing page with MrMaps robot mascot and scene cycling
- Field station console with live layer readings and coordinate display
- Compass rose watermarks and topographic contour decorations
- Full-screen Mapbox map centered on Rendalen
- Location search with autocomplete
- Pattern selector dropdown
- Interactive controls panel with synchronous filter initialization
- Map filter toggles sync correctly with async layer data loading
- Code viewer with copy functionality
- Light/dark theme toggle

## Tech Stack

- React 18
- TypeScript 5
- Vite 6
- Tailwind CSS v4
- Framer Motion
- React Router v7
- Lucide React icons
- Mapbox GL JS 3
- Turf.js 7
- react-syntax-highlighter

## Scripts

```bash
npm run dev      # Start dev server
npm run lint     # ESLint checks
npm run build    # Production build
npm run preview  # Preview production build
```

## Deployment

Deployed on Vercel. Push to `master` triggers automatic deploy.

- `vercel.json` includes an SPA rewrite so client-side routes like `/map` work on refresh.
- Local Vercel config lives in `.vercel/` (not committed). Use `vercel deploy --prod` for manual production deploys.

## Troubleshooting

### Layers not appearing

- Confirm `VITE_MAPBOX_TOKEN` is set (local `.env.local` or Vercel env var).
- On `/map`, select the **Rendalen Data** pattern and wait for the “All data loaded!” status message.
- If **Hiking Trails** is empty: the trails layer is loaded from WFS/GML and parsed client-side; upstream responses and axis order can vary. Open DevTools → Console/Network and check for request failures.

## License

MIT
