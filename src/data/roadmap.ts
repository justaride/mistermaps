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
  "animated-route": ["Mapbox Directions API", "OSRM"],
  isochrones: ["Valhalla"],
  "overpass-poi-overlay": ["Overpass API"],
  "nasa-gibs-true-color": ["NASA GIBS (WMTS)"],
  "geocoding-search": ["Mapbox Geocoding", "Nominatim", "Photon"],
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

export const IMPLEMENTED_ROADMAP_ITEMS: RoadmapItem[] = [
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

export const PLANNED_ROADMAP_ITEMS: RoadmapItem[] = [
  {
    id: "planned:clip-simplify",
    name: "Viewport Clip + Simplification",
    artifact: "pattern",
    status: "planned",
    category: "Layers & Data",
    tags: ["interactive", "performance"],
    engineSupport: { mapbox: true, maplibre: true },
    dependencies: {},
    description:
      "Demonstrate client-side clipping and simplification to improve render performance.",
    acceptanceCriteria: [
      "Toggle clipping and simplification independently.",
      "Simplification tolerance is adjustable.",
      "Shows before/after feature counts or size estimates.",
    ],
  },
  {
    id: "planned:geojson-vt",
    name: "Client-Side Tiling (geojson-vt)",
    artifact: "pattern",
    status: "planned",
    category: "Layers & Data",
    tags: ["vector", "performance"],
    engineSupport: { mapbox: true, maplibre: true },
    dependencies: {},
    description:
      "Render large GeoJSON using client-side tiling to reduce per-frame cost.",
    acceptanceCriteria: [
      "Uses geojson-vt to create vector-tile-like tiles from GeoJSON.",
      "Includes a comparison toggle vs raw GeoJSON rendering.",
      "Works without freezing on a larger sample dataset.",
    ],
  },
  {
    id: "planned:draw-tools-basic",
    name: "Draw Tools (Basic)",
    artifact: "pattern",
    status: "planned",
    category: "Interaction & Editing",
    tags: ["interactive", "editing"],
    engineSupport: { mapbox: true, maplibre: true },
    dependencies: { notes: "Prefer minimal custom draw interactions (no heavy deps)." },
    description: "Basic draw/edit/delete for point/line/polygon geometries.",
    acceptanceCriteria: [
      "Draw point, line, and polygon with clear mode switching.",
      "Edit vertices and delete features.",
      "No lingering event handlers after cleanup.",
    ],
  },
  {
    id: "planned:feature-edit-export",
    name: "Feature Editing + Persist Export",
    artifact: "pattern",
    status: "planned",
    category: "Interaction & Editing",
    tags: ["interactive", "editing", "export"],
    engineSupport: { mapbox: true, maplibre: true },
    dependencies: {},
    description: "Edit geometry and export it for reuse.",
    acceptanceCriteria: [
      "Export edited features to GeoJSON.",
      "Import the exported GeoJSON back into the session.",
      "Round-trip preserves properties and geometry types.",
    ],
  },
  {
    id: "planned:box-select",
    name: "Box Select (Shift-Drag)",
    artifact: "pattern",
    status: "planned",
    category: "Interaction & Editing",
    tags: ["interactive"],
    engineSupport: { mapbox: true, maplibre: true },
    dependencies: {},
    description: "Shift-drag rectangle selection for features.",
    acceptanceCriteria: [
      "Shift-drag draws a rectangle and selects intersecting features.",
      "Selected styling is visually distinct and can be cleared.",
      "Selection does not break map panning when not active.",
    ],
  },
  {
    id: "planned:draggable-points",
    name: "Draggable Points",
    artifact: "pattern",
    status: "planned",
    category: "Interaction & Editing",
    tags: ["interactive"],
    engineSupport: { mapbox: true, maplibre: true },
    dependencies: {},
    description: "Drag point features and update underlying GeoJSON in real time.",
    acceptanceCriteria: [
      "Points can be dragged with mouse/touch.",
      "Dragging updates the GeoJSON source data.",
      "Drag handles do not interfere with map gestures when inactive.",
    ],
  },
  {
    id: "planned:context-menu",
    name: "Right-Click Context Menu",
    artifact: "pattern",
    status: "planned",
    category: "Interaction & Editing",
    tags: ["interactive"],
    engineSupport: { mapbox: true, maplibre: true },
    dependencies: {},
    description:
      "Context menu with actions like copy coordinates and drop pin.",
    acceptanceCriteria: [
      "Right-click opens a menu at cursor location.",
      "Includes actions: copy coords, drop pin, clear pins.",
      "Closes on escape and outside click.",
    ],
  },
  {
    id: "planned:keyboard-shortcuts",
    name: "Keyboard Shortcuts + Presets",
    artifact: "pattern",
    status: "planned",
    category: "Interaction & Editing",
    tags: ["interactive"],
    engineSupport: { mapbox: true, maplibre: true },
    dependencies: {},
    description: "Documented shortcuts for toggles and camera presets.",
    acceptanceCriteria: [
      "Shortcuts are discoverable in the UI (hint panel).",
      "Shortcuts do not trigger while typing in inputs.",
      "Preset camera positions can be recalled reliably.",
    ],
  },

  {
    id: "planned:geocoding-search",
    name: "Geocoding Search Pattern",
    artifact: "pattern",
    status: "planned",
    category: "Search & Navigation",
    tags: ["interactive", "api-required"],
    engineSupport: { mapbox: true, maplibre: true },
    dependencies: { api: ["Mapbox Geocoding", "Nominatim", "Photon"] },
    description:
      "A reusable geocoding UI with provider toggle and fly-to result pins.",
    acceptanceCriteria: [
      "Provider can be switched (mapbox/nominatim/photon).",
      "Selecting a result flies the camera and optionally drops a pin.",
      "Errors are handled without leaving stale results open.",
    ],
  },
  {
    id: "planned:reverse-geocoding",
    name: "Reverse Geocoding On Click",
    artifact: "pattern",
    status: "planned",
    category: "Search & Navigation",
    tags: ["interactive", "api-required"],
    engineSupport: { mapbox: true, maplibre: true },
    dependencies: { api: ["Mapbox Geocoding", "Nominatim"] },
    description: "Click map to get the nearest address/place with fallback.",
    acceptanceCriteria: [
      "Clicking the map resolves a place/address and shows it in a panel.",
      "Includes copy-to-clipboard for address + coordinates.",
      "Fallback provider is used if the primary fails.",
    ],
  },
  {
    id: "planned:routing-instructions",
    name: "Routing With Instructions Panel",
    artifact: "pattern",
    status: "planned",
    category: "Search & Navigation",
    tags: ["interactive", "api-required"],
    engineSupport: { mapbox: true, maplibre: false },
    dependencies: { api: ["Mapbox Directions API", "OSRM"] },
    description: "Route rendering plus turn-by-turn instructions and profiles.",
    acceptanceCriteria: [
      "Shows turn-by-turn steps with distance/time per step.",
      "Supports switching profiles and re-requesting routes.",
      "Waypoints can be adjusted and route updates accordingly.",
    ],
  },
  {
    id: "planned:route-alternatives",
    name: "Route Alternatives Selector",
    artifact: "pattern",
    status: "planned",
    category: "Search & Navigation",
    tags: ["interactive", "api-required"],
    engineSupport: { mapbox: true, maplibre: false },
    dependencies: { api: ["Mapbox Directions API", "OSRM"] },
    description: "Display and select among alternative routes.",
    acceptanceCriteria: [
      "Renders multiple route alternatives when available.",
      "Clicking an alternative makes it active and updates stats.",
      "Active route is visually emphasized.",
    ],
  },
  {
    id: "planned:map-matching",
    name: "Snap-To-Road / Map Matching",
    artifact: "pattern",
    status: "planned",
    category: "Search & Navigation",
    tags: ["api-required"],
    engineSupport: { mapbox: true, maplibre: false },
    dependencies: { api: ["Mapbox Map Matching API"], tokenRequired: true },
    description: "Snap a noisy GPS trace to roads and compare before/after.",
    acceptanceCriteria: [
      "Accepts an input trace and shows original vs snapped line.",
      "Shows summary stats (distance/time where available).",
      "Handles API errors with actionable messages.",
    ],
  },
  {
    id: "planned:elevation-profile",
    name: "Elevation Profile Along Route",
    artifact: "pattern",
    status: "planned",
    category: "Search & Navigation",
    tags: ["interactive", "3d"],
    engineSupport: { mapbox: true, maplibre: false },
    dependencies: { tokenRequired: true },
    description: "Sample terrain elevation along a line and render a profile chart.",
    acceptanceCriteria: [
      "Samples elevations along a line at a configurable interval.",
      "Renders a simple profile chart (SVG) with hover marker sync to map.",
      "Works only when terrain is enabled and communicates limitations.",
    ],
  },

  {
    id: "planned:hexbin-grid",
    name: "Hexbin / Grid Aggregation",
    artifact: "pattern",
    status: "planned",
    category: "Data Viz & Export",
    tags: ["interactive", "turf"],
    engineSupport: { mapbox: true, maplibre: true },
    dependencies: {},
    description: "Aggregate points into hexbins or grids and style by count.",
    acceptanceCriteria: [
      "Computes bins from point data and styles by aggregated count.",
      "Legend updates with the active scale.",
      "Bin size is adjustable.",
    ],
  },
  {
    id: "planned:time-slider",
    name: "Time Slider Playback",
    artifact: "pattern",
    status: "planned",
    category: "Data Viz & Export",
    tags: ["interactive", "animation"],
    engineSupport: { mapbox: true, maplibre: true },
    dependencies: {},
    description: "Scrub and play through time-series events on the map.",
    acceptanceCriteria: [
      "Includes a scrubber and play/pause controls.",
      "Visual output updates smoothly (no full reloads).",
      "Current time label is visible and accurate.",
    ],
  },
  {
    id: "planned:cluster-spiderfy",
    name: "Cluster Spiderfy",
    artifact: "pattern",
    status: "planned",
    category: "Data Viz & Export",
    tags: ["interactive"],
    engineSupport: { mapbox: true, maplibre: true },
    dependencies: {},
    description: "Expand dense clusters into a radial arrangement for selection.",
    acceptanceCriteria: [
      "Clicking a cluster expands it into a spider layout.",
      "Clicking away collapses it.",
      "Expanded points remain clickable with their original properties.",
    ],
  },
  {
    id: "planned:export-image-print",
    name: "Screenshot / Export Image + Print View",
    artifact: "pattern",
    status: "planned",
    category: "Data Viz & Export",
    tags: ["export"],
    engineSupport: { mapbox: true, maplibre: true },
    dependencies: {},
    description: "Export the current map view as PNG and provide a print layout.",
    acceptanceCriteria: [
      "Exports a PNG that includes required attribution.",
      "Print view has a simplified layout suitable for paper/PDF.",
      "Export does not crash when controls/panels are open.",
    ],
  },
];

export const ROADMAP_ITEMS: RoadmapItem[] = [
  ...IMPLEMENTED_ROADMAP_ITEMS,
  ...PLANNED_ROADMAP_ITEMS,
];
