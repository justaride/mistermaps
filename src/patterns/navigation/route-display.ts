import type { Map } from "mapbox-gl";
import type { Pattern } from "../../types";

const SOURCE_ID = "route-source";
const LAYER_ID = "route-layer";
const POINTS_SOURCE_ID = "route-points-source";
const POINTS_LAYER_ID = "route-points-layer";

export const routeDisplayPattern: Pattern = {
  id: "route-display",
  name: "Route Display",
  category: "navigation",
  description:
    "Display a path between waypoints with customizable line styling and markers.",
  controls: [
    {
      id: "lineWidth",
      label: "Line Width",
      type: "slider",
      defaultValue: 4,
      min: 1,
      max: 12,
      step: 1,
    },
    {
      id: "lineColor",
      label: "Line Color",
      type: "color",
      defaultValue: "#3b82f6",
    },
    {
      id: "showMarkers",
      label: "Show Waypoints",
      type: "toggle",
      defaultValue: true,
    },
    {
      id: "dashed",
      label: "Dashed Line",
      type: "toggle",
      defaultValue: false,
    },
  ],

  setup(map: Map, controls: Record<string, unknown>) {
    const route = createSampleRoute();

    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: route,
        },
      },
    });

    map.addSource(POINTS_SOURCE_ID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: route.map((coord, i) => ({
          type: "Feature",
          properties: {
            order: i + 1,
            isEndpoint: i === 0 || i === route.length - 1,
          },
          geometry: { type: "Point", coordinates: coord },
        })),
      },
    });

    map.addLayer({
      id: LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": controls.lineColor as string,
        "line-width": controls.lineWidth as number,
        "line-dasharray": controls.dashed ? [2, 2] : [1, 0],
      },
    });

    map.addLayer({
      id: POINTS_LAYER_ID,
      type: "circle",
      source: POINTS_SOURCE_ID,
      paint: {
        "circle-radius": ["case", ["get", "isEndpoint"], 8, 5],
        "circle-color": controls.lineColor as string,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff",
      },
      layout: {
        visibility: controls.showMarkers ? "visible" : "none",
      },
    });

    map.fitBounds(getBounds(route), { padding: 60 });
  },

  cleanup(map: Map) {
    if (map.getLayer(POINTS_LAYER_ID)) map.removeLayer(POINTS_LAYER_ID);
    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
    if (map.getSource(POINTS_SOURCE_ID)) map.removeSource(POINTS_SOURCE_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  },

  update(map: Map, controls: Record<string, unknown>) {
    if (!map.getLayer(LAYER_ID)) return;

    map.setPaintProperty(LAYER_ID, "line-color", controls.lineColor as string);
    map.setPaintProperty(LAYER_ID, "line-width", controls.lineWidth as number);
    map.setPaintProperty(
      LAYER_ID,
      "line-dasharray",
      controls.dashed ? [2, 2] : [1, 0],
    );
    map.setPaintProperty(
      POINTS_LAYER_ID,
      "circle-color",
      controls.lineColor as string,
    );
    map.setLayoutProperty(
      POINTS_LAYER_ID,
      "visibility",
      controls.showMarkers ? "visible" : "none",
    );
  },

  snippet: `// Route Display Pattern
const route = [[-74.006, 40.712], [-73.98, 40.76], ...];

map.addSource('route-source', {
  type: 'geojson',
  data: {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: route
    }
  }
});

map.addLayer({
  id: 'route-layer',
  type: 'line',
  source: 'route-source',
  layout: {
    'line-join': 'round',
    'line-cap': 'round'
  },
  paint: {
    'line-color': '#3b82f6',
    'line-width': 4
  }
});

// Add waypoint markers
map.addSource('waypoints', {
  type: 'geojson',
  data: waypointsGeoJSON
});

map.addLayer({
  id: 'waypoints-layer',
  type: 'circle',
  source: 'waypoints',
  paint: {
    'circle-radius': 8,
    'circle-color': '#3b82f6',
    'circle-stroke-width': 2,
    'circle-stroke-color': '#fff'
  }
});`,
};

function createSampleRoute(): [number, number][] {
  return [
    [-74.006, 40.7128],
    [-73.995, 40.722],
    [-73.985, 40.735],
    [-73.978, 40.752],
    [-73.968, 40.761],
    [-73.958, 40.768],
    [-73.95, 40.78],
  ];
}

function getBounds(
  coords: [number, number][],
): [[number, number], [number, number]] {
  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}
