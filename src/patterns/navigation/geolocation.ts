import type { Map, GeoJSONSource } from "mapbox-gl";
import * as turf from "@turf/turf";
import type { Pattern } from "../../types";

const LOCATION_SOURCE_ID = "geolocation-location";
const ACCURACY_SOURCE_ID = "geolocation-accuracy";

const LOCATION_LAYER_ID = "geolocation-dot";
const ACCURACY_FILL_LAYER_ID = "geolocation-accuracy-fill";
const ACCURACY_LINE_LAYER_ID = "geolocation-accuracy-line";

let watchId: number | null = null;
let lastTracking: "off" | "once" | "follow" | null = null;
let statusPanel: HTMLDivElement | null = null;
let hasFix = false;
let lastFollowMs = 0;
let currentControls: Record<string, unknown> = {};

export const geolocationPattern: Pattern = {
  id: "geolocation",
  name: "Geolocation",
  category: "navigation",
  description:
    "Request browser geolocation and show your position with an accuracy circle.",
  controls: [
    {
      id: "tracking",
      label: "Tracking",
      type: "select",
      defaultValue: "off",
      options: [
        { label: "Off", value: "off" },
        { label: "Once", value: "once" },
        { label: "Follow", value: "follow" },
      ],
    },
    {
      id: "showAccuracy",
      label: "Accuracy Circle",
      type: "toggle",
      defaultValue: true,
    },
    {
      id: "dotSize",
      label: "Dot Size",
      type: "slider",
      defaultValue: 8,
      min: 4,
      max: 18,
      step: 1,
    },
    {
      id: "dotColor",
      label: "Dot Color",
      type: "color",
      defaultValue: "#0ea5e9",
    },
    {
      id: "accuracyOpacity",
      label: "Accuracy Opacity",
      type: "slider",
      defaultValue: 0.18,
      min: 0,
      max: 0.5,
      step: 0.02,
    },
  ],

  setup(map: Map, controls: Record<string, unknown>) {
    currentControls = controls;
    createStatusPanel();

    ensureSources(map);
    ensureLayers(map, controls);

    applyStyles(map, controls);
    applyVisibility(map, controls);

    updateTracking(map, controls);
  },

  cleanup(map: Map) {
    stopTracking();
    clearData(map);

    if (map.getLayer(LOCATION_LAYER_ID)) map.removeLayer(LOCATION_LAYER_ID);
    if (map.getLayer(ACCURACY_LINE_LAYER_ID))
      map.removeLayer(ACCURACY_LINE_LAYER_ID);
    if (map.getLayer(ACCURACY_FILL_LAYER_ID))
      map.removeLayer(ACCURACY_FILL_LAYER_ID);

    if (map.getSource(LOCATION_SOURCE_ID)) map.removeSource(LOCATION_SOURCE_ID);
    if (map.getSource(ACCURACY_SOURCE_ID)) map.removeSource(ACCURACY_SOURCE_ID);

    if (statusPanel?.parentNode) {
      statusPanel.parentNode.removeChild(statusPanel);
      statusPanel = null;
    }

    lastTracking = null;
    hasFix = false;
    lastFollowMs = 0;
    currentControls = {};
  },

  update(map: Map, controls: Record<string, unknown>) {
    if (!map.getLayer(LOCATION_LAYER_ID)) return;

    currentControls = controls;
    applyStyles(map, controls);
    applyVisibility(map, controls);
    updateTracking(map, controls);
  },

  snippet: `// Geolocation Pattern
// Request a location fix, then draw a dot + accuracy circle.

navigator.geolocation.getCurrentPosition((pos) => {
  const { longitude, latitude, accuracy } = pos.coords;

  map.getSource('geolocation-location').setData({
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: [longitude, latitude] }
    }]
  });

  const accuracyKm = accuracy / 1000;
  const circle = turf.circle([longitude, latitude], accuracyKm, { steps: 64 });

  map.getSource('geolocation-accuracy').setData(circle);
});`,
};

function updateTracking(map: Map, controls: Record<string, unknown>) {
  const tracking = controls.tracking as "off" | "once" | "follow";
  if (tracking === lastTracking) return;

  lastTracking = tracking;

  if (tracking === "off") {
    stopTracking();
    clearData(map);
    hasFix = false;
    updateStatus("Tracking is off. Switch to Once/Follow to request location.");
    return;
  }

  if (!("geolocation" in navigator)) {
    updateStatus("Geolocation is not supported in this browser.");
    return;
  }

  stopTracking();

  const handlePosition = (pos: GeolocationPosition) => {
    const coord: [number, number] = [pos.coords.longitude, pos.coords.latitude];
    const accuracyM = pos.coords.accuracy;

    setPoint(map, coord);
    setAccuracy(map, coord, accuracyM);

    hasFix = true;
    applyVisibility(map, currentControls);
    updateStatus(`Accuracy ±${Math.round(accuracyM)} m`);

    if (tracking === "follow") {
      const now = Date.now();
      if (now - lastFollowMs > 700) {
        lastFollowMs = now;
        map.easeTo({
          center: coord,
          duration: 650,
          essential: true,
        });
      }
    } else if (tracking === "once") {
      map.flyTo({
        center: coord,
        zoom: Math.max(map.getZoom(), 14),
        duration: 1200,
        essential: true,
      });
    }
  };

  const handleError = (err: GeolocationPositionError) => {
    const msg =
      err.code === err.PERMISSION_DENIED
        ? "Permission denied. Allow location access and try again."
        : err.code === err.POSITION_UNAVAILABLE
          ? "Position unavailable."
          : "Location timed out.";
    updateStatus(msg);
  };

  updateStatus("Requesting location…");

  const options: PositionOptions = {
    enableHighAccuracy: true,
    maximumAge: 5_000,
    timeout: 10_000,
  };

  if (tracking === "once") {
    navigator.geolocation.getCurrentPosition(handlePosition, handleError, options);
    return;
  }

  watchId = navigator.geolocation.watchPosition(handlePosition, handleError, {
    ...options,
    timeout: 20_000,
  });
}

function stopTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

function ensureSources(map: Map) {
  if (!map.getSource(LOCATION_SOURCE_ID)) {
    map.addSource(LOCATION_SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }

  if (!map.getSource(ACCURACY_SOURCE_ID)) {
    map.addSource(ACCURACY_SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
}

function ensureLayers(map: Map, controls: Record<string, unknown>) {
  if (!map.getLayer(ACCURACY_FILL_LAYER_ID)) {
    map.addLayer(
      {
        id: ACCURACY_FILL_LAYER_ID,
        type: "fill",
        source: ACCURACY_SOURCE_ID,
        paint: {
          "fill-color": controls.dotColor as string,
          "fill-opacity": controls.accuracyOpacity as number,
        },
      },
      findFirstSymbolLayer(map),
    );
  }

  if (!map.getLayer(ACCURACY_LINE_LAYER_ID)) {
    map.addLayer(
      {
        id: ACCURACY_LINE_LAYER_ID,
        type: "line",
        source: ACCURACY_SOURCE_ID,
        paint: {
          "line-color": controls.dotColor as string,
          "line-opacity": 0.65,
          "line-width": 2,
        },
      },
      findFirstSymbolLayer(map),
    );
  }

  if (!map.getLayer(LOCATION_LAYER_ID)) {
    map.addLayer({
      id: LOCATION_LAYER_ID,
      type: "circle",
      source: LOCATION_SOURCE_ID,
      paint: {
        "circle-radius": controls.dotSize as number,
        "circle-color": controls.dotColor as string,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    });
  }
}

function applyStyles(map: Map, controls: Record<string, unknown>) {
  map.setPaintProperty(LOCATION_LAYER_ID, "circle-radius", controls.dotSize as number);
  map.setPaintProperty(LOCATION_LAYER_ID, "circle-color", controls.dotColor as string);

  if (map.getLayer(ACCURACY_FILL_LAYER_ID)) {
    map.setPaintProperty(
      ACCURACY_FILL_LAYER_ID,
      "fill-color",
      controls.dotColor as string,
    );
    map.setPaintProperty(
      ACCURACY_FILL_LAYER_ID,
      "fill-opacity",
      controls.accuracyOpacity as number,
    );
  }

  if (map.getLayer(ACCURACY_LINE_LAYER_ID)) {
    map.setPaintProperty(
      ACCURACY_LINE_LAYER_ID,
      "line-color",
      controls.dotColor as string,
    );
  }
}

function applyVisibility(map: Map, controls: Record<string, unknown>) {
  const showAccuracy = (controls.showAccuracy as boolean) && hasFix;

  if (map.getLayer(ACCURACY_FILL_LAYER_ID)) {
    map.setLayoutProperty(
      ACCURACY_FILL_LAYER_ID,
      "visibility",
      showAccuracy ? "visible" : "none",
    );
  }
  if (map.getLayer(ACCURACY_LINE_LAYER_ID)) {
    map.setLayoutProperty(
      ACCURACY_LINE_LAYER_ID,
      "visibility",
      showAccuracy ? "visible" : "none",
    );
  }
}

function setPoint(map: Map, coord: [number, number]) {
  const source = map.getSource(LOCATION_SOURCE_ID) as GeoJSONSource | undefined;
  source?.setData({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: coord },
      },
    ],
  });
}

function setAccuracy(map: Map, coord: [number, number], accuracyM: number) {
  const source = map.getSource(ACCURACY_SOURCE_ID) as GeoJSONSource | undefined;
  if (!source) return;

  const km = Math.max(accuracyM, 0) / 1000;
  const circle = turf.circle(coord, km, { steps: 64 });
  source.setData(circle);
}

function clearData(map: Map) {
  const locationSource = map.getSource(LOCATION_SOURCE_ID) as
    | GeoJSONSource
    | undefined;
  locationSource?.setData({ type: "FeatureCollection", features: [] });

  const accuracySource = map.getSource(ACCURACY_SOURCE_ID) as
    | GeoJSONSource
    | undefined;
  accuracySource?.setData({ type: "FeatureCollection", features: [] });
}

function createStatusPanel() {
  if (statusPanel) return;

  statusPanel = document.createElement("div");
  statusPanel.className = "panel";
  statusPanel.style.cssText = `
    position: absolute;
    bottom: 24px;
    right: 16px;
    z-index: 10;
    padding: 12px 16px;
    font-size: 13px;
  `;
  document.body.appendChild(statusPanel);
}

function updateStatus(message: string) {
  if (!statusPanel) return;
  statusPanel.textContent = message;
  statusPanel.style.display = message ? "block" : "none";
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
