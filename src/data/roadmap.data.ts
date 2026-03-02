import { CATALOG, MAPLIBRE_ENTRY } from "./catalog";
import type { CatalogEntry } from "../types";
import type { RoadmapItem } from "../types/roadmap";

export const ROADMAP_CATEGORY_ORDER = [
  "Basemaps & Styling",
  "Layers & Data",
  "Interaction & Editing",
  "Search & Navigation",
  "Data Viz & Export",
  "Providers",
  "Projects",
] as const;

const CATALOG_CATEGORY_TO_ROADMAP_CATEGORY: Record<string, string> = {
  layers: "Layers & Data",
  "data-viz": "Data Viz & Export",
  markers: "Interaction & Editing",
  navigation: "Search & Navigation",
};

const PATTERN_APIS_BY_ID: Partial<Record<string, string[]>> = {
  "rendalen-data": [
    "Geonorge (kommuneinfo + WFS)",
    "Miljodirektoratet (Naturbase/ArcGIS)",
    "NVE (ArcGIS)",
  ],
  "route-display": ["Mapbox Directions API", "OSRM"],
  "routing-instructions": ["Mapbox Directions API", "OSRM"],
  "route-alternatives": ["Mapbox Directions API", "OSRM"],
  "map-matching": ["Mapbox Map Matching API"],
  "elevation-profile": ["Mapbox Directions API", "Mapbox Terrain-RGB"],
  "animated-route": ["Mapbox Directions API", "OSRM"],
  isochrones: ["Valhalla"],
  "overpass-poi-overlay": ["Overpass API"],
  "nasa-gibs-true-color": ["NASA GIBS (WMTS)"],
  "geocoding-search": ["Mapbox Geocoding", "Nominatim", "Photon"],
  "reverse-geocoding": ["Mapbox Geocoding", "Nominatim"],
};

const IMPLEMENTED_ACCEPTANCE_CRITERIA_BY_PATTERN_ID: Partial<
  Record<string, string[]>
