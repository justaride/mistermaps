import type { GeoJSONSource, Map, MapMouseEvent } from "mapbox-gl";
import * as turf from "@turf/turf";
import type { ControlValues, Pattern } from "../../types";
import {
  copyText,
  downloadText,
  formatTimestampForFilename,
} from "../utils/export";
import { geojsonToGpx, geojsonToKml } from "../utils/geojson-formats";

const SOURCE_ID = "area-measurement-source";
const FILL_LAYER_ID = "area-measurement-fill";
const LINE_LAYER_ID = "area-measurement-outline";
const POINTS_LAYER_ID = "area-measurement-vertices";
const LABEL_LAYER_ID = "area-measurement-label";

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

export const areaMeasurementPattern: Pattern = {
  id: "area-measurement",
  name: "Area Measurement",
  category: "navigation",
  description:
    "Draw a polygon to measure area. Click to add vertices, double-click to finish. Esc clears.",
  controls: [
    {
      id: "unit",
      label: "Unit",
      type: "select",
      defaultValue: "ha",
      options: [
        { label: "Square meters (m²)", value: "m2" },
        { label: "Hectares (ha)", value: "ha" },
        { label: "Square kilometers (km²)", value: "km2" },
        { label: "Acres (ac)", value: "acres" },
        { label: "Square miles (mi²)", value: "sqmi" },
      ],
    },
    {
      id: "fillColor",
      label: "Fill Color",
      type: "color",
      defaultValue: "#a855f7",
    },
    {
      id: "fillOpacity",
      label: "Fill Opacity",
      type: "slider",
      defaultValue: 0.22,
      min: 0,
      max: 0.7,
      step: 0.02,
    },
    {
      id: "outlineColor",
      label: "Outline Color",
      type: "color",
      defaultValue: "#7c3aed",
    },
    {
      id: "lineWidth",
      label: "Line Width",
      type: "slider",
      defaultValue: 3,
      min: 1,
      max: 8,
      step: 1,
    },
    {
      id: "showVertices",
      label: "Vertices",
      type: "toggle",
      defaultValue: true,
    },
    {
      id: "vertexSize",
      label: "Vertex Size",
      type: "slider",
      defaultValue: 6,
      min: 3,
      max: 12,
      step: 1,
    },
  ],

  setup(map: Map, controls: ControlValues) {
    currentControls = controls;
    points = [];
    hoverCoord = null;
    isFinished = false;

    createStatusPanel(map);
    updateStatus("Click to add vertices. Double-click to finish. Esc clears.");

    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });

    map.addLayer({
      id: FILL_LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      filter: ["in", "$type", "Polygon", "MultiPolygon"],
      paint: {
        "fill-color": controls.fillColor as string,
        "fill-opacity": controls.fillOpacity as number,
      },
    });

    map.addLayer({
      id: LINE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      filter: ["==", "$type", "LineString"],
      paint: {
        "line-color": controls.outlineColor as string,
        "line-width": controls.lineWidth as number,
        "line-dasharray": [2, 1],
      },
    });

    map.addLayer({
      id: POINTS_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      filter: ["==", "$type", "Point"],
      paint: {
        "circle-radius": controls.vertexSize as number,
        "circle-color": controls.outlineColor as string,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff",
      },
      layout: {
        visibility: controls.showVertices ? "visible" : "none",
      },
    });

    map.addLayer({
      id: LABEL_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      filter: ["has", "areaLabel"],
      layout: {
        "text-field": ["get", "areaLabel"],
        "text-size": 14,
        "text-offset": [0, -1.4],
        "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
      },
      paint: {
        "text-color": "#111827",
        "text-halo-color": "#ffffff",
        "text-halo-width": 2,
      },
    });

    clickHandler = (e) => {
      if (isFinished) {
        points = [];
        hoverCoord = null;
        isFinished = false;
        updateStatus(
          "New polygon. Click to add vertices. Double-click to finish. Esc clears.",
        );
      }

      points.push([e.lngLat.lng, e.lngLat.lat]);
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
      if (isFinished || points.length < 3) return;
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
        updateStatus("Cleared. Click to add vertices.");
        return;
      }

      if (e.key === "Enter") {
        if (!isFinished && points.length >= 3) {
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
    if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID);
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

    map.setPaintProperty(FILL_LAYER_ID, "fill-color", controls.fillColor as string);
    map.setPaintProperty(
      FILL_LAYER_ID,
      "fill-opacity",
      controls.fillOpacity as number,
    );
    map.setPaintProperty(
      LINE_LAYER_ID,
      "line-color",
      controls.outlineColor as string,
    );
    map.setPaintProperty(LINE_LAYER_ID, "line-width", controls.lineWidth as number);
    map.setPaintProperty(
      POINTS_LAYER_ID,
      "circle-color",
      controls.outlineColor as string,
    );
    map.setPaintProperty(
      POINTS_LAYER_ID,
      "circle-radius",
      controls.vertexSize as number,
    );
    map.setLayoutProperty(
      POINTS_LAYER_ID,
      "visibility",
      controls.showVertices ? "visible" : "none",
    );

    updateGeometry(map);
  },

  snippet: `// Area Measurement Pattern
// Click to add vertices. Double-click to finish.
import * as turf from '@turf/turf';

const points = [];

map.on('click', (e) => {
  points.push([e.lngLat.lng, e.lngLat.lat]);
  update();
});

function update() {
  if (points.length < 3) return;
  const ring = [...points, points[0]];
  const polygon = turf.polygon([ring]);
  const areaM2 = turf.area(polygon);

  map.getSource('area-source').setData({
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', geometry: polygon.geometry, properties: {} }
    ]
  });
}`,
};

