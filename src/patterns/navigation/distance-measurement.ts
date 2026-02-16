import type { Map, MapMouseEvent, GeoJSONSource } from "mapbox-gl";
import * as turf from "@turf/turf";
import type { ControlValues, Pattern } from "../../types";
import {
  copyText,
  downloadText,
  formatTimestampForFilename,
} from "../utils/export";
import { geojsonToGpx, geojsonToKml } from "../utils/geojson-formats";

const SOURCE_ID = "measurement-source";
const LINE_LAYER_ID = "measurement-line";
const POINTS_LAYER_ID = "measurement-points";
const LABEL_LAYER_ID = "measurement-label";

let points: [number, number][] = [];
let hoverCoord: [number, number] | null = null;
let isFinished = false;
let currentControls: ControlValues = {};

let clickHandler: ((e: MapMouseEvent) => void) | null = null;
let moveHandler: ((e: MapMouseEvent) => void) | null = null;
let dblClickHandler: ((e: MapMouseEvent) => void) | null = null;
let keyHandler: ((e: KeyboardEvent) => void) | null = null;
let rafPending = false;

let statusPanel: HTMLDivElement | null = null;
let statusMessage: HTMLDivElement | null = null;
let actionsRow: HTMLDivElement | null = null;
let copyButton: HTMLButtonElement | null = null;
let downloadGeoJsonButton: HTMLButtonElement | null = null;
let downloadKmlButton: HTMLButtonElement | null = null;
let downloadGpxButton: HTMLButtonElement | null = null;
let flashTimeout: number | null = null;

export const distanceMeasurementPattern: Pattern = {
  id: "distance-measurement",
  name: "Distance Measurement",
  category: "navigation",
  description:
    "Measure distance along a line. Click to add points, double-click or Enter to finish. Esc clears.",
  controls: [
    {
      id: "lineColor",
      label: "Line Color",
      type: "color",
      defaultValue: "#ef4444",
    },
    {
      id: "unit",
      label: "Unit",
      type: "select",
      defaultValue: "kilometers",
      options: [
        { label: "Kilometers", value: "kilometers" },
        { label: "Miles", value: "miles" },
        { label: "Meters", value: "meters" },
      ],
    },
  ],

  setup(map: Map, controls: ControlValues) {
    points = [];
    hoverCoord = null;
    isFinished = false;
    currentControls = controls;

    createStatusPanel(map);
    updateStatus(
      "Click to add points. Double-click/Enter to finish. Esc clears. Backspace undoes.",
    );

    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });

    map.addLayer({
      id: LINE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      filter: ["==", "$type", "LineString"],
      paint: {
        "line-color": controls.lineColor as string,
        "line-width": 3,
        "line-dasharray": [2, 1],
      },
    });

    map.addLayer({
      id: POINTS_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      filter: ["==", "$type", "Point"],
      paint: {
        "circle-radius": 6,
        "circle-color": controls.lineColor as string,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff",
      },
    });

    map.addLayer({
      id: LABEL_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      filter: ["has", "distance"],
      layout: {
        "text-field": ["get", "distance"],
        "text-size": 14,
        "text-offset": [0, -1.5],
        "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
      },
      paint: {
        "text-color": "#333",
        "text-halo-color": "#fff",
        "text-halo-width": 2,
      },
    });

    clickHandler = (e) => {
      if (isFinished) {
        points = [];
        hoverCoord = null;
        isFinished = false;
      }
      const coord: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      points.push(coord);
      requestUpdate(map);
    };

    map.on("click", clickHandler);

    moveHandler = (e) => {
      if (isFinished || points.length === 0) return;
      hoverCoord = [e.lngLat.lng, e.lngLat.lat];
      requestUpdate(map);
    };
    map.on("mousemove", moveHandler);

    dblClickHandler = () => {
      if (isFinished || points.length < 2) return;
      isFinished = true;
      hoverCoord = null;
      requestUpdate(map);
    };
    map.on("dblclick", dblClickHandler);

    keyHandler = (e) => {
      if (e.key === "Escape") {
        if (points.length === 0 && !isFinished) return;
        points = [];
        hoverCoord = null;
        isFinished = false;
        requestUpdate(map);
        updateStatus("Cleared. Click to add points.");
        return;
      }

      if (e.key === "Enter") {
        if (!isFinished && points.length >= 2) {
          isFinished = true;
          hoverCoord = null;
          requestUpdate(map);
        }
        return;
      }

      if (e.key === "Backspace" || e.key === "Delete") {
        if (isFinished || points.length === 0) return;
        points.pop();
        requestUpdate(map);
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", keyHandler, { passive: false });

    map.doubleClickZoom.disable();
    map.getCanvas().style.cursor = "crosshair";
  },

  cleanup(map: Map) {
    if (flashTimeout !== null) {
      window.clearTimeout(flashTimeout);
      flashTimeout = null;
    }

    if (clickHandler) {
      map.off("click", clickHandler);
      clickHandler = null;
    }
    if (moveHandler) {
      map.off("mousemove", moveHandler);
      moveHandler = null;
    }
    if (dblClickHandler) {
      map.off("dblclick", dblClickHandler);
      dblClickHandler = null;
    }
    if (keyHandler) {
      window.removeEventListener("keydown", keyHandler);
      keyHandler = null;
    }

    map.doubleClickZoom.enable();
    map.getCanvas().style.cursor = "";
    points = [];
    hoverCoord = null;
    isFinished = false;
    currentControls = {};
    rafPending = false;

    if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID);
    if (map.getLayer(POINTS_LAYER_ID)) map.removeLayer(POINTS_LAYER_ID);
    if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);

    if (statusPanel?.parentNode) {
      statusPanel.parentNode.removeChild(statusPanel);
      statusPanel = null;
    }
    statusMessage = null;
    actionsRow = null;
    copyButton = null;
    downloadGeoJsonButton = null;
    downloadKmlButton = null;
    downloadGpxButton = null;
  },

  update(map: Map, controls: ControlValues) {
    if (!map.getLayer(LINE_LAYER_ID)) return;

    currentControls = controls;
    map.setPaintProperty(
      LINE_LAYER_ID,
      "line-color",
      controls.lineColor as string,
    );
    map.setPaintProperty(
      POINTS_LAYER_ID,
      "circle-color",
      controls.lineColor as string,
    );

    requestUpdate(map);
  },

  snippet: `// Distance Measurement Pattern
import * as turf from '@turf/turf';

let points = [];

map.on('click', (e) => {
  points.push([e.lngLat.lng, e.lngLat.lat]);
  updateMeasurement();
});

function updateMeasurement() {
  const features = [];

  // Add point features
  points.forEach(coord => {
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: coord }
    });
  });

  // Add line and calculate distance
  if (points.length > 1) {
    const line = turf.lineString(points);
    const distance = turf.length(line, { units: 'kilometers' });

    features.push({
      type: 'Feature',
      properties: { distance: \`\${distance.toFixed(2)} km\` },
      geometry: line.geometry
    });
  }

  map.getSource('measurement').setData({
    type: 'FeatureCollection',
    features
  });
}`,
};

