# Mister Maps

Personal map design system built with React + TypeScript + Vite + Mapbox GL JS.

A full-screen map pattern browser with floating overlay controls. Browse patterns, interact with live demos, and copy implementation code.

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

| Category   | Pattern              | Description                   |
| ---------- | -------------------- | ----------------------------- |
| Data Viz   | Heatmap              | Point density visualization   |
| Data Viz   | Choropleth           | Colored regions by data value |
| Navigation | Route Display        | Path with styled waypoints    |
| Navigation | Distance Measurement | Click-to-measure tool         |
| Markers    | Clustered Markers    | Auto-grouping point clusters  |
| Markers    | Custom Popups        | Rich information windows      |
| Layers     | GeoJSON Overlay      | Load and style GeoJSON        |
| Layers     | 3D Buildings         | Extruded building footprints  |

## Features

- Full-screen Mapbox map
- Pattern selector dropdown (top-left)
- Interactive controls panel (bottom-left)
- Code viewer with copy functionality (right panel)
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

## License

MIT
