import type { GeoJSONSource, Map } from "mapbox-gl";
import type { ControlValues, Pattern } from "../../types";

const OVERLAY_SOURCE_ID = "mm-style-loader:overlay";
const OVERLAY_LINE_ID = "mm-style-loader:overlay-line";
const OVERLAY_POINTS_ID = "mm-style-loader:overlay-points";

const STATUS_PANEL_ID = "mm-style-loader:status";

let panelEl: HTMLDivElement | null = null;
let panelMsgEl: HTMLDivElement | null = null;

let activeGen = 0;
let pendingCleanup: (() => void) | null = null;
let lastApplyToken: number | null = null;

function ensurePanel(map: Map) {
  if (panelEl) return;
  const root = map.getContainer();

  const el = document.createElement("div");
  el.id = STATUS_PANEL_ID;
  el.className = "panel status-panel";
  el.style.cssText = [
    "position:absolute",
    "top:16px",
    "left:16px",
    "z-index:12",
    "min-width:280px",
    "max-width:360px",
    "padding:12px 14px",
  ].join(";");

  const title = document.createElement("div");
  title.textContent = "Style Loader";
  title.style.fontWeight = "900";
  title.style.fontSize = "12px";
  title.style.letterSpacing = "0.08em";
  title.style.textTransform = "uppercase";
  title.style.fontFamily = "var(--font-mono)";
  title.style.color = "var(--text-primary)";

  const msg = document.createElement("div");
  msg.className = "status-panel__message";
  msg.style.marginTop = "8px";

  el.appendChild(title);
  el.appendChild(msg);
  root.appendChild(el);

  panelEl = el;
  panelMsgEl = msg;
}

function setPanelMessage(message: string) {
  if (!panelMsgEl) return;
  panelMsgEl.textContent = message;
}

function getCamera(map: Map) {
  const c = map.getCenter();
  return {
    center: [c.lng, c.lat] as [number, number],
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  };
}

function applyCamera(map: Map, camera: ReturnType<typeof getCamera>) {
  map.jumpTo({
    center: camera.center,
    zoom: camera.zoom,
    bearing: camera.bearing,
    pitch: camera.pitch,
  });
}

function overlayData(): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { kind: "line" },
        geometry: {
          type: "LineString",
          coordinates: [
            [11.0, 61.83],
            [11.05, 61.84],
            [11.1, 61.86],
          ],
        },
      },
      {
        type: "Feature",
        properties: { kind: "pin", name: "1" },
        geometry: { type: "Point", coordinates: [11.0, 61.83] },
      },
      {
        type: "Feature",
        properties: { kind: "pin", name: "2" },
        geometry: { type: "Point", coordinates: [11.05, 61.84] },
      },
      {
        type: "Feature",
        properties: { kind: "pin", name: "3" },
        geometry: { type: "Point", coordinates: [11.1, 61.86] },
      },
    ],
  };
}

function removeOverlay(map: Map) {
  if (map.getLayer(OVERLAY_LINE_ID)) map.removeLayer(OVERLAY_LINE_ID);
  if (map.getLayer(OVERLAY_POINTS_ID)) map.removeLayer(OVERLAY_POINTS_ID);
  if (map.getSource(OVERLAY_SOURCE_ID)) map.removeSource(OVERLAY_SOURCE_ID);
}

function ensureOverlay(map: Map, controls: ControlValues) {
  if (!controls.showOverlay) {
    removeOverlay(map);
    return;
  }

  if (!map.getSource(OVERLAY_SOURCE_ID)) {
    map.addSource(OVERLAY_SOURCE_ID, {
      type: "geojson",
      data: overlayData(),
    });
  } else {
    const src = map.getSource(OVERLAY_SOURCE_ID) as GeoJSONSource;
    src.setData(overlayData());
  }

  if (!map.getLayer(OVERLAY_LINE_ID)) {
    map.addLayer({
      id: OVERLAY_LINE_ID,
      type: "line",
      source: OVERLAY_SOURCE_ID,
      filter: ["==", ["get", "kind"], "line"],
      paint: {
        "line-color": "#6b8f71",
        "line-width": 4,
        "line-opacity": 0.9,
      },
    });
  }

  if (!map.getLayer(OVERLAY_POINTS_ID)) {
    map.addLayer({
      id: OVERLAY_POINTS_ID,
      type: "circle",
      source: OVERLAY_SOURCE_ID,
      filter: ["==", ["get", "kind"], "pin"],
      paint: {
        "circle-radius": 7,
        "circle-color": "#d4a847",
        "circle-stroke-color": "#2c2c2c",
        "circle-stroke-width": 2,
      },
    });
  }
}

function validateStyleUrl(value: string): string | null {
  const v = value.trim();
  if (!v) return "Style URL is required.";
  if (v.startsWith("mapbox://")) return null;
  if (v.startsWith("https://") || v.startsWith("http://")) return null;
  return "Style URL must start with mapbox:// or http(s)://";
}