function requestUpdate(map: Map) {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    updateMeasurement(map);
  });
}

function updateMeasurement(map: Map) {
  const source = map.getSource(SOURCE_ID) as GeoJSONSource;
  if (!source) return;

  const unit = (currentControls.unit as "kilometers" | "miles" | "meters") || "kilometers";
  const features: GeoJSON.Feature[] = [];

  points.forEach((coord, i) => {
    features.push({
      type: "Feature",
      properties: { index: i + 1 },
      geometry: { type: "Point", coordinates: coord },
    });
  });

  const lineCoords = getLineCoords();
  let distanceLabel = "";
  if (lineCoords.length > 1) {
    const line = turf.lineString(lineCoords);
    const distance = turf.length(line, { units: unit });
    distanceLabel = formatDistance(distance, unit);

    features.push({
      type: "Feature",
      properties: {},
      geometry: line.geometry,
    });

    const labelPoint =
      distance > 0
        ? turf.along(line, distance / 2, { units: unit })
        : turf.point(lineCoords[0]);
    features.push({
      type: "Feature",
      properties: { distance: distanceLabel },
      geometry: labelPoint.geometry,
    });
  }

  source.setData({
    type: "FeatureCollection",
    features,
  });

  if (map.getLayer(LINE_LAYER_ID)) {
    map.setPaintProperty(LINE_LAYER_ID, "line-dasharray", isFinished ? [1, 0] : [2, 1]);
  }

  syncExportActions();
  syncStatus(distanceLabel);
}

function getLineCoords(): [number, number][] {
  if (points.length === 0) return [];
  if (isFinished) return points;
  return hoverCoord ? [...points, hoverCoord] : points;
}

function formatDistance(value: number, unit: "kilometers" | "miles" | "meters") {
  const suffix = unit === "kilometers" ? "km" : unit === "miles" ? "mi" : "m";
  const abs = Math.abs(value);
  const decimals = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return `${value.toFixed(decimals)} ${suffix}`;
}

