import type { Map } from "mapbox-gl";
import type { ControlValues, Pattern } from "../../types";

const DEM_SOURCE_ID = "terrain-dem";
const HILLSHADE_LAYER_ID = "terrain-hillshade";
const SKY_LAYER_ID = "terrain-sky";

export const terrainExaggerationPattern: Pattern = {
  id: "terrain-exaggeration",
  name: "Terrain Exaggeration Controls",
  category: "layers",
  description: "Control terrain exaggeration and optional sky/hillshade.",
  controls: [
    {
      id: "exaggeration",
      label: "Terrain Exaggeration",
      type: "slider",
      defaultValue: 1.6,
      min: 0,
      max: 5,
      step: 0.1,
    },
    {
      id: "showHillshade",
      label: "Show Hillshade",
      type: "toggle",
      defaultValue: true,
    },
    {
      id: "showSky",
      label: "Show Sky",
      type: "toggle",
      defaultValue: true,
    },
  ],

  setup(map: Map, controls: ControlValues) {
    map.easeTo({
      center: [10.9, 61.94],
      zoom: 11.5,
      pitch: 60,
      bearing: -20,
      duration: 1000,
    });

    map.addSource(DEM_SOURCE_ID, {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 512,
      maxzoom: 14,
    });

    map.setTerrain({
      source: DEM_SOURCE_ID,
      exaggeration: clampNumber(controls.exaggeration, 0, 5, 1.6),
    });

    const beforeId = findHillshadeInsertionLayer(map);

    map.addLayer(
      {
        id: HILLSHADE_LAYER_ID,
        type: "hillshade",
        source: DEM_SOURCE_ID,
        layout: {
          visibility: controls.showHillshade ? "visible" : "none",
        },
        paint: {
          "hillshade-exaggeration": 0.6,
        },
      },
      beforeId,
    );

    map.addLayer({
      id: SKY_LAYER_ID,
      type: "sky",
      layout: {
        visibility: controls.showSky ? "visible" : "none",
      },
      paint: {
        "sky-type": "atmosphere",
        "sky-atmosphere-sun": [0.0, 0.0],
        "sky-atmosphere-sun-intensity": 15,
      },
    });
  },

  cleanup(map: Map) {
    if (map.getLayer(SKY_LAYER_ID)) map.removeLayer(SKY_LAYER_ID);
    if (map.getLayer(HILLSHADE_LAYER_ID)) map.removeLayer(HILLSHADE_LAYER_ID);

    map.setTerrain(null);
    if (map.getSource(DEM_SOURCE_ID)) map.removeSource(DEM_SOURCE_ID);

    map.easeTo({
      pitch: 0,
      bearing: 0,
      duration: 500,
    });
  },

  update(map: Map, controls: ControlValues) {
    map.setTerrain({
      source: DEM_SOURCE_ID,
      exaggeration: clampNumber(controls.exaggeration, 0, 5, 1.6),
    });

    if (map.getLayer(HILLSHADE_LAYER_ID)) {
      map.setLayoutProperty(
        HILLSHADE_LAYER_ID,
        "visibility",
        controls.showHillshade ? "visible" : "none",
      );
    }

    if (map.getLayer(SKY_LAYER_ID)) {
      map.setLayoutProperty(
        SKY_LAYER_ID,
        "visibility",
        controls.showSky ? "visible" : "none",
      );
    }
  },

  snippet: `// Terrain exaggeration controls (Mapbox GL JS)
map.addSource('terrain-dem', {
  type: 'raster-dem',
  url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
  tileSize: 512,
  maxzoom: 14
});

// Enable 3D terrain
map.setTerrain({ source: 'terrain-dem', exaggeration: 1.6 });

// Optional hillshade (toggle visibility)
map.addLayer({
  id: 'terrain-hillshade',
  type: 'hillshade',
  source: 'terrain-dem',
  layout: { visibility: 'visible' },
  paint: { 'hillshade-exaggeration': 0.6 }
});

// Optional sky layer (toggle visibility)
map.addLayer({
  id: 'terrain-sky',
  type: 'sky',
  layout: { visibility: 'visible' },
  paint: {
    'sky-type': 'atmosphere',
    'sky-atmosphere-sun': [0.0, 0.0],
    'sky-atmosphere-sun-intensity': 15
  }
});

// Tilt to see relief
map.easeTo({ pitch: 60, bearing: -20 });`,
};

function findHillshadeInsertionLayer(map: Map): string | undefined {
  const style = map.getStyle();
  const layers = style?.layers || [];

  const preferred = layers.find((l) => l.id === "waterway-shadow")?.id;
  if (preferred) return preferred;

  const firstSymbol = layers.find((l) => l.type === "symbol")?.id;
  return firstSymbol;
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