function parseAndValidateStyleJson(text: string): { style: unknown } | { error: string } {
  const raw = text.trim();
  if (!raw) return { error: "Style JSON is empty." };

  try {
    const obj = JSON.parse(raw) as unknown;
    if (!obj || typeof obj !== "object") return { error: "Style JSON must be an object." };
    const s = obj as { version?: unknown; sources?: unknown; layers?: unknown };
    if (typeof s.version !== "number") return { error: "Style JSON missing numeric 'version'." };
    if (!s.sources || typeof s.sources !== "object") return { error: "Style JSON missing 'sources' object." };
    if (!Array.isArray(s.layers)) return { error: "Style JSON missing 'layers' array." };
    return { style: obj };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown JSON parse error.";
    return { error: `Invalid JSON: ${msg}` };
  }
}

function setStyleSafely(
  map: Map,
  style: string | unknown,
  controls: ControlValues,
) {
  activeGen += 1;
  const gen = activeGen;

  if (pendingCleanup) {
    pendingCleanup();
    pendingCleanup = null;
  }

  const preserveCamera = Boolean(controls.preserveCamera);
  const restoreOverlay = Boolean(controls.restoreOverlay);
  const camera = preserveCamera ? getCamera(map) : null;

  setPanelMessage("Loading style...");

  let done = false;

  const onError = (e: unknown) => {
    if (gen !== activeGen) return;
    if (done) return;
    const msg =
      (e as { error?: { message?: string } })?.error?.message ??
      "Unknown error while loading style.";
    setPanelMessage(`Error: ${msg}`);
  };

  const onStyleLoad = () => {
    if (gen !== activeGen) return;
    done = true;

    if (camera) applyCamera(map, camera);
    if (restoreOverlay) ensureOverlay(map, controls);
    setPanelMessage("Loaded.");
  };

  const timeout = window.setTimeout(() => {
    if (gen !== activeGen) return;
    if (done) return;
    setPanelMessage("Timed out waiting for style to load.");
  }, 15000);

  map.on("error", onError);
  map.once("style.load", onStyleLoad);

  pendingCleanup = () => {
    window.clearTimeout(timeout);
    map.off("error", onError);
    map.off("style.load", onStyleLoad);
  };

  map.setStyle(style as never);
}

export const styleLoaderPattern: Pattern = {
  id: "style-loader",
  name: "Style JSON / URL Loader",
  category: "layers",
  description:
    "Load a style by URL or by raw JSON, with basic validation, stable viewport, and overlay restoration.",
  controls: [
    {
      id: "inputMode",
      label: "Input Mode",
      type: "select",
      defaultValue: "url",
      options: [
        { label: "URL", value: "url" },
        { label: "JSON", value: "json" },
      ],
    },
    {
      id: "styleUrl",
      label: "Style URL",
      type: "text",
      defaultValue: "mapbox://styles/mapbox/light-v11",
    },
    {
      id: "styleJson",
      label: "Style JSON",
      type: "textarea",
      defaultValue: "",
    },
    {
      id: "apply",
      label: "Load Style",
      type: "button",
      defaultValue: 0,
    },
    {
      id: "preserveCamera",
      label: "Preserve Camera",
      type: "toggle",
      defaultValue: true,
    },
    {
      id: "restoreOverlay",
      label: "Restore Overlay After Style Change",
      type: "toggle",
      defaultValue: true,
    },
    {
      id: "showOverlay",
      label: "Show Overlay",
      type: "toggle",
      defaultValue: true,
    },
  ],

  setup(map: Map, controls: ControlValues) {
    ensurePanel(map);
    ensureOverlay(map, controls);
    setPanelMessage("Ready.");
    lastApplyToken = null;
  },

  update(map: Map, controls: ControlValues) {
    ensurePanel(map);

    if (!controls.showOverlay) {
      removeOverlay(map);
    } else if (map.isStyleLoaded()) {
      ensureOverlay(map, controls);
    }

    const applyToken = Number(controls.apply ?? 0);
    if (!applyToken) return;
    if (lastApplyToken === applyToken) return;
    lastApplyToken = applyToken;

    const mode = String(controls.inputMode ?? "url");
    if (mode === "json") {
      const parsed = parseAndValidateStyleJson(String(controls.styleJson ?? ""));
      if ("error" in parsed) {
        setPanelMessage(parsed.error);
        return;
      }
      setStyleSafely(map, parsed.style, controls);
      return;
    }

    const url = String(controls.styleUrl ?? "");
    const err = validateStyleUrl(url);
    if (err) {
      setPanelMessage(err);
      return;
    }

    setStyleSafely(map, url.trim(), controls);
  },

  cleanup(map: Map) {
    activeGen += 1;
    if (pendingCleanup) {
      pendingCleanup();
      pendingCleanup = null;
    }

    removeOverlay(map);

    const existing = map.getContainer().querySelector(`#${STATUS_PANEL_ID}`);
    if (existing) existing.remove();
    panelEl = null;
    panelMsgEl = null;
    lastApplyToken = null;
  },

  snippet: `// Style loader: validate then setStyle + restore overlays
const camera = {
  center: map.getCenter(),
  zoom: map.getZoom(),
  bearing: map.getBearing(),
  pitch: map.getPitch(),
};

map.once("style.load", () => {
  map.jumpTo(camera);
  // Re-add sources/layers here (setStyle clears them)
  ensureOverlay();
});

// URL:
map.setStyle(styleUrl);
// or JSON:
map.setStyle(styleJsonObject);`,
};

