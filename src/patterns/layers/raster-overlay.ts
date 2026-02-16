import type { Map } from "mapbox-gl";
import type { RasterSourceSpecification } from "mapbox-gl";
import type { ControlValues, Pattern } from "../../types";

const SOURCE_ID = "mm-raster-overlay-source";
const LAYER_ID = "mm-raster-overlay-layer";

let isActive = true;
let lastAddTs: number | null = null;
let lastRemoveTs: number | null = null;
let appliedKey: string | null = null;

export const rasterOverlayPattern: Pattern = {
  id: "raster-overlay",
  name: "Raster Overlay (XYZ/WMTS)",
  category: "layers",
  description:
    "Add/remove a generic raster tile overlay using a URL template (XYZ/WMTS), with live opacity and attribution.",
  controls: [
    {
      id: "tileUrlTemplate",
      label: "Tile URL Template",
      type: "textarea",
      defaultValue: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    },
    {
      id: "attribution",
      label: "Attribution",
      type: "text",
      defaultValue: "© OpenStreetMap contributors",
    },
    {
      id: "minZoom",
      label: "Min zoom (optional)",
      type: "text",
      defaultValue: "",
    },
    {
      id: "maxZoom",
      label: "Max zoom (optional)",
      type: "text",
      defaultValue: "19",
    },
    {
      id: "opacity",
      label: "Opacity",
      type: "slider",
      defaultValue: 0.75,
      min: 0,
      max: 1,
      step: 0.05,
    },
    {
      id: "addOverlay",
      label: "Add / Update",
      type: "button",
      defaultValue: "",
    },
    {
      id: "removeOverlay",
      label: "Remove",
      type: "button",
      defaultValue: "",
    },
  ],

  setup(map: Map, controls: ControlValues) {
    // Visible-by-default behavior: if inputs are filled, overlay shows on load.
    isActive = true;
    applyIfNeeded(map, controls, { forceRebuild: true });
  },

  cleanup(map: Map) {
    removeOverlay(map);
    isActive = true;
    lastAddTs = null;
    lastRemoveTs = null;
    appliedKey = null;
  },

  update(map: Map, controls: ControlValues) {
    const addTs = typeof controls.addOverlay === "number" ? controls.addOverlay : null;
    const removeTs =
      typeof controls.removeOverlay === "number" ? controls.removeOverlay : null;

    if (removeTs && removeTs !== lastRemoveTs) {
      lastRemoveTs = removeTs;
      isActive = false;
      removeOverlay(map);
      return;
    }

    if (addTs && addTs !== lastAddTs) {
      lastAddTs = addTs;
      isActive = true;
      applyIfNeeded(map, controls, { forceRebuild: true });
      return;
    }

    if (!isActive) return;

    // Ensure it exists (e.g. after a style change or cleanup by other demos).
    if (!map.getLayer(LAYER_ID) || !map.getSource(SOURCE_ID)) {
      applyIfNeeded(map, controls, { forceRebuild: true });
      return;
    }

    // Live opacity updates.
    const opacity = clampNumber(controls.opacity, 0, 1, 0.75);
    map.setPaintProperty(LAYER_ID, "raster-opacity", opacity);

    // If the core config changes, rebuild.
    const key = buildConfigKey(controls);
    if (key !== appliedKey) {
      applyIfNeeded(map, controls, { forceRebuild: true });
    }
  },

  snippet: `// Generic raster overlay (XYZ / WMTS tile template)
// Example: OpenStreetMap standard tiles

map.addSource('overlay-tiles', {
  type: 'raster',
  tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
  tileSize: 256,
  minzoom: 0,
  maxzoom: 19,
  attribution: '© OpenStreetMap contributors'
});

map.addLayer({
  id: 'overlay-layer',
  type: 'raster',
  source: 'overlay-tiles',
  paint: { 'raster-opacity': 0.75 }
});`,
};

function applyIfNeeded(
  map: Map,
  controls: ControlValues,
  options: { forceRebuild: boolean },
) {
  const tileUrl = (controls.tileUrlTemplate as string | undefined)?.trim() ?? "";
  if (!tileUrl) {
    removeOverlay(map);
    appliedKey = null;
    return;
  }

  const key = buildConfigKey(controls);
  if (!options.forceRebuild && key === appliedKey) return;

  const attribution = (controls.attribution as string | undefined)?.trim() ?? "";
  const minzoom = parseOptionalZoom(controls.minZoom);
  const maxzoom = parseOptionalZoom(controls.maxZoom);
  const opacity = clampNumber(controls.opacity, 0, 1, 0.75);
  const beforeId = findFirstSymbolLayer(map);

  removeOverlay(map);

  const source: RasterSourceSpecification = {
    type: "raster",
    tiles: [tileUrl],
    tileSize: 256,
    attribution: attribution || undefined,
  };
  if (typeof minzoom === "number") source.minzoom = minzoom;
  if (typeof maxzoom === "number") source.maxzoom = maxzoom;

  map.addSource(SOURCE_ID, source);
  map.addLayer(
    {
      id: LAYER_ID,
      type: "raster",
      source: SOURCE_ID,
      paint: {
        "raster-opacity": opacity,
      },
    },
    beforeId,
  );

  appliedKey = key;
}

function removeOverlay(map: Map) {
  if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}

function buildConfigKey(controls: ControlValues): string {
  const tileUrl = (controls.tileUrlTemplate as string | undefined)?.trim() ?? "";
  const attribution = (controls.attribution as string | undefined)?.trim() ?? "";
  const minZoom = (controls.minZoom as string | undefined)?.trim() ?? "";
  const maxZoom = (controls.maxZoom as string | undefined)?.trim() ?? "";
  return [tileUrl, attribution, minZoom, maxZoom].join("||");
}

function parseOptionalZoom(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  const rounded = Math.round(parsed);
  if (rounded < 0) return 0;
  return rounded;
}

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
