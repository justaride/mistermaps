import type { Map } from "mapbox-gl";
import type { Pattern } from "../../types";

const SOURCE_ID = "mm-symbol-demo-source";
const ICON_LAYER_ID = "mm-symbol-demo-icons";
const TEXT_LAYER_ID = "mm-symbol-demo-text";

const DEFAULT_CENTER: [number, number] = [10.75, 59.91];

export const symbolLabelsIconsPattern: Pattern = {
  id: "symbol-labels-icons",
  name: "Symbol Labels + Icons",
  category: "layers",
  description:
    "Symbol layers for icons + labels with collision controls (SDF icon color/halo + text halo).",
  controls: [
    {
      id: "iconEnabled",
      label: "Icons enabled",
      type: "toggle",
      defaultValue: true,
    },
    {
      id: "iconSize",
      label: "Icon size",
      type: "slider",
      defaultValue: 1.0,
      min: 0.5,
      max: 2.0,
      step: 0.05,
    },
    {
      id: "iconColor",
      label: "Icon color (SDF)",
      type: "color",
      defaultValue: "#c85a2a",
    },
    {
      id: "iconHaloColor",
      label: "Icon halo color",
      type: "color",
      defaultValue: "#f7f5f0",
    },
    {
      id: "iconHaloWidth",
      label: "Icon halo width",
      type: "slider",
      defaultValue: 1.5,
      min: 0,
      max: 4,
      step: 0.5,
    },
    {
      id: "iconAllowOverlap",
      label: "Icon allow overlap",
      type: "toggle",
      defaultValue: false,
    },
    {
      id: "iconOptional",
      label: "Icon optional",
      type: "toggle",
      defaultValue: true,
    },

    {
      id: "textEnabled",
      label: "Labels enabled",
      type: "toggle",
      defaultValue: true,
    },
    {
      id: "textSize",
      label: "Text size",
      type: "slider",
      defaultValue: 14,
      min: 10,
      max: 22,
      step: 1,
    },
    {
      id: "textColor",
      label: "Text color",
      type: "color",
      defaultValue: "#2c2c2c",
    },
    {
      id: "textHaloColor",
      label: "Text halo color",
      type: "color",
      defaultValue: "#f7f5f0",
    },
    {
      id: "textHaloWidth",
      label: "Text halo width",
      type: "slider",
      defaultValue: 1.5,
      min: 0,
      max: 4,
      step: 0.5,
    },
    {
      id: "textAllowOverlap",
      label: "Text allow overlap",
      type: "toggle",
      defaultValue: false,
    },
    {
      id: "textOptional",
      label: "Text optional",
      type: "toggle",
      defaultValue: true,
    },
  ],

  setup(map: Map, controls: Record<string, unknown>) {
    map.easeTo({
      center: DEFAULT_CENTER,
      zoom: 12.5,
      pitch: 0,
      bearing: 0,
      duration: 900,
    });

    const points = generateRandomPointsAround(DEFAULT_CENTER, 220, 0.18);

    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: points.map((coord, i) => ({
          type: "Feature",
          properties: { id: i, name: `POI ${i + 1}` },
          geometry: { type: "Point", coordinates: coord },
        })),
      },
    });

    // Use a known-safe built-in Maki icon for Mapbox default styles.
    // If you use a custom style, you need a sprite sheet or must add your own image.
    map.addLayer({
      id: ICON_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      layout: {
        visibility: controls.iconEnabled ? "visible" : "none",
        "icon-image": "marker-15",
        "icon-size": clampNumber(controls.iconSize, 0.5, 2.0, 1.0),
        "icon-allow-overlap": Boolean(controls.iconAllowOverlap),
        "icon-optional": Boolean(controls.iconOptional),
      },
      paint: {
        "icon-color": (controls.iconColor as string) ?? "#c85a2a",
        "icon-halo-color": (controls.iconHaloColor as string) ?? "#f7f5f0",
        "icon-halo-width": clampNumber(controls.iconHaloWidth, 0, 4, 1.5),
      },
    });

    map.addLayer({
      id: TEXT_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      layout: {
        visibility: controls.textEnabled ? "visible" : "none",
        "text-field": ["get", "name"],
        "text-size": clampNumber(controls.textSize, 10, 22, 14),
        "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
        "text-offset": [0, 1.15],
        "text-anchor": "top",
        "text-allow-overlap": Boolean(controls.textAllowOverlap),
        "text-optional": Boolean(controls.textOptional),
      },
      paint: {
        "text-color": (controls.textColor as string) ?? "#2c2c2c",
        "text-halo-color": (controls.textHaloColor as string) ?? "#f7f5f0",
        "text-halo-width": clampNumber(controls.textHaloWidth, 0, 4, 1.5),
      },
    });
  },

  cleanup(map: Map) {
    if (map.getLayer(TEXT_LAYER_ID)) map.removeLayer(TEXT_LAYER_ID);
    if (map.getLayer(ICON_LAYER_ID)) map.removeLayer(ICON_LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  },

  update(map: Map, controls: Record<string, unknown>) {
    if (!map.getLayer(ICON_LAYER_ID) || !map.getLayer(TEXT_LAYER_ID)) return;

    map.setLayoutProperty(
      ICON_LAYER_ID,
      "visibility",
      controls.iconEnabled ? "visible" : "none",
    );
    map.setLayoutProperty(
      ICON_LAYER_ID,
      "icon-size",
      clampNumber(controls.iconSize, 0.5, 2.0, 1.0),
    );
    map.setLayoutProperty(
      ICON_LAYER_ID,
      "icon-allow-overlap",
      Boolean(controls.iconAllowOverlap),
    );
    map.setLayoutProperty(
      ICON_LAYER_ID,
      "icon-optional",
      Boolean(controls.iconOptional),
    );
    map.setPaintProperty(
      ICON_LAYER_ID,
      "icon-color",
      (controls.iconColor as string) ?? "#c85a2a",
    );
    map.setPaintProperty(
      ICON_LAYER_ID,
      "icon-halo-color",
      (controls.iconHaloColor as string) ?? "#f7f5f0",
    );
    map.setPaintProperty(
      ICON_LAYER_ID,
      "icon-halo-width",
      clampNumber(controls.iconHaloWidth, 0, 4, 1.5),
    );

    map.setLayoutProperty(
      TEXT_LAYER_ID,
      "visibility",
      controls.textEnabled ? "visible" : "none",
    );
    map.setLayoutProperty(
      TEXT_LAYER_ID,
      "text-size",
      clampNumber(controls.textSize, 10, 22, 14),
    );
    map.setLayoutProperty(
      TEXT_LAYER_ID,
      "text-allow-overlap",
      Boolean(controls.textAllowOverlap),
    );
    map.setLayoutProperty(
      TEXT_LAYER_ID,
      "text-optional",
      Boolean(controls.textOptional),
    );
    map.setPaintProperty(
      TEXT_LAYER_ID,
      "text-color",
      (controls.textColor as string) ?? "#2c2c2c",
    );
    map.setPaintProperty(
      TEXT_LAYER_ID,
      "text-halo-color",
      (controls.textHaloColor as string) ?? "#f7f5f0",
    );
    map.setPaintProperty(
      TEXT_LAYER_ID,
      "text-halo-width",
      clampNumber(controls.textHaloWidth, 0, 4, 1.5),
    );
  },

  snippet: `// Symbol labels + icons (SDF + text)
// Icons come from the style's sprite. Mapbox default styles include Maki icons like 'marker-15'.
// For custom styles, you must provide a sprite or call map.addImage(...).

map.addSource('pois', { type: 'geojson', data: poiGeoJson });

// Icons
map.addLayer({
  id: 'poi-icons',
  type: 'symbol',
  source: 'pois',
  layout: {
    'icon-image': 'marker-15',
    'icon-size': 1.0,
    'icon-allow-overlap': false,
    'icon-optional': true
  },
  paint: {
    // SDF icons can be recolored with icon-color
    'icon-color': '#c85a2a',
    'icon-halo-color': '#f7f5f0',
    'icon-halo-width': 1.5
  }
});

// Text labels
map.addLayer({
  id: 'poi-labels',
  type: 'symbol',
  source: 'pois',
  layout: {
    'text-field': ['get', 'name'],
    'text-size': 14,
    'text-offset': [0, 1.15],
    'text-anchor': 'top',
    'text-allow-overlap': false,
    'text-optional': true
  },
  paint: {
    'text-color': '#2c2c2c',
    'text-halo-color': '#f7f5f0',
    'text-halo-width': 1.5
  }
});

// Collision behavior:
// - allow-overlap = force draw even if it collides
// - optional = allow dropping this symbol if it collides`,
};

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function generateRandomPointsAround(
  center: [number, number],
  count: number,
  spreadDeg: number,
): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const lng = center[0] + (Math.random() - 0.5) * spreadDeg;
    const lat = center[1] + (Math.random() - 0.5) * spreadDeg;
    pts.push([lng, lat]);
  }
  return pts;
}

