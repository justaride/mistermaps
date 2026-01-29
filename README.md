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

## Patterns

### Data Visualization

| Pattern    | Description                          |
| ---------- | ------------------------------------ |
| Heatmap    | Point density visualization          |
| Choropleth | Colored regions (Rendalen districts) |

### Navigation

| Pattern              | Description           |
| -------------------- | --------------------- |
| Route Display        | Path with waypoints   |
| Distance Measurement | Click-to-measure tool |

### Markers

| Pattern           | Description             |
| ----------------- | ----------------------- |
| Clustered Markers | Auto-grouping points    |
| Custom Popups     | Rendalen landmarks info |

### Layers (Learning & Data)

| Pattern         | Description                                           |
| --------------- | ----------------------------------------------------- |
| Rendalen Data   | Live Norwegian data (boundary, nature, water, trails) |
| Layer Basics    | Interactive layer tutorial                            |
| GeoJSON Overlay | Load and style GeoJSON                                |
| 3D Buildings    | Extruded building footprints                          |
| Layer Explorer  | Toggle map style layers                               |
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

### Featured Locations

- Sølensjøen, Osensjøen, Lomnessjøen (lakes)
- Jutulhogget Canyon (Northern Europe's largest)
- Sølen landskapsvernområde (nature reserve)
- Glåma river

## Features

- Full-screen Mapbox map centered on Rendalen
- Location search with autocomplete
- Pattern selector dropdown
- Interactive controls panel
- Code viewer with copy functionality
- Light/dark theme toggle

## Tech Stack

- React 18
- TypeScript 5
- Vite 6
- Mapbox GL JS 3
- Turf.js 7
- react-syntax-highlighter

## Scripts

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run preview  # Preview production build
```

## Deployment

Deployed on Vercel. Push to deploy:

```bash
vercel --prod
```

## License

MIT
