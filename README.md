# Mister Maps

Personal map design system built with React + TypeScript + Vite + Mapbox GL JS.

A map pattern catalog and project showcase. Browse interactive Mapbox GL and MapLibre demos, interact with live Norwegian public APIs, and copy implementation code.

**Live Demo:** [mistermaps.gabistudio.dev](https://mistermaps.gabistudio.dev)

## Quick Start

```bash
npm install
```

Add your Mapbox token and open-source endpoints to `.env.local`:

```
VITE_MAPBOX_TOKEN=pk.your_token_here
VITE_NOMINATIM_ENDPOINT=https://nominatim.openstreetmap.org
VITE_PHOTON_ENDPOINT=https://photon.komoot.io
VITE_OSRM_ENDPOINT=https://router.project-osrm.org/route/v1
VITE_VALHALLA_ENDPOINT=https://valhalla1.openstreetmap.de
VITE_OVERPASS_ENDPOINT=https://overpass.kumi.systems/api/interpreter
```

```bash
npm run dev
```

## Environment Variables

| Key                 | Required | Notes                          |
| ------------------- | -------- | ------------------------------ |
| `VITE_MAPBOX_TOKEN` | Yes      | Mapbox token for Mapbox GL JS. |
| `VITE_NOMINATIM_ENDPOINT` | No | OpenStreetMap Nominatim geocoder endpoint. |
| `VITE_PHOTON_ENDPOINT` | No | Komoot Photon geocoder endpoint. |
| `VITE_OSRM_ENDPOINT` | No | OSRM routing endpoint. |
| `VITE_VALHALLA_ENDPOINT` | No | Valhalla routing/isochrone endpoint. |
| `VITE_OVERPASS_ENDPOINT` | No | Overpass API endpoint (OSM POI queries). |

On Coolify, set `VITE_MAPBOX_TOKEN` as a build argument.

Note: `/maps/maplibre` uses **OpenFreeMap vector tiles** and does not require a Mapbox token.

## Routes

| Path                       | View                                                   |
| -------------------------- | ------------------------------------------------------ |
| `/`                        | Landing page — brand hub with mascot                   |
| `/maps`                    | Maps catalog — filterable grid of all demos            |
| `/maps/:id`                | Map detail — single interactive demo                   |
| `/projects/rendalen`       | Rendalen project — Norwegian data overlays             |
| `/projects/oslo-satellite` | Oslo Satellite — dark satellite map with blue clusters |

## Patterns

22 Mapbox GL patterns across 4 categories, plus MapLibre as a provider:

| Category   | Patterns                                                                                                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layers     | Layer Basics, Layer Inspector, Layer Explorer, GeoJSON Overlay, 3D Buildings, Feature State, Vector Feature State, Vector Road Styling, Vector Debug Tools, Terrain + Hillshade, NASA GIBS True Color |
| Data Viz   | Heatmap, Choropleth                                                                                                                                                                                   |
| Markers    | Clustered Markers, Custom Popups, Pulsing Dot                                                                                                                                                         |
| Navigation | Route Display, Animated Route, Isochrones (Valhalla), Geolocation, Distance Measurement, Area Measurement                                                                                             |
| Providers  | MapLibre GL (OpenFreeMap Vector)                                                                                                                                                                      |

## Open Source Providers & APIs

Mister Maps is committed to vendor neutrality. Beyond Mapbox, we support:
- **Geocoding:** Nominatim (OSM) and Photon (Komoot) as primary or fallback options.
- **Routing:** OSRM for fast directions and Valhalla for multimodal routing.
- **Isochrones:** Travel-time polygons powered by Valhalla.
- **OSM POIs:** Overpass API (no-key) for live POI/category overlays.
- **Vector Tiles:** OpenFreeMap (no-key) integrated into the MapLibre engine.

## Model Context Protocol (MCP)

This project supports [MCP](https://modelcontextprotocol.io) to allow AI agents to interact with map data. See `MCP.md` for setup instructions for:
- **Mapbox MCP Server:** Geocoding and directions tools for agents.
- **OpenStreetMap MCP Server:** POI search and map data inspection.

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

- Brand landing page with MrMaps robot mascot and scene cycling
- Maps catalog with category filter tabs
- Individual map detail pages with controls and code viewer
- Dedicated Rendalen project page with Norwegian data overlays
- Oslo East satellite page with darkened imagery, orange roads, and blue cluster markers
- Compass rose watermarks and topographic contour decorations
- Full-screen Mapbox GL maps centered on Rendalen
- MapLibre GL support with OSM/CARTO basemaps
- Location search with autocomplete
- Interactive controls panel with synchronous filter initialization
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

## Autonomous Development (Ralph Wiggum)

This project uses [Ralph Wiggum](https://github.com/fstandhartinger/ralph-wiggum) for spec-driven autonomous AI development.

```bash
./scripts/ralph-loop.sh        # Run autonomous build loop
./scripts/ralph-loop.sh 20     # Limit to 20 iterations
```

Create specs in `specs/` with testable acceptance criteria. The loop picks the highest priority incomplete spec, implements it, verifies criteria, commits, and moves on — each iteration with fresh context.

## Deployment

Deployed on Coolify with Docker + nginx. Push to `master` triggers automatic deploy.

- `Dockerfile` builds the Vite app and serves it via nginx.
- `nginx.conf` handles SPA rewrites so client-side routes like `/maps` work on refresh.

## Troubleshooting

### Layers not appearing

- Confirm `VITE_MAPBOX_TOKEN` is set (local `.env.local` or Coolify build arg).
- On `/projects/rendalen`, wait for the "All data loaded!" status message.
- If **Hiking Trails** is empty: the trails layer is loaded from WFS/GML and parsed client-side; upstream responses and axis order can vary. Open DevTools → Console/Network and check for request failures.

## License

MIT
