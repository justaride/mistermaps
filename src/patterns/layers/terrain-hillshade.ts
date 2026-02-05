import type { Map } from "mapbox-gl";
import type { Pattern } from "../../types";

const DEM_SOURCE_ID = "terrain-dem";
const HILLSHADE_LAYER_ID = "terrain-hillshade";
const SKY_LAYER_ID = "terrain-sky";

export const terrainHillshadePattern: Pattern = {
  id: "terrain-hillshade",
  name: "Terrain + Hillshade",
  category: "layers",
  description:
    "Add 3D terrain with a DEM source, optional hillshade, and an atmosphere sky layer.",
  controls: [
    {
      id: "exaggeration",
      label: "Terrain Exaggeration",
      type: "slider",
      defaultValue: 1.4,
      min: 0,
      max: 3,
      step: 0.1,
    },
    {
      id: "pitch",
      label: "Pitch",
      type: "slider",
      defaultValue: 60,
      min: 0,
      max: 80,
      step: 1,
    },
    {
      id: "showHillshade",
      label: "Show Hillshade",
      type: "toggle",
      defaultValue: true,
    },
    {
      id: "hillshadeIntensity",
      label: "Hillshade Intensity",
      type: "slider",
      defaultValue: 0.6,
      min: 0,
      max: 1,
      step: 0.05,
    },
    {
      id: "showSky",
      label: "Show Sky",
      type: "toggle",
      defaultValue: true,
    },
  ],

  setup(map: Map, controls: Record<string, unknown>) {
    map.easeTo({
      center: [10.9, 61.94],
      zoom: 11.5,
      pitch: controls.pitch as number,
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
      exaggeration: controls.exaggeration as number,
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
          "hillshade-exaggeration": controls.hillshadeIntensity as number,
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

  update(map: Map, controls: Record<string, unknown>) {
    map.setTerrain({
      source: DEM_SOURCE_ID,
      exaggeration: controls.exaggeration as number,
    });

    if (map.getLayer(HILLSHADE_LAYER_ID)) {
      map.setLayoutProperty(
        HILLSHADE_LAYER_ID,
        "visibility",
        controls.showHillshade ? "visible" : "none",
      );
      map.setPaintProperty(
        HILLSHADE_LAYER_ID,
        "hillshade-exaggeration",
        controls.hillshadeIntensity as number,
      );
    }

    if (map.getLayer(SKY_LAYER_ID)) {
      map.setLayoutProperty(
        SKY_LAYER_ID,
        "visibility",
        controls.showSky ? "visible" : "none",
      );
    }

    map.easeTo({
      pitch: controls.pitch as number,
      duration: 0,
    });
  },

  snippet: `// Terrain + Hillshade Pattern (Mapbox GL JS)
map.addSource('terrain-dem', {
  type: 'raster-dem',
  url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
  tileSize: 512,
  maxzoom: 14
});

// Enable 3D terrain
map.setTerrain({ source: 'terrain-dem', exaggeration: 1.4 });

// Optional hillshade overlay (insert below waterway shadows if present)
map.addLayer({
  id: 'terrain-hillshade',
  type: 'hillshade',
  source: 'terrain-dem',
  paint: { 'hillshade-exaggeration': 0.6 }
}, 'waterway-shadow');

// Add an atmosphere sky layer for nicer horizons
map.addLayer({
  id: 'terrain-sky',
  type: 'sky',
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
