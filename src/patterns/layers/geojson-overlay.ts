import type { GeoJSONSource, Map } from "mapbox-gl";
import * as turf from "@turf/turf";
import type { Pattern } from "../../types";
import {
  copyText,
  downloadText,
  formatTimestampForFilename,
} from "../utils/export";
import { geojsonToGpx, geojsonToKml } from "../utils/geojson-formats";

const SOURCE_ID = "geojson-source";
const FILL_LAYER_ID = "geojson-fill";
const LINE_LAYER_ID = "geojson-line";
const POINTS_LAYER_ID = "geojson-points";
const STORAGE_KEY = "mister-maps:geojson-overlay:geojson:v1";

let currentGeoJson: GeoJSON.FeatureCollection | null = null;

let panel: HTMLDivElement | null = null;
let panelBody: HTMLDivElement | null = null;
let panelMessage: HTMLDivElement | null = null;
let textarea: HTMLTextAreaElement | null = null;
let fileInput: HTMLInputElement | null = null;
let collapsed = false;
let exportFormat: "geojson" | "kml" | "gpx" = "geojson";
let exportFormatSelect: HTMLSelectElement | null = null;

let loadButton: HTMLButtonElement | null = null;
let sampleButton: HTMLButtonElement | null = null;
let fitButton: HTMLButtonElement | null = null;
let clearButton: HTMLButtonElement | null = null;
let copyButton: HTMLButtonElement | null = null;
let downloadButton: HTMLButtonElement | null = null;

export const geojsonOverlayPattern: Pattern = {
  id: "geojson-overlay",
  name: "GeoJSON Overlay",
  category: "layers",
  description:
    "Paste or upload GeoJSON and render it with customizable fill, stroke, and point styling.",
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
    {
      id: "showPoints",
      label: "Show Points",
      type: "toggle",
      defaultValue: true,
    },
    {
      id: "pointSize",
      label: "Point Size",
      type: "slider",
      defaultValue: 6,
      min: 2,
      max: 16,
      step: 1,
    },
  ],

  setup(map: Map, controls: Record<string, unknown>) {
    const persisted = currentGeoJson ?? loadPersistedGeoJson();
    const geojson = persisted ?? createSampleGeoJSON();
    currentGeoJson = geojson;

    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: geojson,
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
      paint: {
        "line-color": controls.strokeColor as string,
        "line-width": controls.strokeWidth as number,
      },
    });

    map.addLayer({
      id: POINTS_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      filter: ["in", "$type", "Point", "MultiPoint"],
      layout: {
        visibility: controls.showPoints ? "visible" : "none",
      },
      paint: {
        "circle-radius": controls.pointSize as number,
        "circle-color": controls.strokeColor as string,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    });

    createPanel(map);
    syncTextareaFromCurrent();

    if (persisted) {
      setMessage(`${describeGeoJson(geojson)} Restored from local storage.`);
    }

    fitToGeoJson(map, geojson);
  },

  cleanup(map: Map) {
    if (panel?.parentNode) {
      panel.parentNode.removeChild(panel);
    }
    panel = null;
    panelBody = null;
    panelMessage = null;
    textarea = null;
    fileInput = null;
    collapsed = false;
    exportFormat = "geojson";
    exportFormatSelect = null;
    loadButton = null;
    sampleButton = null;
    fitButton = null;
    clearButton = null;
    copyButton = null;
    downloadButton = null;

    if (map.getLayer(POINTS_LAYER_ID)) map.removeLayer(POINTS_LAYER_ID);
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

    if (map.getLayer(POINTS_LAYER_ID)) {
      map.setLayoutProperty(
        POINTS_LAYER_ID,
        "visibility",
        controls.showPoints ? "visible" : "none",
      );
      map.setPaintProperty(
        POINTS_LAYER_ID,
        "circle-radius",
        controls.pointSize as number,
      );
      map.setPaintProperty(
        POINTS_LAYER_ID,
        "circle-color",
        controls.strokeColor as string,
      );
    }
  },

  snippet: `// GeoJSON Overlay Pattern
// Load GeoJSON from URL, file upload, or pasted JSON
const geojsonData = await fetch('/data/regions.geojson').then((r) => r.json());

map.addSource('geojson-source', {
  type: 'geojson',
  data: geojsonData
});

// Fill layer for polygons
map.addLayer({
  id: 'geojson-fill',
  type: 'fill',
  source: 'geojson-source',
  filter: ['in', '$type', 'Polygon', 'MultiPolygon'],
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

// Optional: points
map.addLayer({
  id: 'geojson-points',
  type: 'circle',
  source: 'geojson-source',
  filter: ['in', '$type', 'Point', 'MultiPoint'],
  paint: { 'circle-radius': 6, 'circle-color': '#1d4ed8' }
});

// Fit map to GeoJSON bounds
const [minX, minY, maxX, maxY] = turf.bbox(geojsonData);
map.fitBounds([[minX, minY], [maxX, maxY]], { padding: 40 });`,
};