> = {
  "style-switcher": [
    "Switching style preserves center/zoom/bearing/pitch.",
    "If overlays are enabled, they are restored when possible after style change.",
    "Clear error state if a style fails to load.",
  ],
  "style-loader": [
    "Supports pasting a style URL or raw JSON.",
    "Shows validation errors and does not break the map session.",
    "Reloading a style keeps viewport stable.",
  ],
  "raster-overlay": [
    "User can add a raster overlay by URL template and remove it again.",
    "Opacity is adjustable via a control.",
    "Attribution text is visible and configurable.",
  ],
  "image-overlay": [
    "Renders an image source with user-provided URL + bounds.",
    "Fit-to-bounds action sets the camera correctly.",
    "Overlay can be toggled on/off without leaking sources/layers.",
  ],
  "map-compare-swipe": [
    "Two maps are rendered with synchronized camera movement.",
    "A draggable divider reveals left/right styles.",
    "Works on mobile and desktop layouts.",
  ],
  "terrain-exaggeration": [
    "Slider controls terrain exaggeration in real time.",
    "Toggles for sky and hillshade are available when supported.",
    "Works on a terrain-capable basemap without console errors.",
  ],
  "symbol-labels-icons": [
    "Demonstrates icon + text symbols with size/color/halo controls.",
    "Collision behavior is demonstrated and documented in code snippet.",
    "No missing sprite warnings for included icons.",
  ],
  "line-decorations": [
    "Includes at least 3 line styles (dashed, gradient, directional/arrows).",
    "Controls switch styles without recreating the entire map.",
    "Snippet includes the key expressions/settings used.",
  ],
  "geocoding-search": [
    "Provider can be switched (mapbox/nominatim/photon).",
    "Selecting a result flies the camera and optionally drops a pin.",
    "Errors are handled without leaving stale results open.",
  ],
  "hover-tooltips": [
    "Tooltip follows cursor and updates on hover over features.",
    "Debounces updates to avoid excessive re-renders.",
    "Cursor state is restored on mouse leave.",
  ],
  "fill-patterns": [
    "User can switch between at least 3 fill patterns.",
    "Pattern scale/opacity controls are available when supported.",
    "Legend notes how patterns are created and applied.",
  ],
  "property-filtering": [
    "Filters update map layers via setFilter (or equivalent).",
    "Active filters are visible and can be cleared.",
    "Works on a sample dataset with at least 2 properties.",
  ],
  "streaming-updates": [
    "Append/update features over time via setData.",
    "Pause/resume controls are present.",
    "Avoids re-adding sources/layers on every tick.",
  ],
  "reverse-geocoding": [
    "Clicking the map resolves a place/address and shows it in a panel.",
    "Includes copy-to-clipboard for address + coordinates.",
    "Fallback provider is used if the primary fails.",
  ],
  "export-image-print": [
    "Exports a PNG that includes required attribution.",
    "Print view has a simplified layout suitable for paper/PDF.",
    "Export does not crash when controls/panels are open.",
  ],
  "clip-simplify": [
    "Toggle clipping and simplification independently.",
    "Simplification tolerance is adjustable.",
    "Shows before/after feature counts or size estimates.",
  ],
  "geojson-vt": [
    "Uses geojson-vt to create vector-tile-like tiles from GeoJSON.",
    "Includes a comparison toggle vs raw GeoJSON rendering.",
    "Works without freezing on a larger sample dataset.",
  ],
  "keyboard-shortcuts": [
    "Shortcuts are discoverable in the UI (hint panel).",
    "Shortcuts do not trigger while typing in inputs.",
    "Preset camera positions can be recalled reliably.",
  ],
  "box-select": [
    "Shift-drag draws a rectangle and selects intersecting features.",
    "Selected styling is visually distinct and can be cleared.",
    "Selection does not break map panning when not active.",
  ],
  "draggable-points": [
    "Points can be dragged with mouse/touch.",
    "Dragging updates the GeoJSON source data.",
    "Drag handles do not interfere with map gestures when inactive.",
  ],
  "context-menu": [
    "Right-click opens a menu at cursor location.",
    "Includes actions: copy coords, drop pin, clear pins.",
    "Closes on escape and outside click.",
  ],
  "hexbin-grid": [
    "Computes bins from point data and styles by aggregated count.",
    "Legend updates with the active scale.",
    "Bin size is adjustable.",
  ],
  "time-slider": [
    "Includes a scrubber and play/pause controls.",
    "Visual output updates smoothly (no full reloads).",
    "Current time label is visible and accurate.",
  ],
  "cluster-spiderfy": [
    "Clicking a cluster expands it into a spider layout.",
    "Clicking away collapses it.",
    "Expanded points remain clickable with their original properties.",
  ],
  "routing-instructions": [
    "Shows turn-by-turn steps with distance/time per step.",
    "Supports switching profiles/providers and re-requesting routes.",
    "Waypoints can be adjusted and route updates accordingly.",
  ],
  "route-alternatives": [
    "Renders multiple route alternatives when available.",
    "Clicking an alternative makes it active and updates stats.",
    "Active route is visually emphasized.",
  ],
  "map-matching": [
    "Accepts an input trace and shows original vs snapped line.",
    "Shows confidence and route distance comparison.",
    "Handles API errors with actionable messages.",
  ],
  "elevation-profile": [
    "Samples elevations along a route at a configurable interval.",
    "Renders an SVG profile chart with map-hover synchronization.",
    "Communicates terrain-data fallback limitations clearly.",
  ],
  "draw-tools-basic": [
    "Draw point, line, and polygon with clear mode switching.",
    "Edit vertices and delete features.",
    "No lingering event handlers after cleanup.",
  ],
  "feature-edit-export": [
    "Edit geometry and feature properties in-session.",
    "Export edited features to GeoJSON and import them back.",
    "Round-trip preserves properties and geometry types.",
  ],
};

const ENGINE_SUPPORT_OVERRIDES_BY_PATTERN_ID: Partial<
  Record<string, { mapbox: boolean; maplibre: boolean }>
> = {
  // Implemented as a dual-engine demo via an engine toggle inside the pattern view.
  "geocoding-search": { mapbox: true, maplibre: true },
  "hover-tooltips": { mapbox: true, maplibre: true },
  "fill-patterns": { mapbox: true, maplibre: true },
  "property-filtering": { mapbox: true, maplibre: true },
  "streaming-updates": { mapbox: true, maplibre: true },
  "reverse-geocoding": { mapbox: true, maplibre: true },
  "export-image-print": { mapbox: true, maplibre: true },
  "clip-simplify": { mapbox: true, maplibre: true },
  "geojson-vt": { mapbox: true, maplibre: true },
  "keyboard-shortcuts": { mapbox: true, maplibre: true },
  "box-select": { mapbox: true, maplibre: true },
  "draggable-points": { mapbox: true, maplibre: true },
  "context-menu": { mapbox: true, maplibre: true },
  "hexbin-grid": { mapbox: true, maplibre: true },
  "time-slider": { mapbox: true, maplibre: true },
  "cluster-spiderfy": { mapbox: true, maplibre: true },
};

