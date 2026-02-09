import type { GeoJSONSource, Map } from "mapbox-gl";
import type { Pattern } from "../../types";

const OVERLAY_SOURCE_ID = "mm-style-switcher:overlay";
const OVERLAY_LINE_ID = "mm-style-switcher:overlay-line";
const OVERLAY_POINTS_ID = "mm-style-switcher:overlay-points";

const STATUS_PANEL_ID = "mm-style-switcher:status";

const STYLE_PRESETS: { label: string; value: string }[] = [
  { label: "Mapbox Light", value: "mapbox://styles/mapbox/light-v11" },
  { label: "Mapbox Dark", value: "mapbox://styles/mapbox/dark-v11" },
  { label: "Mapbox Streets", value: "mapbox://styles/mapbox/streets-v12" },
  { label: "Mapbox Outdoors", value: "mapbox://styles/mapbox/outdoors-v12" },
  {
    label: "Mapbox Satellite Streets",
    value: "mapbox://styles/mapbox/satellite-streets-v12",
  },
  {
    label: "OpenFreeMap Bright (URL)",
    value: "https://tiles.openfreemap.org/styles/bright",
  },
  {
    label: "OpenFreeMap Dark (URL)",
    value: "https://tiles.openfreemap.org/styles/dark",
  },
];

let panelEl: HTMLDivElement | null = null;
let panelMsgEl: HTMLDivElement | null = null;

let activeGen = 0;
let pendingCleanup: (() => void) | null = null;
let lastStyleValue: string | null = null;

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
  title.textContent = "Style Switcher";
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
            [10.71, 59.9],
            [10.75, 59.91],
            [10.79, 59.92],
          ],
        },
      },
      {
        type: "Feature",
        properties: { kind: "pin", name: "A" },
        geometry: { type: "Point", coordinates: [10.71, 59.9] },
      },
      {
        type: "Feature",
        properties: { kind: "pin", name: "B" },
        geometry: { type: "Point", coordinates: [10.75, 59.91] },
      },
      {
        type: "Feature",
        properties: { kind: "pin", name: "C" },
        geometry: { type: "Point", coordinates: [10.79, 59.92] },
      },
    ],
  };
}

function removeOverlay(map: Map) {
  if (map.getLayer(OVERLAY_LINE_ID)) map.removeLayer(OVERLAY_LINE_ID);
  if (map.getLayer(OVERLAY_POINTS_ID)) map.removeLayer(OVERLAY_POINTS_ID);
  if (map.getSource(OVERLAY_SOURCE_ID)) map.removeSource(OVERLAY_SOURCE_ID);
}

function ensureOverlay(map: Map, controls: Record<string, unknown>) {
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
        "line-color": "#c85a2a",
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
        "circle-color": "#5b8fa8",
        "circle-stroke-color": "#2c2c2c",
        "circle-stroke-width": 2,
      },
    });
  }
}

function setStyleSafely(map: Map, style: string, controls: Record<string, unknown>) {
  activeGen += 1;
  const gen = activeGen;

  if (pendingCleanup) {
    pendingCleanup();
    pendingCleanup = null;
  }

  const preserveCamera = Boolean(controls.preserveCamera);
  const restoreOverlay = Boolean(controls.restoreOverlay);
  const camera = preserveCamera ? getCamera(map) : null;

  setPanelMessage(`Loading: ${style}`);

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

  map.setStyle(style);
}

export const styleSwitcherPattern: Pattern = {
  id: "style-switcher",
  name: "Style Switcher",
  category: "layers",
  description:
    "Switch basemap styles without losing viewport context, and restore a demo overlay after each change.",
  controls: [
    {
      id: "stylePreset",
      label: "Style Preset",
      type: "select",
      defaultValue: STYLE_PRESETS[0]?.value ?? "mapbox://styles/mapbox/light-v11",
      options: STYLE_PRESETS,
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

  setup(map: Map, controls: Record<string, unknown>) {
    ensurePanel(map);
    ensureOverlay(map, controls);

    const style = String(controls.stylePreset ?? "");
    lastStyleValue = style;
    setPanelMessage("Ready.");
  },

  update(map: Map, controls: Record<string, unknown>) {
    ensurePanel(map);

    if (!controls.showOverlay) {
      removeOverlay(map);
    } else if (map.isStyleLoaded()) {
      ensureOverlay(map, controls);
    }

    const style = String(controls.stylePreset ?? "");
    if (!style) return;
    if (style === lastStyleValue) return;

    lastStyleValue = style;
    setStyleSafely(map, style, controls);
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
    lastStyleValue = null;
  },

  snippet: `// Style switcher: preserve camera + restore overlays after setStyle
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

map.setStyle(nextStyle);`,
};

