# Maps of Maps (Roadmap)

This document is a human-readable snapshot of the "map of maps" for Mister Maps.

Source of truth for the roadmap UI is `src/data/roadmap.ts`, rendered at:

- `/maps/roadmap`

## Implemented

### Providers

- MapLibre GL (OpenFreeMap vector basemaps): `/maps/maplibre`

### Projects

- Rendalen Project (Norwegian public data overlays): `/projects/rendalen`
- Oslo Satellite (dark satellite + clusters): `/projects/oslo-satellite`

### Patterns (Catalog)

All pattern demos live under `/maps/:id`.

#### Layers & Data

- Layer Basics: `/maps/layer-basics`
- Layer Inspector: `/maps/layer-inspector`
- Layer Explorer: `/maps/layer-explorer`
- Vector Feature State: `/maps/vector-feature-state`
- Vector Road Styling: `/maps/vector-road-styling`
- Vector Debug Tools: `/maps/vector-debug-tools`
- 3D Buildings: `/maps/3d-buildings`
- Terrain + Hillshade: `/maps/terrain-hillshade`
- NASA GIBS True Color: `/maps/nasa-gibs-true-color`
- GeoJSON Overlay: `/maps/geojson-overlay`
- Feature State: `/maps/feature-state`
- Rendalen Data: `/maps/rendalen-data`

#### Data Viz & Export

- Heatmap: `/maps/heatmap`
- Choropleth: `/maps/choropleth`

#### Interaction & Editing

- Clustered Markers: `/maps/clustered-markers`
- Custom Popups: `/maps/custom-popups`
- Pulsing Dot: `/maps/pulsing-dot`

#### Search & Navigation

- Route Display: `/maps/route-display`
- Animated Route: `/maps/animated-route`
- Distance Measurement: `/maps/distance-measurement`
- Area Measurement: `/maps/area-measurement`
- Geolocation: `/maps/geolocation`
- Overpass POI Overlay: `/maps/overpass-poi-overlay`
- Isochrones (Travel Time): `/maps/isochrones`

### Tools

- Workbench (one map, many patterns): `/workbench`

## Planned (Core 30)

These are the next "maps to build" (as patterns/demos). Each item includes a target engine posture:

- Mapbox: requires `VITE_MAPBOX_TOKEN` for the Mapbox engine
- MapLibre: should work on `/maps/maplibre` style basemaps where feasible

### Basemaps & Styling

1. Style Switcher (Mapbox + MapLibre)
   - Goal: switch styles without losing viewport/context
   - AC: preserve camera; restore overlays when possible; clear error state on failures

2. Style JSON / URL Loader (Mapbox + MapLibre)
   - Goal: paste style URL/JSON and load safely
   - AC: URL or JSON input; validation errors shown; viewport stable on reload

3. Terrain Exaggeration Controls (Mapbox)
   - Goal: terrain exaggeration slider + sky/hillshade toggles
   - AC: real-time exaggeration; optional sky/hillshade; no console errors

4. Generic Raster Overlay (XYZ/WMTS) (Mapbox + MapLibre)
   - Goal: user-provided raster overlay with opacity + attribution
   - AC: add/remove; opacity control; attribution visible

5. Image Overlay (Bounds) (Mapbox + MapLibre)
   - Goal: georeferenced image overlay
   - AC: URL + bounds; fit-to-bounds; clean toggle/cleanup

6. Map Compare / Swipe (Mapbox + MapLibre)
   - Goal: swipe compare two styles with synced camera
   - AC: synced camera; draggable divider; mobile + desktop layout

### Layers & Data

7. Symbol Labels + Icons (SDF + text) (Mapbox + MapLibre)
   - Goal: icons + labels with key controls (size/color/halo/collision)

8. Line Decorations (dashes, arrows, gradients) (Mapbox + MapLibre)
   - Goal: demonstrate common route/path line patterns

9. Fill Patterns (Hatching/Stripes) (Mapbox + MapLibre)
   - Goal: polygon fill patterns via `fill-pattern`

10. Property-Based Filtering UI (Mapbox + MapLibre)
   - Goal: filter features by property with a small UI

11. Streaming Updates (setData) (Mapbox + MapLibre)
   - Goal: incremental updates without re-adding layers/sources

12. Viewport Clip + Simplification (Mapbox + MapLibre)
   - Goal: clip/simplify client-side for perf comparisons

13. Client-Side Tiling (geojson-vt) (Mapbox + MapLibre)
   - Goal: tile large GeoJSON client-side; compare vs raw GeoJSON

14. Lightweight Hover Tooltip Pattern (Mapbox + MapLibre)
   - Goal: hover tooltip without popup churn; cursor state handled

### Interaction & Editing

15. Draw Tools (Basic) (Mapbox + MapLibre)
   - Goal: basic draw/edit/delete for point/line/polygon

16. Feature Editing + Persist Export (Mapbox + MapLibre)
   - Goal: edit + export/import round-trip

17. Box Select (Shift-Drag) (Mapbox + MapLibre)
   - Goal: rectangle selection + selected styling

18. Draggable Points (Mapbox + MapLibre)
   - Goal: drag points and update GeoJSON live

19. Right-Click Context Menu (Mapbox + MapLibre)
   - Goal: copy coords / drop pin / clear pins actions

20. Keyboard Shortcuts + Presets (Mapbox + MapLibre)
   - Goal: shortcuts with input-safe behavior + discoverability

### Search & Navigation

21. Geocoding Search Pattern (Mapbox + MapLibre)
   - Dependencies: Mapbox Geocoding, Nominatim, Photon

22. Reverse Geocoding On Click (Mapbox + MapLibre)
   - Dependencies: Mapbox Geocoding, Nominatim

23. Routing With Instructions Panel (Mapbox)
   - Dependencies: Mapbox Directions, OSRM

24. Route Alternatives Selector (Mapbox)
   - Dependencies: Mapbox Directions, OSRM

25. Snap-To-Road / Map Matching (Mapbox)
   - Dependencies: Mapbox Map Matching API

26. Elevation Profile Along Route (Mapbox)
   - Dependencies: terrain enabled for sampling

### Data Viz & Export

27. Hexbin / Grid Aggregation (Mapbox + MapLibre)
   - Goal: aggregate points into bins; legend + size controls

28. Time Slider Playback (Mapbox + MapLibre)
   - Goal: time-series scrub/play with smooth updates

29. Cluster Spiderfy (Mapbox + MapLibre)
   - Goal: expand dense clusters radially for selection

30. Screenshot / Export Image + Print View (Mapbox + MapLibre)
   - Goal: export PNG (with attribution) + print-friendly layout