function buildCatalogRoadmapItem(entry: CatalogEntry): RoadmapItem {
  const api = PATTERN_APIS_BY_ID[entry.patternId];
  const category =
    CATALOG_CATEGORY_TO_ROADMAP_CATEGORY[entry.category] ?? "Layers & Data";

  const acceptanceCriteria =
    entry.patternId !== "maplibre"
      ? IMPLEMENTED_ACCEPTANCE_CRITERIA_BY_PATTERN_ID[entry.patternId]
      : undefined;

  const engineSupportOverride =
    ENGINE_SUPPORT_OVERRIDES_BY_PATTERN_ID[entry.patternId];

  return {
    id: `pattern:${entry.patternId}`,
    name: entry.name,
    artifact: "pattern",
    status: "implemented",
    category,
    tags: entry.tags,
    engineSupport:
      engineSupportOverride ?? {
        mapbox: entry.provider === "mapbox",
        maplibre: entry.provider === "maplibre",
      },
    dependencies: {
      tokenRequired: entry.provider === "mapbox",
      api,
      notes: api?.length
        ? "Requires external endpoints; see README environment variables."
        : undefined,
    },
    links: { demoPath: `/maps/${entry.patternId}` },
    description: entry.description,
    acceptanceCriteria: acceptanceCriteria ?? [],
  };
}

export const IMPLEMENTED_ROADMAP_ITEMS_DATA: RoadmapItem[] = [
  ...CATALOG.map(buildCatalogRoadmapItem),
  {
    id: "provider:maplibre",
    name: MAPLIBRE_ENTRY.name,
    artifact: "provider",
    status: "implemented",
    category: "Providers",
    tags: MAPLIBRE_ENTRY.tags,
    engineSupport: { mapbox: false, maplibre: true },
    dependencies: {
      tokenRequired: false,
      notes: "Uses OpenFreeMap vector tiles; no Mapbox token required.",
    },
    links: { demoPath: "/maps/maplibre" },
    description: MAPLIBRE_ENTRY.description,
    acceptanceCriteria: [],
  },
  {
    id: "project:rendalen",
    name: "Rendalen Project",
    artifact: "project",
    status: "implemented",
    category: "Projects",
    tags: ["interactive", "geojson", "api-required"],
    engineSupport: { mapbox: true, maplibre: false },
    dependencies: {
      tokenRequired: true,
      api: [
        "Geonorge (kommuneinfo + WFS)",
        "Miljodirektoratet (Naturbase/ArcGIS)",
        "NVE (ArcGIS)",
      ],
      notes:
        "Norwegian public datasets overlaid on Rendalen kommune boundaries and features.",
    },
    links: { demoPath: "/projects/rendalen" },
    description:
      "Norwegian public data overlays for Rendalen kommune (boundaries, reserves, water, trails).",
    acceptanceCriteria: [],
  },
  {
    id: "project:oslo-satellite",
    name: "Oslo Satellite",
    artifact: "project",
    status: "implemented",
    category: "Projects",
    tags: ["interactive", "raster", "markers"],
    engineSupport: { mapbox: true, maplibre: false },
    dependencies: {
      tokenRequired: true,
      notes:
        "Darkened satellite style with clustered demo points and custom road/label styling.",
    },
    links: { demoPath: "/projects/oslo-satellite" },
    description:
      "Dark satellite basemap with blue clusters and restyled roads/labels for Oslo.",
    acceptanceCriteria: [],
  },
];

export const PLANNED_ROADMAP_ITEMS_DATA: RoadmapItem[] = [];

export const ROADMAP_ITEMS_DATA: RoadmapItem[] = [
  ...IMPLEMENTED_ROADMAP_ITEMS_DATA,
  ...PLANNED_ROADMAP_ITEMS_DATA,
];