function createSampleGeoJSON(): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "Bergset Area" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [10.95, 61.8],
              [11.1, 61.8],
              [11.1, 61.88],
              [10.95, 61.88],
              [10.95, 61.8],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: { name: "Forest Zone" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [11.1, 61.75],
              [11.25, 61.75],
              [11.25, 61.85],
              [11.1, 61.85],
              [11.1, 61.75],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: { name: "Trail Route" },
        geometry: {
          type: "LineString",
          coordinates: [
            [10.98, 61.82],
            [11.05, 61.84],
            [11.15, 61.8],
          ],
        },
      },
      {
        type: "Feature",
        properties: { name: "Mountain Area" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [10.85, 61.88],
              [11.0, 61.88],
              [11.0, 61.95],
              [10.85, 61.95],
              [10.85, 61.88],
            ],
          ],
        },
      },
    ],
  };
}

function createPanel(map: Map) {
  if (panel) return;

  panel = document.createElement("div");
  panel.className = "panel";
  panel.style.cssText = `
    position: absolute;
    top: 100px;
    right: 16px;
    z-index: 10;
    padding: 14px 16px;
    width: 340px;
    max-height: calc(100vh - 160px);
    overflow: auto;
  `;

  const header = document.createElement("div");
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  `;

  const title = document.createElement("div");
  title.textContent = "GeoJSON Import";
  title.style.cssText = `
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-primary);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Liberation Mono", "Courier New", monospace;
  `;

  const collapseButton = document.createElement("button");
  collapseButton.type = "button";
  collapseButton.className = "status-panel__button";
  collapseButton.textContent = "–";
  collapseButton.addEventListener("click", () => {
    collapsed = !collapsed;
    syncCollapsed(collapseButton);
  });

  header.append(title, collapseButton);

  panelBody = document.createElement("div");
  panelBody.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 10px;
  `;

  panelMessage = document.createElement("div");
  panelMessage.className = "status-panel__message";
  panelMessage.textContent =
    "Paste GeoJSON (FeatureCollection/Feature/Geometry) or upload a .geojson file. Loaded data is saved locally in your browser.";

  fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept =
    ".geojson,.json,application/json,application/geo+json,.txt";
  fileInput.className = "geojson-import__file";
  fileInput.addEventListener("change", () => {
    const file = fileInput?.files?.[0];
    if (!file) return;
    void handleFile(map, file);
  });

  textarea = document.createElement("textarea");
  textarea.className = "geojson-import__textarea";
  textarea.spellcheck = false;
  textarea.rows = 10;
  textarea.placeholder =
    '{ "type": "FeatureCollection", "features": [ ... ] }';

  const rowA = document.createElement("div");
  rowA.className = "status-panel__actions";

  loadButton = document.createElement("button");
  loadButton.type = "button";
  loadButton.className = "status-panel__button primary";
  loadButton.textContent = "Load pasted";
  loadButton.addEventListener("click", () => {
    handleLoadPasted(map);
  });

  sampleButton = document.createElement("button");
  sampleButton.type = "button";
  sampleButton.className = "status-panel__button";
  sampleButton.textContent = "Sample";
  sampleButton.addEventListener("click", () => {
    const sample = createSampleGeoJSON();
    applyGeoJson(map, sample, { fit: true, message: "Loaded sample GeoJSON." });
  });

  fitButton = document.createElement("button");
  fitButton.type = "button";
  fitButton.className = "status-panel__button";
  fitButton.textContent = "Fit";
  fitButton.addEventListener("click", () => {
    if (currentGeoJson) fitToGeoJson(map, currentGeoJson);
  });

  clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.className = "status-panel__button";
  clearButton.textContent = "Clear";
  clearButton.addEventListener("click", () => {
    applyGeoJson(
      map,
      { type: "FeatureCollection", features: [] },
      { fit: false, message: "Cleared GeoJSON overlay." },
    );
  });

  rowA.append(loadButton, sampleButton, fitButton, clearButton);

  const exportLabel = document.createElement("label");
  exportLabel.textContent = "Export format";

  exportFormatSelect = document.createElement("select");
  exportFormatSelect.style.fontSize = "12px";
  exportFormatSelect.append(
    new Option("GeoJSON", "geojson"),
    new Option("KML", "kml"),
    new Option("GPX", "gpx"),
  );
  exportFormatSelect.value = exportFormat;
  exportFormatSelect.addEventListener("change", () => {
    exportFormat = (exportFormatSelect?.value as "geojson" | "kml" | "gpx") || "geojson";
    syncExportButtons();
  });

  const rowB = document.createElement("div");
  rowB.className = "status-panel__actions";

  copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "status-panel__button primary";
  copyButton.textContent = "Copy GeoJSON";
  copyButton.addEventListener("click", () => {
    void handleCopyCurrent();
  });

  downloadButton = document.createElement("button");
  downloadButton.type = "button";
  downloadButton.className = "status-panel__button";
  downloadButton.textContent = "Download GeoJSON";
  downloadButton.addEventListener("click", () => {
    handleDownloadCurrent();
  });

  rowB.append(copyButton, downloadButton);

  panelBody.append(
    panelMessage,
    fileInput,
    textarea,
    rowA,
    exportLabel,
    exportFormatSelect,
    rowB,
  );
  panel.append(header, panelBody);
  document.body.appendChild(panel);

  syncCollapsed(collapseButton);
  syncExportButtons();
}

