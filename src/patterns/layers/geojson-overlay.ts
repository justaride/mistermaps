import type { Map } from "mapbox-gl";
import type { Pattern } from "../../types";

const SOURCE_ID = "geojson-source";
const FILL_LAYER_ID = "geojson-fill";
const LINE_LAYER_ID = "geojson-line";

export const geojsonOverlayPattern: Pattern = {
  id: "geojson-overlay",
  name: "GeoJSON Overlay",
  category: "layers",
  description:
    "Load and display GeoJSON data with customizable fill and stroke styling.",
  controls: [
    {
      id: "fillColor",
      label: "Fill Color",
      type: "color",
      defaultValue: "#3b82f6",
    },
    {
      id: "fillOpacity",
      label: "Fill Opacity",
      type: "slider",
      defaultValue: 0.4,
      min: 0,
      max: 1,
      step: 0.1,
    },
    {
      id: "strokeColor",
      label: "Stroke Color",
      type: "color",
      defaultValue: "#1d4ed8",
    },
    {
      id: "strokeWidth",
      label: "Stroke Width",
      type: "slider",
      defaultValue: 2,
      min: 0,
      max: 6,
      step: 0.5,
    },
  ],

  setup(map: Map, controls: Record<string, unknown>) {
    const geojson = createSampleGeoJSON();

    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: geojson,
    });

    map.addLayer({
      id: FILL_LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      filter: ["==", "$type", "Polygon"],
      paint: {
        "fill-color": controls.fillColor as string,
        "fill-opacity": controls.fillOpacity as number,
      },
    });

    map.addLayer({
      id: LINE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      paint: {
        "line-color": controls.strokeColor as string,
        "line-width": controls.strokeWidth as number,
      },
    });

    map.fitBounds(
      [
        [10.68, 59.9],
        [10.82, 59.95],
      ],
      { padding: 40 },
    );
  },

  cleanup(map: Map) {
    if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
    if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  },

  update(map: Map, controls: Record<string, unknown>) {
    if (!map.getLayer(FILL_LAYER_ID)) return;

    map.setPaintProperty(
      FILL_LAYER_ID,
      "fill-color",
      controls.fillColor as string,
    );
    map.setPaintProperty(
      FILL_LAYER_ID,
      "fill-opacity",
      controls.fillOpacity as number,
    );
    map.setPaintProperty(
      LINE_LAYER_ID,
      "line-color",
      controls.strokeColor as string,
    );
    map.setPaintProperty(
      LINE_LAYER_ID,
      "line-width",
      controls.strokeWidth as number,
    );
  },

  snippet: `// GeoJSON Overlay Pattern
// Load GeoJSON from URL or inline
const geojsonData = await fetch('/data/regions.geojson').then(r => r.json());

map.addSource('geojson-source', {
  type: 'geojson',
  data: geojsonData
});

// Fill layer for polygons
map.addLayer({
  id: 'geojson-fill',
  type: 'fill',
  source: 'geojson-source',
  filter: ['==', '$type', 'Polygon'],
  paint: {
    'fill-color': '#3b82f6',
    'fill-opacity': 0.4
  }
});

// Line layer for all geometries
map.addLayer({
  id: 'geojson-line',
  type: 'line',
  source: 'geojson-source',
  paint: {
    'line-color': '#1d4ed8',
    'line-width': 2
  }
});

// Fit map to GeoJSON bounds
const bounds = new mapboxgl.LngLatBounds();
geojsonData.features.forEach(f => {
  // Calculate bounds from coordinates
});
map.fitBounds(bounds, { padding: 40 });`,
};

function createSampleGeoJSON(): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "Sentrum" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [10.73, 59.91],
              [10.76, 59.91],
              [10.76, 59.92],
              [10.73, 59.92],
              [10.73, 59.91],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: { name: "Grünerløkka" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [10.76, 59.92],
              [10.79, 59.92],
              [10.79, 59.935],
              [10.76, 59.935],
              [10.76, 59.92],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: { name: "Connection" },
        geometry: {
          type: "LineString",
          coordinates: [
            [10.745, 59.915],
            [10.755, 59.925],
            [10.77, 59.927],
          ],
        },
      },
      {
        type: "Feature",
        properties: { name: "Frogner" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [10.7, 59.92],
              [10.73, 59.92],
              [10.73, 59.935],
              [10.7, 59.935],
              [10.7, 59.92],
            ],
          ],
        },
      },
    ],
  };
}