function requestUpdate(map: Map) {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    updateGeometry(map);
  });
}

function updateGeometry(map: Map) {
  const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
  if (!source) return;

  const features: GeoJSON.Feature[] = [];

  for (const coord of points) {
    features.push({
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: coord },
    });
  }

  const lineCoords = getLineCoords();
  if (lineCoords.length >= 2) {
    features.push({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: lineCoords },
    });
  }

  const polygon = getPolygon();
  let areaLabel = "";
  if (polygon) {
    features.push({
      type: "Feature",
      properties: {},
      geometry: polygon.geometry,
    });

    const areaM2 = turf.area(polygon);
    areaLabel = formatArea(areaM2, (currentControls.unit as string) || "ha");

    const labelPoint = turf.centerOfMass(polygon);
    features.push({
      type: "Feature",
      properties: { areaLabel },
      geometry: labelPoint.geometry,
    });
  }

  source.setData({ type: "FeatureCollection", features });
  syncExportActions();

  if (map.getLayer(LINE_LAYER_ID)) {
    map.setPaintProperty(
      LINE_LAYER_ID,
      "line-dasharray",
      isFinished ? [1, 0] : [2, 1],
    );
  }

  if (statusPanel) {
    if (points.length === 0) {
      updateStatus("Click to add vertices. Double-click to finish. Esc clears.");
    } else if (points.length < 3) {
      updateStatus(
        `Vertices: ${points.length}. Keep clicking to create a polygon.`,
      );
    } else if (isFinished) {
      updateStatus(areaLabel ? `Area: ${areaLabel}` : "Area ready.");
    } else {
      updateStatus(
        areaLabel
          ? `Area: ${areaLabel} (double-click to finish)`
          : "Double-click to finish.",
      );
    }
  }
}

function getLineCoords(): [number, number][] {
  if (points.length === 0) return [];
  if (isFinished) return [...points, points[0]];
  return hoverCoord ? [...points, hoverCoord] : points;
}

function getPolygon() {
  if (points.length < 3) return null;
  const ring = [...points, points[0]];
  return turf.polygon([ring]);
}

function formatArea(areaM2: number, unit: string): string {
  const conv =
    unit === "km2"
      ? { value: areaM2 / 1_000_000, suffix: "km²" }
      : unit === "m2"
        ? { value: areaM2, suffix: "m²" }
        : unit === "acres"
          ? { value: areaM2 / 4046.8564224, suffix: "ac" }
          : unit === "sqmi"
            ? { value: areaM2 / 2_589_988.110336, suffix: "mi²" }
            : { value: areaM2 / 10_000, suffix: "ha" };

  const abs = Math.abs(conv.value);
  const decimals = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return `${conv.value.toFixed(decimals)} ${conv.suffix}`;
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
    updateGeometry(map);
  }, 1200);
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
  const canExport = points.length >= 3;
  actionsRow.style.display = canExport ? "flex" : "none";
  copyButton.disabled = !canExport;
  downloadGeoJsonButton.disabled = !canExport;
  downloadKmlButton.disabled = !canExport;
  downloadGpxButton.disabled = !canExport;
}

function getExportGeoJson(): GeoJSON.FeatureCollection | null {
  if (points.length < 3) return null;
  const polygon = getPolygon();
  if (!polygon) return null;

  const areaM2 = turf.area(polygon);
  const unit = (currentControls.unit as string) || "ha";
  const areaLabel = formatArea(areaM2, unit);

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          area_m2: areaM2,
          area: areaLabel,
          unit,
          vertex_count: points.length,
          finished: isFinished,
          generated_at: new Date().toISOString(),
        },
        geometry: polygon.geometry,
      },
    ],
  };
}

async function handleCopy(map: Map) {
  const geoJson = getExportGeoJson();
  if (!geoJson) {
    flashStatus(map, "Add at least 3 vertices to export GeoJSON.");
    return;
  }

  const text = JSON.stringify(geoJson, null, 2);
  const ok = await copyText(text);
  flashStatus(map, ok ? "Copied GeoJSON to clipboard." : "Copy failed.");
}

function handleDownload(map: Map, format: "geojson" | "kml" | "gpx") {
  const geoJson = getExportGeoJson();
  if (!geoJson) {
    flashStatus(map, "Add at least 3 vertices to export.");
    return;
  }

  const stamp = formatTimestampForFilename();
  if (format === "geojson") {
    downloadText(
      `area-measurement-${stamp}.geojson`,
      JSON.stringify(geoJson, null, 2),
      "application/geo+json",
    );
    flashStatus(map, "Downloaded GeoJSON.");
    return;
  }

  if (format === "kml") {
    downloadText(
      `area-measurement-${stamp}.kml`,
      geojsonToKml(geoJson, { name: "Area Measurement" }),
      "application/vnd.google-earth.kml+xml",
    );
    flashStatus(map, "Downloaded KML.");
    return;
  }

  downloadText(
    `area-measurement-${stamp}.gpx`,
    geojsonToGpx(geoJson, { name: "Area Measurement" }),
    "application/gpx+xml",
  );
  flashStatus(map, "Downloaded GPX.");
}