function syncCollapsed(collapseButton: HTMLButtonElement) {
  if (!panelBody) return;
  panelBody.style.display = collapsed ? "none" : "block";
  collapseButton.textContent = collapsed ? "+" : "–";
}

function setMessage(text: string) {
  if (!panelMessage) return;
  panelMessage.textContent = text;
}

function syncTextareaFromCurrent() {
  if (!textarea || !currentGeoJson) return;
  try {
    textarea.value = JSON.stringify(currentGeoJson, null, 2);
  } catch {
    // ignore
  }
}

function syncExportButtons() {
  if (!copyButton || !downloadButton) return;
  const label = exportFormat === "geojson" ? "GeoJSON" : exportFormat.toUpperCase();
  copyButton.textContent = `Copy ${label}`;
  downloadButton.textContent = `Download ${label}`;
}

function handleLoadPasted(map: Map) {
  const text = textarea?.value?.trim() || "";
  if (!text) {
    setMessage("Paste GeoJSON JSON into the textarea first.");
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    setMessage("Invalid JSON. Check for trailing commas and quotes.");
    return;
  }

  const normalized = normalizeGeoJson(parsed);
  if (!normalized) {
    setMessage("Not valid GeoJSON. Expected FeatureCollection/Feature/Geometry.");
    return;
  }

  applyGeoJson(map, normalized, { fit: true, message: describeGeoJson(normalized) });
}

async function handleFile(map: Map, file: File) {
  try {
    const text = await file.text();
    if (textarea) textarea.value = text;
    handleLoadPasted(map);
  } catch {
    setMessage("Failed to read file.");
  }
}

function applyGeoJson(
  map: Map,
  geojson: GeoJSON.FeatureCollection,
  opts: { fit: boolean; message?: string },
) {
  currentGeoJson = geojson;

  const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
  source?.setData(geojson);

  syncTextareaFromCurrent();

  if (opts.fit) {
    fitToGeoJson(map, geojson);
  }

  const storageResult = persistGeoJson(geojson);
  let message = opts.message || describeGeoJson(geojson);
  if (storageResult.ok) {
    message = `${message} Saved locally.`;
  } else {
    message = `${message} Not saved locally. ${storageResult.reason}`;
  }
  setMessage(message);
}