function createStatusPanel(map: Map) {
  if (statusPanel) return;

  statusPanel = document.createElement("div");
  statusPanel.className = "panel status-panel";
  statusPanel.style.cssText = `
    position: absolute;
    bottom: 24px;
    right: 16px;
    z-index: 10;
    padding: 12px 16px;
    font-size: 13px;
  `;

  statusMessage = document.createElement("div");
  statusMessage.className = "status-panel__message";

  actionsRow = document.createElement("div");
  actionsRow.className = "status-panel__actions";

  copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "status-panel__button primary";
  copyButton.textContent = "Copy GeoJSON";
  copyButton.addEventListener("click", () => {
    void handleCopy(map);
  });

  downloadGeoJsonButton = document.createElement("button");
  downloadGeoJsonButton.type = "button";
  downloadGeoJsonButton.className = "status-panel__button";
  downloadGeoJsonButton.textContent = "GeoJSON";
  downloadGeoJsonButton.addEventListener("click", () => {
    handleDownload(map, "geojson");
  });

  downloadKmlButton = document.createElement("button");
  downloadKmlButton.type = "button";
  downloadKmlButton.className = "status-panel__button";
  downloadKmlButton.textContent = "KML";
  downloadKmlButton.addEventListener("click", () => {
    handleDownload(map, "kml");
  });

  downloadGpxButton = document.createElement("button");
  downloadGpxButton.type = "button";
  downloadGpxButton.className = "status-panel__button";
  downloadGpxButton.textContent = "GPX";
  downloadGpxButton.addEventListener("click", () => {
    handleDownload(map, "gpx");
  });

  actionsRow.append(
    copyButton,
    downloadGeoJsonButton,
    downloadKmlButton,
    downloadGpxButton,
  );
  statusPanel.append(statusMessage, actionsRow);
  document.body.appendChild(statusPanel);

  syncExportActions();
}

function updateStatus(message: string) {
  if (!statusPanel || !statusMessage) return;
  statusMessage.textContent = message;
  statusPanel.style.display = message ? "block" : "none";
}

function flashStatus(map: Map, message: string) {
  updateStatus(message);

  if (flashTimeout !== null) {
    window.clearTimeout(flashTimeout);
  }
  flashTimeout = window.setTimeout(() => {
    flashTimeout = null;
    updateMeasurement(map);
  }, 1200);
}

function syncStatus(distanceLabel: string) {
  if (points.length === 0) {
    updateStatus(
      "Click to add points. Double-click/Enter to finish. Esc clears. Backspace undoes.",
    );
    return;
  }

  if (points.length === 1) {
    updateStatus("Add one more point to measure distance.");
    return;
  }

  if (isFinished) {
    updateStatus(distanceLabel ? `Distance: ${distanceLabel} (click to start new)` : "Finished.");
    return;
  }

  updateStatus(
    distanceLabel
      ? `Distance: ${distanceLabel} (double-click/Enter to finish)`
      : "Keep clicking to add points.",
  );
}

function syncExportActions() {
  if (
    !actionsRow ||
    !copyButton ||
    !downloadGeoJsonButton ||
    !downloadKmlButton ||
    !downloadGpxButton
  )
    return;
  const canExport = points.length >= 2;
  actionsRow.style.display = canExport ? "flex" : "none";
  copyButton.disabled = !canExport;
  downloadGeoJsonButton.disabled = !canExport;
  downloadKmlButton.disabled = !canExport;
  downloadGpxButton.disabled = !canExport;
}

function getExportGeoJson(): GeoJSON.FeatureCollection | null {
  if (points.length < 2) return null;

  const unit = (currentControls.unit as "kilometers" | "miles" | "meters") || "kilometers";
  const line = turf.lineString(points);
  const distanceM = turf.length(line, { units: "meters" });
  const distanceUnit = turf.length(line, { units: unit });
  const distanceLabel = formatDistance(distanceUnit, unit);

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          distance_m: distanceM,
          distance: distanceLabel,
          unit,
          vertex_count: points.length,
          finished: isFinished,
          generated_at: new Date().toISOString(),
        },
        geometry: line.geometry,
      },
      ...points.map((coord, i) => ({
        type: "Feature" as const,
        properties: { index: i + 1 },
        geometry: { type: "Point" as const, coordinates: coord },
      })),
    ],
  };
}

async function handleCopy(map: Map) {
  const geoJson = getExportGeoJson();
  if (!geoJson) {
    flashStatus(map, "Add at least 2 points to export GeoJSON.");
    return;
  }

  const ok = await copyText(JSON.stringify(geoJson, null, 2));
  flashStatus(map, ok ? "Copied GeoJSON to clipboard." : "Copy failed.");
}

function handleDownload(map: Map, format: "geojson" | "kml" | "gpx") {
  const geoJson = getExportGeoJson();
  if (!geoJson) {
    flashStatus(map, "Add at least 2 points to export.");
    return;
  }

  const stamp = formatTimestampForFilename();
  if (format === "geojson") {
    downloadText(
      `distance-measurement-${stamp}.geojson`,
      JSON.stringify(geoJson, null, 2),
      "application/geo+json",
    );
    flashStatus(map, "Downloaded GeoJSON.");
    return;
  }

  if (format === "kml") {
    downloadText(
      `distance-measurement-${stamp}.kml`,
      geojsonToKml(geoJson, { name: "Distance Measurement" }),
      "application/vnd.google-earth.kml+xml",
    );
    flashStatus(map, "Downloaded KML.");
    return;
  }

  downloadText(
    `distance-measurement-${stamp}.gpx`,
    geojsonToGpx(geoJson, { name: "Distance Measurement" }),
    "application/gpx+xml",
  );
  flashStatus(map, "Downloaded GPX.");
}
