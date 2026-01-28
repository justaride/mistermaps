import type { Map } from "mapbox-gl";
import type { Pattern } from "../../types";

const SOURCE_ID = "heatmap-source";
const LAYER_ID = "heatmap-layer";

export const heatmapPattern: Pattern = {
  id: "heatmap",
  name: "Heatmap",
  category: "data-viz",
  description:
    "Visualize point density using a heat map. Points with higher concentration appear warmer.",
  controls: [
    {
      id: "radius",
      label: "Radius",
      type: "slider",
      defaultValue: 20,
      min: 5,
      max: 50,
      step: 1,
    },
    {
      id: "intensity",
      label: "Intensity",
      type: "slider",
      defaultValue: 1,
      min: 0.1,
      max: 3,
      step: 0.1,
    },
    {
      id: "opacity",
      label: "Opacity",
      type: "slider",
      defaultValue: 0.8,
      min: 0,
      max: 1,
      step: 0.1,
    },
  ],

  setup(map: Map, controls: Record<string, unknown>) {
    const points = generateRandomPoints([10.8, 61.7], [11.3, 62.0], 500);

    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: points.map((coord) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: coord },
          properties: { mag: Math.random() * 5 },
        })),
      },
    });

    map.addLayer({
      id: LAYER_ID,
      type: "heatmap",
      source: SOURCE_ID,
      paint: {
        "heatmap-weight": [
          "interpolate",
          ["linear"],
          ["get", "mag"],
          0,
          0,
          5,
          1,
        ],
        "heatmap-intensity": controls.intensity as number,
        "heatmap-radius": controls.radius as number,
        "heatmap-opacity": controls.opacity as number,
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(33,102,172,0)",
          0.2,
          "rgb(103,169,207)",
          0.4,
          "rgb(209,229,240)",
          0.6,
          "rgb(253,219,199)",
          0.8,
          "rgb(239,138,98)",
          1,
          "rgb(178,24,43)",
        ],
      },
    });
  },

  cleanup(map: Map) {
    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  },

  update(map: Map, controls: Record<string, unknown>) {
    if (!map.getLayer(LAYER_ID)) return;
    map.setPaintProperty(LAYER_ID, "heatmap-radius", controls.radius as number);
    map.setPaintProperty(
      LAYER_ID,
      "heatmap-intensity",
      controls.intensity as number,
    );
    map.setPaintProperty(
      LAYER_ID,
      "heatmap-opacity",
      controls.opacity as number,
    );
  },

  snippet: `// Heatmap Pattern
map.addSource('heatmap-source', {
  type: 'geojson',
  data: pointsGeoJSON
});

map.addLayer({
  id: 'heatmap-layer',
  type: 'heatmap',
  source: 'heatmap-source',
  paint: {
    'heatmap-weight': ['interpolate', ['linear'], ['get', 'mag'], 0, 0, 5, 1],
    'heatmap-intensity': 1,
    'heatmap-radius': 20,
    'heatmap-opacity': 0.8,
    'heatmap-color': [
      'interpolate', ['linear'], ['heatmap-density'],
      0, 'rgba(33,102,172,0)',
      0.2, 'rgb(103,169,207)',
      0.4, 'rgb(209,229,240)',
      0.6, 'rgb(253,219,199)',
      0.8, 'rgb(239,138,98)',
      1, 'rgb(178,24,43)'
    ]
  }
});`,
};

function generateRandomPoints(
  sw: [number, number],
  ne: [number, number],
  count: number,
): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const lng = sw[0] + Math.random() * (ne[0] - sw[0]);
    const lat = sw[1] + Math.random() * (ne[1] - sw[1]);
    points.push([lng, lat]);
  }
  return points;
}
