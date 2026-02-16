import type { Map } from "mapbox-gl";
import type { ControlValues, Pattern } from "../../types";

const SOURCE_ID = "mm-image-overlay-source";
const LAYER_ID = "mm-image-overlay-layer";

let lastFitTs: number | null = null;
let appliedKey: string | null = null;

export const imageOverlayPattern: Pattern = {
  id: "image-overlay",
  name: "Image Overlay (Bounds)",
  category: "layers",
  description:
    "Render an image overlay positioned by geographic bounds, with opacity and fit-to-bounds controls.",
  controls: [
    {
      id: "enabled",
      label: "Enabled",
      type: "toggle",
      defaultValue: true,
    },
    {
      id: "imageUrl",
      label: "Image URL",
      type: "text",
      defaultValue: "/overlays/sample-overlay.svg",
    },
    {
      id: "west",
      label: "West (lon)",
      type: "text",
      defaultValue: "10.6",
    },
    {
      id: "south",
      label: "South (lat)",
      type: "text",
      defaultValue: "59.85",
    },
    {
      id: "east",
      label: "East (lon)",
      type: "text",
      defaultValue: "10.9",
    },
    {
      id: "north",
      label: "North (lat)",
      type: "text",
      defaultValue: "60.0",
    },
    {
      id: "opacity",
      label: "Opacity",
      type: "slider",
      defaultValue: 0.8,
      min: 0,
      max: 1,
      step: 0.05,
    },
    {
      id: "fitToBounds",
      label: "Fit to bounds",
      type: "button",
      defaultValue: "",
    },
  ],

  setup(map: Map, controls: ControlValues) {
    // Visible-by-default behavior: overlay is enabled initially.
    ensureOverlay(map, controls, { forceRebuild: true });

    const bounds = parseBounds(controls);
    if (bounds) {
      fitToBounds(map, bounds);
    }
  },

  cleanup(map: Map) {
    removeOverlay(map);
    lastFitTs = null;
    appliedKey = null;
  },

  update(map: Map, controls: ControlValues) {
    const enabled = Boolean(controls.enabled);

    if (!enabled) {
      removeOverlay(map);
      return;
    }

    // Ensure existence and keep up to date if URL/bounds changed.
    ensureOverlay(map, controls, { forceRebuild: false });

    const opacity = clampNumber(controls.opacity, 0, 1, 0.8);
    if (map.getLayer(LAYER_ID)) {
      map.setPaintProperty(LAYER_ID, "raster-opacity", opacity);
    }

    const fitTs =
      typeof controls.fitToBounds === "number" ? controls.fitToBounds : null;
    if (fitTs && fitTs !== lastFitTs) {
      lastFitTs = fitTs;
      const bounds = parseBounds(controls);
      if (bounds) fitToBounds(map, bounds);
    }
  },

  snippet: `// Image overlay positioned by geographic bounds

const url = '/overlays/sample-overlay.svg';
const west = 10.6, south = 59.85, east = 10.9, north = 60.0;

map.addSource('image-overlay', {
  type: 'image',
  url,
  coordinates: [
    [west, north],
    [east, north],
    [east, south],
    [west, south]
  ]
});

map.addLayer({
  id: 'image-overlay-layer',
  type: 'raster',
  source: 'image-overlay',
  paint: { 'raster-opacity': 0.8 }
});

map.fitBounds([[west, south], [east, north]], { padding: 60 });`,
};

function ensureOverlay(
  map: Map,
  controls: ControlValues,
  options: { forceRebuild: boolean },
) {
  const url = (controls.imageUrl as string | undefined)?.trim() ?? "";
  const bounds = parseBounds(controls);
  if (!url || !bounds) {
    removeOverlay(map);
    appliedKey = null;
    return;
  }

  const key = buildKey(url, bounds);
  const exists = Boolean(map.getLayer(LAYER_ID) && map.getSource(SOURCE_ID));

  if (!options.forceRebuild && exists && key === appliedKey) return;

  const opacity = clampNumber(controls.opacity, 0, 1, 0.8);
  const beforeId = findFirstSymbolLayer(map);

  // Image sources don't have a robust "update coordinates/url" API; rebuild.
  removeOverlay(map);

  map.addSource(SOURCE_ID, {
    type: "image",
    url,
    coordinates: [
      [bounds.west, bounds.north],
      [bounds.east, bounds.north],
      [bounds.east, bounds.south],
      [bounds.west, bounds.south],
    ],
  });

  map.addLayer(
    {
      id: LAYER_ID,
      type: "raster",
      source: SOURCE_ID,
      paint: { "raster-opacity": opacity },
    },
    beforeId,
  );

  appliedKey = key;
}

function removeOverlay(map: Map) {
  if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}

function parseBounds(controls: ControlValues): {
  west: number;
  south: number;
  east: number;
  north: number;
} | null {
  const west = parseNumber(controls.west);
  const south = parseNumber(controls.south);
  const east = parseNumber(controls.east);
  const north = parseNumber(controls.north);

  if (
    west === null ||
    south === null ||
    east === null ||
    north === null ||
    !Number.isFinite(west) ||
    !Number.isFinite(south) ||
    !Number.isFinite(east) ||
    !Number.isFinite(north)
  ) {
    return null;
  }

  // Normalize if user swaps coordinates.
  const w = Math.min(west, east);
  const e = Math.max(west, east);
  const s = Math.min(south, north);
  const n = Math.max(south, north);

  if (w === e || s === n) return null;
  return { west: w, south: s, east: e, north: n };
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function fitToBounds(
  map: Map,
  bounds: { west: number; south: number; east: number; north: number },
) {
  map.fitBounds(
    [
      [bounds.west, bounds.south],
      [bounds.east, bounds.north],
    ],
    { padding: 60, duration: 800 },
  );
}

function buildKey(
  url: string,
  bounds: { west: number; south: number; east: number; north: number },
) {
  return [url, bounds.west, bounds.south, bounds.east, bounds.north].join("||");
}

// Keep overlay in sync without recreating the entire map instance.
// When inputs change, we rebuild the source+layer pair to avoid dangling resources.

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function findFirstSymbolLayer(map: Map): string | undefined {
  const layers = map.getStyle()?.layers;
  if (!layers) return undefined;

  for (const layer of layers) {
    if (
      layer.type === "symbol" &&
      "layout" in layer &&
      layer.layout &&
      "text-field" in layer.layout
    ) {
      return layer.id;
    }
  }

  return undefined;
}
