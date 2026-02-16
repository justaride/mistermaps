import type { Map } from "mapbox-gl";
import type { ControlValues, Pattern } from "../../types";
import {
  mapboxRoutingProvider,
  osrmRoutingProvider,
} from "../../providers/routing";
import type { LngLat, RoutingProfile } from "../../providers/types";

const SOURCE_ID = "route-source";
const LAYER_ID = "route-layer";
const POINTS_SOURCE_ID = "route-points-source";
const POINTS_LAYER_ID = "route-points-layer";

const SAMPLE_COORDS: LngLat[] = [
  [10.7522, 59.9139], // Oslo Sentrum
  [10.6225, 59.9596], // Holmenkollen
];

let lastConfig = "";

function isRoutingProfile(value: unknown): value is RoutingProfile {
  return value === "driving" || value === "walking" || value === "cycling";
}

export const routeDisplayPattern: Pattern = {
  id: "route-display",
  name: "Route Display",
  category: "navigation",
  description:
    "Display a path between waypoints with customizable line styling and markers. Supports Mapbox and OSRM providers.",
  controls: [
    {
      id: "provider",
      label: "Provider",
      type: "select",
      defaultValue: "mapbox",
      options: [
        { label: "Mapbox", value: "mapbox" },
        { label: "OSRM (Open Source)", value: "osrm" },
      ],
    },
    {
      id: "profile",
      label: "Profile",
      type: "select",
      defaultValue: "driving",
      options: [
        { label: "Driving", value: "driving" },
        { label: "Walking", value: "walking" },
        { label: "Cycling", value: "cycling" },
      ],
    },
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

  async setup(map: Map, controls: ControlValues) {
    lastConfig = JSON.stringify({
      p: controls.provider,
      pr: controls.profile,
    });

    const route = await fetchRoute(controls);
    if (!route) return;

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
        features: route.length > 0 ? [route[0], route[route.length - 1]].map((coord, i) => ({
          type: "Feature",
          properties: {
            order: i === 0 ? "Start" : "End",
            isEndpoint: true,
          },
          geometry: { type: "Point", coordinates: coord },
        })) : [],
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
        "circle-radius": 8,
        "circle-color": controls.lineColor as string,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff",
      },
      layout: {
        visibility: controls.showMarkers ? "visible" : "none",
      },
    });

    if (route.length > 0) {
      map.fitBounds(getBounds(route), { padding: 60 });
    }
  },

  cleanup(map: Map) {
    if (map.getLayer(POINTS_LAYER_ID)) map.removeLayer(POINTS_LAYER_ID);
    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
    if (map.getSource(POINTS_SOURCE_ID)) map.removeSource(POINTS_SOURCE_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  },

  async update(map: Map, controls: ControlValues) {
    if (!map.getLayer(LAYER_ID)) return;

    const currentConfig = JSON.stringify({
      p: controls.provider,
      pr: controls.profile,
    });

    if (currentConfig !== lastConfig) {
      lastConfig = currentConfig;
      const route = await fetchRoute(controls);
      if (route) {
        const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource;
        if (source) {
          source.setData({
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: route },
          });
        }
        
        const ptsSource = map.getSource(POINTS_SOURCE_ID) as mapboxgl.GeoJSONSource;
        if (ptsSource) {
          ptsSource.setData({
            type: "FeatureCollection",
            features: [route[0], route[route.length - 1]].map((coord, i) => ({
              type: "Feature",
              properties: { order: i === 0 ? "Start" : "End", isEndpoint: true },
              geometry: { type: "Point", coordinates: coord },
            })),
          });
        }
      }
    }

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

  snippet: `// Route Display with Provider Support
import { mapboxRoutingProvider, osrmRoutingProvider } from './providers/routing';

const provider = controls.provider === 'osrm' ? osrmRoutingProvider : mapboxRoutingProvider;
const result = await provider.route({
  coordinates: [[10.75, 59.91], [10.62, 59.95]],
  profile: 'driving'
});

map.addSource('route', {
  type: 'geojson',
  data: {
    type: 'Feature',
    geometry: result.geometry
  }
});

map.addLayer({
  id: 'route-layer',
  type: 'line',
  source: 'route',
  paint: {
    'line-color': '#3b82f6',
    'line-width': 4
  }
});`,
};

async function fetchRoute(
  controls: ControlValues,
): Promise<LngLat[] | null> {
  const providerId = controls.provider as string;
  const profile = isRoutingProfile(controls.profile)
    ? controls.profile
    : "driving";
  const provider =
    providerId === "osrm" ? osrmRoutingProvider : mapboxRoutingProvider;

  try {
    const result = await provider.route({
      coordinates: SAMPLE_COORDS,
      profile,
    });
    return result.geometry.coordinates;
  } catch (error) {
    console.error(`Routing failed for ${providerId}:`, error);
    return null;
  }
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