function handleDownloadCurrent() {
  if (!currentGeoJson) {
    setMessage("Nothing to download yet.");
    return;
  }

  const stamp = formatTimestampForFilename();
  if (exportFormat === "geojson") {
    downloadText(
      `geojson-overlay-${stamp}.geojson`,
      JSON.stringify(currentGeoJson, null, 2),
      "application/geo+json",
    );
    setMessage("Downloaded GeoJSON.");
    return;
  }

  if (exportFormat === "kml") {
    downloadText(
      `geojson-overlay-${stamp}.kml`,
      geojsonToKml(currentGeoJson, { name: "GeoJSON Overlay" }),
      "application/vnd.google-earth.kml+xml",
    );
    setMessage("Downloaded KML.");
    return;
  }

  downloadText(
    `geojson-overlay-${stamp}.gpx`,
    geojsonToGpx(currentGeoJson, { name: "GeoJSON Overlay" }),
    "application/gpx+xml",
  );
  setMessage("Downloaded GPX.");
}

async function handleCopyCurrent() {
  if (!currentGeoJson) {
    setMessage("Nothing to copy yet.");
    return;
  }

  let text = "";
  let label = "";

  if (exportFormat === "geojson") {
    text = JSON.stringify(currentGeoJson, null, 2);
    label = "GeoJSON";
  } else if (exportFormat === "kml") {
    text = geojsonToKml(currentGeoJson, { name: "GeoJSON Overlay" });
    label = "KML";
  } else {
    text = geojsonToGpx(currentGeoJson, { name: "GeoJSON Overlay" });
    label = "GPX";
  }

  const ok = await copyText(text);
  setMessage(ok ? `Copied ${label} to clipboard.` : "Copy failed.");
}

function describeGeoJson(geojson: GeoJSON.FeatureCollection) {
  const count = geojson.features?.length ?? 0;
  return `Loaded GeoJSON. Features: ${count}.`;
}

function normalizeGeoJson(value: unknown): GeoJSON.FeatureCollection | null {
  if (!value || typeof value !== "object") return null;

  const v = value as { type?: unknown; features?: unknown; geometry?: unknown };
  if (v.type === "FeatureCollection" && Array.isArray(v.features)) {
    return value as GeoJSON.FeatureCollection;
  }

  if (v.type === "Feature" && v.geometry) {
    return { type: "FeatureCollection", features: [value as GeoJSON.Feature] };
  }

  const geom = value as { type?: unknown; coordinates?: unknown; geometries?: unknown };
  if (typeof geom.type === "string" && ("coordinates" in geom || "geometries" in geom)) {
    const feature: GeoJSON.Feature = {
      type: "Feature",
      properties: {},
      geometry: value as GeoJSON.Geometry,
    };
    return { type: "FeatureCollection", features: [feature] };
  }

  return null;
}

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function loadPersistedGeoJson(): GeoJSON.FeatureCollection | null {
  const storage = getStorage();
  if (!storage) return null;

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const normalized = normalizeGeoJson(parsed);
    if (!normalized) {
      storage.removeItem(STORAGE_KEY);
      return null;
    }
    return normalized;
  } catch {
    storage.removeItem(STORAGE_KEY);
    return null;
  }
}

function persistGeoJson(
  geojson: GeoJSON.FeatureCollection,
): { ok: true } | { ok: false; reason: string } {
  const storage = getStorage();
  if (!storage) return { ok: false, reason: "Local storage unavailable." };

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(geojson));
    return { ok: true };
  } catch {
    return { ok: false, reason: "Couldn’t save (storage quota?)." };
  }
}

function fitToGeoJson(map: Map, geojson: GeoJSON.FeatureCollection) {
  if (!geojson.features || geojson.features.length === 0) return;

  try {
    const [minX, minY, maxX, maxY] = turf.bbox(geojson);
    if (![minX, minY, maxX, maxY].every((n) => Number.isFinite(n))) return;

    if (minX === maxX && minY === maxY) {
      map.flyTo({
        center: [minX, minY],
        zoom: Math.max(map.getZoom(), 14),
        duration: 900,
      });
      return;
    }

    map.fitBounds(
      [
        [minX, minY],
        [maxX, maxY],
      ],
      { padding: 60, duration: 900 },
    );
  } catch {
    // ignore
  }
}
