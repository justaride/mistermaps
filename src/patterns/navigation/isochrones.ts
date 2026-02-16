import type { Map, MapMouseEvent } from "mapbox-gl";
import type { ControlValues, Pattern } from "../../types";
import { valhallaRoutingProvider } from "../../providers/routing";
import type { LngLat, RoutingProfile } from "../../providers/types";

const SOURCE_ID = "isochrone-source";
const LAYER_ID_PREFIX = "isochrone-layer-";

let clickHandler: ((e: MapMouseEvent) => void) | null = null;
let currentCenter: LngLat | null = null;
let currentControls: ControlValues = {};
let lastFetchKey = "";

function isRoutingProfile(value: unknown): value is RoutingProfile {
  return value === "driving" || value === "walking" || value === "cycling";
}

function roundCoord(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

function getFetchKey(center: LngLat, profile: string, minutes: number[]): string {
  return JSON.stringify({
    c: [roundCoord(center[0]), roundCoord(center[1])],
    p: profile,
    m: minutes,
  });
}

function removeLayers(map: Map) {
  const layers = map.getStyle().layers || [];
  for (const layer of layers) {
    if (layer.id.startsWith(LAYER_ID_PREFIX) && map.getLayer(layer.id)) {
      map.removeLayer(layer.id);
    }
  }
}

function applyOpacity(map: Map, opacity: number) {
  const layers = map.getStyle().layers || [];
  for (const layer of layers) {
    if (!layer.id.startsWith(LAYER_ID_PREFIX)) continue;
    if (!map.getLayer(layer.id)) continue;
    map.setPaintProperty(layer.id, "fill-opacity", opacity);
  }
}

function parseMinutes(raw: unknown): number[] {
  const str = typeof raw === "string" ? raw : "";
  return str
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

async function updateIsochrones(
  map: Map,
  center: LngLat,
  controls: ControlValues,
) {
  const minutes = parseMinutes(controls.intervals);
  const profile = isRoutingProfile(controls.profile)
    ? controls.profile
    : "driving";
  const opacity =
    typeof controls.opacity === "number" && Number.isFinite(controls.opacity)
      ? controls.opacity
      : 0.5;

  const fetchKey = getFetchKey(center, profile, minutes);

  // Opacity changes are frequent; avoid unnecessary network calls.
  if (fetchKey === lastFetchKey && map.getSource(SOURCE_ID)) {
    applyOpacity(map, opacity);
    return;
  }

  lastFetchKey = fetchKey;

  try {
    const data = await valhallaRoutingProvider.isochrone({
      center,
      minutes,
      profile,
    });

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data,
      });
    } else {
      (map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource).setData(data);
    }

    // Ensure deterministic order and avoid stale layers when intervals change.
    removeLayers(map);

    const colors = ["#4ade80", "#facc15", "#f87171", "#a78bfa", "#60a5fa"];

    const features = [...data.features].sort((a, b) => {
      const ca = Number(a.properties?.contour ?? 0);
      const cb = Number(b.properties?.contour ?? 0);
      // Largest first (background), smallest last (on top)
      return cb - ca;
    });

    features.forEach((feature, i) => {
      const contour = feature.properties?.contour;
      const layerId = `${LAYER_ID_PREFIX}${String(contour ?? i)}`;

      map.addLayer({
        id: layerId,
        type: "fill",
        source: SOURCE_ID,
        filter: ["==", ["get", "contour"], contour],
        paint: {
          "fill-color": colors[i % colors.length],
          "fill-opacity": opacity,
          "fill-outline-color": "#fff",
        },
      });
    });
  } catch (error) {
    console.error("Isochrone update failed:", error);
  }
}

export const isochronesPattern: Pattern = {
  id: "isochrones",
  name: "Isochrones (Travel Time)",
  category: "navigation",
  description:
    "Visualize reachable areas within specific travel time intervals using Valhalla.",
  controls: [
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
      id: "intervals",
      label: "Intervals (minutes)",
      type: "select",
      defaultValue: "10,20,30",
      options: [
        { label: "5, 10, 15", value: "5,10,15" },
        { label: "10, 20, 30", value: "10,20,30" },
        { label: "15, 30, 45", value: "15,30,45" },
      ],
    },
    {
      id: "opacity",
      label: "Opacity",
      type: "slider",
      defaultValue: 0.5,
      min: 0,
      max: 1,
      step: 0.1,
    },
  ],

  async setup(map: Map, controls: ControlValues) {
    currentControls = controls;
    currentCenter = map.getCenter().toArray() as LngLat;
    lastFetchKey = "";

    await updateIsochrones(map, currentCenter, currentControls);

    clickHandler = (e) => {
      currentCenter = [e.lngLat.lng, e.lngLat.lat] as LngLat;
      void updateIsochrones(map, currentCenter, currentControls);
    };
    map.on("click", clickHandler);
  },

  cleanup(map: Map) {
    if (clickHandler) {
      map.off("click", clickHandler);
      clickHandler = null;
    }

    removeLayers(map);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);

    currentCenter = null;
    currentControls = {};
    lastFetchKey = "";
  },

  async update(map: Map, controls: ControlValues) {
    currentControls = controls;
    const center = currentCenter ?? (map.getCenter().toArray() as LngLat);
    await updateIsochrones(map, center, currentControls);
  },

  snippet: `// Isochrones with Valhalla
const result = await valhallaRoutingProvider.isochrone({
  center: [10.75, 59.91],
  minutes: [10, 20, 30],
  profile: 'driving'
});

map.addSource('isochrones', {
  type: 'geojson',
  data: result
});

map.addLayer({
  id: 'isochrone-fill',
  type: 'fill',
  source: 'isochrones',
  paint: {
    'fill-color': ['interpolate', ['linear'], ['get', 'contour'], 
      10, '#4ade80', 
      20, '#facc15', 
      30, '#f87171'
    ],
    'fill-opacity': 0.5
  }
});`,
};
