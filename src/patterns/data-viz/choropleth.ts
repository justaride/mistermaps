import type { Map } from "mapbox-gl";
import type { Pattern } from "../../types";

const SOURCE_ID = "choropleth-source";
const LAYER_ID = "choropleth-layer";
const OUTLINE_LAYER_ID = "choropleth-outline";

export const choroplethPattern: Pattern = {
  id: "choropleth",
  name: "Choropleth",
  category: "data-viz",
  description:
    "Color regions based on data values. Great for visualizing statistics across geographic areas.",
  controls: [
    {
      id: "opacity",
      label: "Fill Opacity",
      type: "slider",
      defaultValue: 0.7,
      min: 0,
      max: 1,
      step: 0.1,
    },
    {
      id: "showOutline",
      label: "Show Outline",
      type: "toggle",
      defaultValue: true,
    },
    {
      id: "colorScheme",
      label: "Color Scheme",
      type: "select",
      defaultValue: "blue",
      options: [
        { label: "Blue", value: "blue" },
        { label: "Green", value: "green" },
        { label: "Red", value: "red" },
        { label: "Purple", value: "purple" },
      ],
    },
  ],

  setup(map: Map, controls: Record<string, unknown>) {
    const boroughs = createOsloDistricts();
    const colors = getColorScheme(controls.colorScheme as string);

    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: boroughs,
    });

    map.addLayer({
      id: LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      paint: {
        "fill-color": [
          "interpolate",
          ["linear"],
          ["get", "value"],
          0,
          colors[0],
          50,
          colors[1],
          100,
          colors[2],
        ],
        "fill-opacity": controls.opacity as number,
      },
    });

    map.addLayer({
      id: OUTLINE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      paint: {
        "line-color": "#333",
        "line-width": 1,
      },
      layout: {
        visibility: controls.showOutline ? "visible" : "none",
      },
    });

    map.fitBounds(
      [
        [10.6, 59.85],
        [10.9, 59.97],
      ],
      { padding: 40 },
    );
  },

  cleanup(map: Map) {
    if (map.getLayer(OUTLINE_LAYER_ID)) map.removeLayer(OUTLINE_LAYER_ID);
    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  },

  update(map: Map, controls: Record<string, unknown>) {
    if (!map.getLayer(LAYER_ID)) return;

    const colors = getColorScheme(controls.colorScheme as string);

    map.setPaintProperty(LAYER_ID, "fill-opacity", controls.opacity as number);
    map.setPaintProperty(LAYER_ID, "fill-color", [
      "interpolate",
      ["linear"],
      ["get", "value"],
      0,
      colors[0],
      50,
      colors[1],
      100,
      colors[2],
    ]);
    map.setLayoutProperty(
      OUTLINE_LAYER_ID,
      "visibility",
      controls.showOutline ? "visible" : "none",
    );
  },

  snippet: `// Choropleth Pattern
map.addSource('choropleth-source', {
  type: 'geojson',
  data: regionsGeoJSON
});

map.addLayer({
  id: 'choropleth-layer',
  type: 'fill',
  source: 'choropleth-source',
  paint: {
    'fill-color': [
      'interpolate', ['linear'], ['get', 'value'],
      0, '#f7fbff',
      50, '#6baed6',
      100, '#08306b'
    ],
    'fill-opacity': 0.7
  }
});

map.addLayer({
  id: 'choropleth-outline',
  type: 'line',
  source: 'choropleth-source',
  paint: {
    'line-color': '#333',
    'line-width': 1
  }
});`,
};

function getColorScheme(scheme: string): [string, string, string] {
  const schemes: Record<string, [string, string, string]> = {
    blue: ["#f7fbff", "#6baed6", "#08306b"],
    green: ["#f7fcf5", "#74c476", "#00441b"],
    red: ["#fff5f0", "#fb6a4a", "#67000d"],
    purple: ["#fcfbfd", "#9e9ac8", "#3f007d"],
  };
  return schemes[scheme] || schemes.blue;
}

function createOsloDistricts(): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "Sentrum", value: 90 },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [10.73, 59.905],
              [10.76, 59.905],
              [10.76, 59.92],
              [10.73, 59.92],
              [10.73, 59.905],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: { name: "Grünerløkka", value: 75 },
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
        properties: { name: "Frogner", value: 60 },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [10.69, 59.915],
              [10.73, 59.915],
              [10.73, 59.93],
              [10.69, 59.93],
              [10.69, 59.915],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: { name: "Majorstuen", value: 45 },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [10.7, 59.93],
              [10.73, 59.93],
              [10.73, 59.945],
              [10.7, 59.945],
              [10.7, 59.93],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: { name: "Gamle Oslo", value: 30 },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [10.76, 59.9],
              [10.8, 59.9],
              [10.8, 59.92],
              [10.76, 59.92],
              [10.76, 59.9],
            ],
          ],
        },
      },
    ],
  };
}
