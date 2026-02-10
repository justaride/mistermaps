import { useEffect, useMemo, useRef, useState } from "react";
import type { Map, GeoJSONSource } from "mapbox-gl";
import type { Pattern, PatternViewProps, Theme } from "../../types";
import { mapboxBasemapProvider } from "../../providers/basemap";
import { once } from "../utils/map-compat";
import { loadMapboxGL, loadMapLibreGL } from "../utils/load-map-engine";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const MAPLIBRE_STYLES: Record<Theme, string> = {
  light: "https://tiles.openfreemap.org/styles/bright",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

const SOURCE_ID = "mm-fill-patterns-src";
const BASE_FILL_LAYER_ID = "mm-fill-patterns-base";
const PATTERN_FILL_LAYER_ID = "mm-fill-patterns-pattern";
const OUTLINE_LAYER_ID = "mm-fill-patterns-outline";

const ACTIVE_IMAGE_ID = "mm-fillpat-active";

type PatternMode = "diagonal" | "crosshatch" | "dots";
type Scale = 16 | 32 | 64;

type DemoFC = GeoJSON.FeatureCollection<
  GeoJSON.Polygon,
  { name: string; group: string }
>;

let infoPanel: HTMLDivElement | null = null;
let lastFitTs: number | null = null;

function createInfoPanel() {
  if (infoPanel) return;
  infoPanel = document.createElement("div");
  infoPanel.className = "panel";
  infoPanel.id = "fill-patterns-panel";
  infoPanel.style.cssText = `
    position: absolute;
    top: 100px;
    right: 16px;
    z-index: 10;
    padding: 14px 14px 12px;
    max-width: 320px;
    font-size: 12px;
  `;
  infoPanel.innerHTML = `
    <div style="font-weight: 700; font-size: 14px; margin-bottom: 8px;">Fill Patterns</div>
    <div style="color: var(--text-secondary); line-height: 1.5;">
      Patterns are generated on a <code style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">canvas</code>,
      added via <code style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">map.addImage</code>,
      and applied with <code style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">fill-pattern</code>.
    </div>
    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--panel-border); display: grid; gap: 6px;">
      <div><span style="font-weight: 600;">Pattern</span>: <span id="fill-patterns-meta-pattern" style="color: var(--text-secondary);">—</span></div>
      <div><span style="font-weight: 600;">Scale</span>: <span id="fill-patterns-meta-scale" style="color: var(--text-secondary);">—</span></div>
      <div><span style="font-weight: 600;">Opacity</span>: <span id="fill-patterns-meta-opacity" style="color: var(--text-secondary);">—</span></div>
    </div>
  `;
  document.body.appendChild(infoPanel);
}

function setPanelVisibility(visible: boolean) {
  if (!infoPanel) return;
  infoPanel.style.display = visible ? "block" : "none";
}

function updatePanelMeta(controls: Record<string, unknown>) {
  const patternEl = document.getElementById("fill-patterns-meta-pattern");
  const scaleEl = document.getElementById("fill-patterns-meta-scale");
  const opacityEl = document.getElementById("fill-patterns-meta-opacity");

  if (patternEl) patternEl.textContent = String(controls.pattern ?? "—");
  if (scaleEl) scaleEl.textContent = `${String(controls.scale ?? "—")}px`;
  if (opacityEl) opacityEl.textContent = String(controls.patternOpacity ?? "—");
}

function cleanupPanel() {
  if (infoPanel?.parentNode) {
    infoPanel.parentNode.removeChild(infoPanel);
    infoPanel = null;
  }
}

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function readColor(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function readMode(value: unknown): PatternMode {
  return value === "crosshatch" || value === "dots" ? value : "diagonal";
}

function readScale(value: unknown): Scale {
  return value === 16 || value === 64 ? value : 32;
}

function buildDemoPolygons(): DemoFC {
  // Simple rectangles near central Oslo to ensure the fill is obvious.
  const rect = (
    name: string,
    group: string,
    west: number,
    south: number,
    east: number,
    north: number,
  ): GeoJSON.Feature<GeoJSON.Polygon, { name: string; group: string }> => ({
    type: "Feature",
    properties: { name, group },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
    },
  });

  return {
    type: "FeatureCollection",
    features: [
      rect("Aker Brygge", "west", 10.718, 59.905, 10.733, 59.915),
      rect("Nationaltheatret", "center", 10.727, 59.912, 10.741, 59.921),
      rect("Grunerlokka", "east", 10.752, 59.918, 10.769, 59.929),
      rect("Toyen", "east", 10.765, 59.911, 10.784, 59.920),
      rect("Bjorvika", "center", 10.748, 59.903, 10.766, 59.912),
    ],
  };
}

function createPatternImage(
  mode: PatternMode,
  scale: Scale,
  color: string,
): { width: number; height: number; data: Uint8ClampedArray } {
  const canvas = document.createElement("canvas");
  canvas.width = scale;
  canvas.height = scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { width: scale, height: scale, data: new Uint8ClampedArray(scale * scale * 4) };

  ctx.clearRect(0, 0, scale, scale);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, Math.round(scale / 16));
  ctx.globalAlpha = 1;

  if (mode === "dots") {
    const r = Math.max(1, Math.round(scale / 10));
    const step = Math.max(r * 3, Math.round(scale / 3.5));
    for (let y = Math.floor(step / 2); y < scale + step; y += step) {
      for (let x = Math.floor(step / 2); x < scale + step; x += step) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const img = ctx.getImageData(0, 0, scale, scale);
    return { width: scale, height: scale, data: img.data };
  }

  const spacing = Math.max(6, Math.round(scale / 4));
  const drawDiag = (dir: 1 | -1) => {
    ctx.beginPath();
    // Draw lines across an extended range so tile edges align better.
    for (let i = -scale; i <= scale * 2; i += spacing) {
      if (dir === 1) {
        ctx.moveTo(i, 0);
        ctx.lineTo(i + scale, scale);
      } else {
        ctx.moveTo(i, scale);
        ctx.lineTo(i + scale, 0);
      }
    }
    ctx.stroke();
  };

  drawDiag(1);
  if (mode === "crosshatch") drawDiag(-1);

  const img = ctx.getImageData(0, 0, scale, scale);
  return { width: scale, height: scale, data: img.data };
}

function ensureImage(map: Map, controls: Record<string, unknown>) {
  const mode = readMode(controls.pattern);
  const scale = readScale(controls.scale);
  const patternColor = readColor(controls.patternColor, "#2c2c2c");

  // Detach pattern from layer before image replacement to avoid errors.
  if (map.getLayer(PATTERN_FILL_LAYER_ID)) {
    map.setPaintProperty(
      PATTERN_FILL_LAYER_ID,
      "fill-pattern",
      null as unknown as string,
    );
  }

  if (map.hasImage(ACTIVE_IMAGE_ID)) {
    map.removeImage(ACTIVE_IMAGE_ID);
  }

  map.addImage(ACTIVE_IMAGE_ID, createPatternImage(mode, scale, patternColor), {
    pixelRatio: 2,
  });
}

function ensureSourceAndLayers(map: Map, controls: Record<string, unknown>) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: buildDemoPolygons(),
    });
  } else {
    (map.getSource(SOURCE_ID) as GeoJSONSource).setData(buildDemoPolygons() as never);
  }

  if (!map.getLayer(BASE_FILL_LAYER_ID)) {
    map.addLayer({
      id: BASE_FILL_LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      paint: {
        "fill-color": readColor(controls.backgroundColor, "#f7f5f0"),
        "fill-opacity": 0.65,
      },
    });
  }

  if (!map.getLayer(PATTERN_FILL_LAYER_ID)) {
    map.addLayer({
      id: PATTERN_FILL_LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      paint: {
        "fill-pattern": ACTIVE_IMAGE_ID,
        "fill-opacity": clampNumber(controls.patternOpacity, 0, 1, 0.75),
      },
    });
  }

  if (!map.getLayer(OUTLINE_LAYER_ID)) {
    map.addLayer({
      id: OUTLINE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      layout: {
        visibility: controls.showOutline ? "visible" : "none",
      },
      paint: {
        "line-color": "#3d3530",
        "line-width": 2,
        "line-opacity": 0.85,
      },
    });
  }
}

function applyControls(map: Map, controls: Record<string, unknown>) {
  if (!map.getLayer(PATTERN_FILL_LAYER_ID)) return;

  map.setPaintProperty(
    BASE_FILL_LAYER_ID,
    "fill-color",
    readColor(controls.backgroundColor, "#f7f5f0"),
  );

  map.setPaintProperty(
    PATTERN_FILL_LAYER_ID,
    "fill-opacity",
    clampNumber(controls.patternOpacity, 0, 1, 0.75),
  );

  map.setLayoutProperty(
    OUTLINE_LAYER_ID,
    "visibility",
    controls.showOutline ? "visible" : "none",
  );

  // Re-apply active image id.
  map.setPaintProperty(PATTERN_FILL_LAYER_ID, "fill-pattern", ACTIVE_IMAGE_ID);
}

function cleanupMap(map: Map) {
  if (map.getLayer(OUTLINE_LAYER_ID)) map.removeLayer(OUTLINE_LAYER_ID);
  if (map.getLayer(PATTERN_FILL_LAYER_ID)) map.removeLayer(PATTERN_FILL_LAYER_ID);
  if (map.getLayer(BASE_FILL_LAYER_ID)) map.removeLayer(BASE_FILL_LAYER_ID);
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  if (map.hasImage(ACTIVE_IMAGE_ID)) map.removeImage(ACTIVE_IMAGE_ID);
}

export const fillPatternsPattern: Pattern = {
  id: "fill-patterns",
  name: "Fill Patterns",
  category: "layers",
  description: "Hatching/stripes/dots fill-pattern demos using addImage.",
  controls: [
    {
      id: "pattern",
      label: "Pattern",
      type: "select",
      defaultValue: "diagonal",
      options: [
        { label: "Diagonal stripes", value: "diagonal" },
        { label: "Crosshatch", value: "crosshatch" },
        { label: "Dots", value: "dots" },
      ],
    },
    {
      id: "scale",
      label: "Scale (tile px)",
      type: "select",
      defaultValue: "32",
      options: [
        { label: "Small (16px)", value: "16" },
        { label: "Medium (32px)", value: "32" },
        { label: "Large (64px)", value: "64" },
      ],
    },
    {
      id: "patternOpacity",
      label: "Pattern opacity",
      type: "slider",
      defaultValue: 0.75,
      min: 0,
      max: 1,
      step: 0.05,
    },
    {
      id: "backgroundColor",
      label: "Background color",
      type: "color",
      defaultValue: "#f7f5f0",
    },
    {
      id: "patternColor",
      label: "Pattern color",
      type: "color",
      defaultValue: "#2c2c2c",
    },
    {
      id: "showOutline",
      label: "Show outline",
      type: "toggle",
      defaultValue: true,
    },
    {
      id: "fitBounds",
      label: "Fit to polygons",
      type: "button",
      defaultValue: "",
    },
  ],

  setup(map: Map, controls: Record<string, unknown>) {
    createInfoPanel();
    setPanelVisibility(true);
    updatePanelMeta(controls);

    map.easeTo({
      center: [10.7522, 59.9139],
      zoom: 12.2,
      duration: 800,
    });

    // Ensure image exists before applying fill-pattern.
    ensureImage(map, normalizeControls(controls));
    ensureSourceAndLayers(map, normalizeControls(controls));
    applyControls(map, normalizeControls(controls));
  },

  update(map: Map, controls: Record<string, unknown>) {
    if (!map.getLayer(PATTERN_FILL_LAYER_ID)) return;
    const normalized = normalizeControls(controls);

    updatePanelMeta(normalized);

    // Rebuild active pattern image on every update; small canvas, and avoids complex diffing.
    ensureImage(map, normalized);
    applyControls(map, normalized);

    const fitTs = typeof controls.fitBounds === "number" ? controls.fitBounds : null;
    if (fitTs && fitTs !== lastFitTs) {
      lastFitTs = fitTs;
      const fc = buildDemoPolygons();
      const coords = fc.features.flatMap((f) => f.geometry.coordinates[0]);
      let minLng = coords[0]?.[0] ?? 10.718;
      let minLat = coords[0]?.[1] ?? 59.903;
      let maxLng = minLng;
      let maxLat = minLat;
      for (const c of coords) {
        const lng = c[0];
        const lat = c[1];
        if (lng < minLng) minLng = lng;
        if (lat < minLat) minLat = lat;
        if (lng > maxLng) maxLng = lng;
        if (lat > maxLat) maxLat = lat;
      }
      map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 60, duration: 700 });
    }
  },

  cleanup(map: Map) {
    cleanupMap(map);
    cleanupPanel();
    lastFitTs = null;
  },

  view: FillPatternsView,

  snippet: `// Fill patterns via addImage + fill-pattern
const canvas = document.createElement('canvas');
canvas.width = 32; canvas.height = 32;
const ctx = canvas.getContext('2d');
// draw stripes/dots...

map.addImage('my-pattern', canvas, { pixelRatio: 2 });
map.addSource('polys', { type:'geojson', data: polygons });
map.addLayer({
  id: 'pattern-fill',
  type: 'fill',
  source: 'polys',
  paint: { 'fill-pattern': 'my-pattern', 'fill-opacity': 0.75 }
});`,
};

function normalizeControls(controls: Record<string, unknown>) {
  // Controls store select values as strings; normalize to consistent internal types.
  return {
    ...controls,
    pattern: readMode(controls.pattern),
    scale: readScale(
      typeof controls.scale === "string" ? parseInt(controls.scale, 10) : controls.scale,
    ),
    patternOpacity: clampNumber(controls.patternOpacity, 0, 1, 0.75),
    backgroundColor: readColor(controls.backgroundColor, "#f7f5f0"),
    patternColor: readColor(controls.patternColor, "#2c2c2c"),
    showOutline: Boolean(controls.showOutline),
  };
}

type Engine = "mapbox" | "maplibre";

type LayerEventTarget = {
  on: (type: string, listener: () => void) => void;
  once: (type: string, listener: () => void) => void;
  remove: () => void;
  resize: () => void;
  getContainer: () => HTMLElement;
  getCenter: () => { lng: number; lat: number };
  getZoom: () => number;
  getBearing: () => number;
  getPitch: () => number;
  isStyleLoaded: () => boolean;
  setStyle: (style: unknown) => void;
  jumpTo: (opts: unknown) => void;
  fitBounds: (bounds: unknown, opts?: unknown) => void;
  easeTo: (opts: unknown) => void;
  flyTo: (opts: unknown) => void;
  getLayer: (id: string) => unknown;
  getSource: (id: string) => unknown;
  addSource: (id: string, source: unknown) => void;
  addLayer: (layer: unknown) => void;
  removeLayer: (id: string) => void;
  removeSource: (id: string) => void;
  setPaintProperty: (id: string, prop: string, value: unknown) => void;
  setLayoutProperty: (id: string, prop: string, value: unknown) => void;
  hasImage: (id: string) => boolean;
  addImage: (id: string, img: unknown, opts?: unknown) => void;
  removeImage: (id: string) => void;
};

function getCamera(map: LayerEventTarget) {
  const center = map.getCenter();
  return {
    center: [center.lng, center.lat] as [number, number],
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  };
}

function styleFor(engine: Engine, theme: Theme) {
  if (engine === "maplibre") return MAPLIBRE_STYLES[theme];
  return mapboxBasemapProvider.getStyle(theme);
}

function createEngineButtonClass(active: boolean) {
  return `status-panel__button ${active ? "primary" : ""}`;
}

function ensureAll(map: LayerEventTarget, controls: Record<string, unknown>) {
  const normalized = normalizeControls(controls);

  // Replace active image.
  if (map.getLayer(PATTERN_FILL_LAYER_ID)) {
    map.setPaintProperty(PATTERN_FILL_LAYER_ID, "fill-pattern", null);
  }
  if (map.hasImage(ACTIVE_IMAGE_ID)) map.removeImage(ACTIVE_IMAGE_ID);
  map.addImage(
    ACTIVE_IMAGE_ID,
    createPatternImage(
      normalized.pattern as PatternMode,
      normalized.scale as Scale,
      normalized.patternColor as string,
    ),
    { pixelRatio: 2 },
  );

  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, { type: "geojson", data: buildDemoPolygons() });
  }

  if (!map.getLayer(BASE_FILL_LAYER_ID)) {
    map.addLayer({
      id: BASE_FILL_LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      paint: { "fill-color": normalized.backgroundColor, "fill-opacity": 0.65 },
    });
  }

  if (!map.getLayer(PATTERN_FILL_LAYER_ID)) {
    map.addLayer({
      id: PATTERN_FILL_LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      paint: { "fill-pattern": ACTIVE_IMAGE_ID, "fill-opacity": normalized.patternOpacity },
    });
  }

  if (!map.getLayer(OUTLINE_LAYER_ID)) {
    map.addLayer({
      id: OUTLINE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      layout: { visibility: normalized.showOutline ? "visible" : "none" },
      paint: { "line-color": "#3d3530", "line-width": 2, "line-opacity": 0.85 },
    });
  }

  map.setPaintProperty(BASE_FILL_LAYER_ID, "fill-color", normalized.backgroundColor);
  map.setPaintProperty(PATTERN_FILL_LAYER_ID, "fill-opacity", normalized.patternOpacity);
  map.setLayoutProperty(OUTLINE_LAYER_ID, "visibility", normalized.showOutline ? "visible" : "none");
  map.setPaintProperty(PATTERN_FILL_LAYER_ID, "fill-pattern", ACTIVE_IMAGE_ID);
}

function cleanupAll(map: LayerEventTarget) {
  if (map.getLayer(OUTLINE_LAYER_ID)) map.removeLayer(OUTLINE_LAYER_ID);
  if (map.getLayer(PATTERN_FILL_LAYER_ID)) map.removeLayer(PATTERN_FILL_LAYER_ID);
  if (map.getLayer(BASE_FILL_LAYER_ID)) map.removeLayer(BASE_FILL_LAYER_ID);
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  if (map.hasImage(ACTIVE_IMAGE_ID)) map.removeImage(ACTIVE_IMAGE_ID);
}

function FillPatternsView({ theme, values, onPrimaryMapReady }: PatternViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LayerEventTarget | null>(null);
  const recreateTokenRef = useRef(0);
  const [engine, setEngine] = useState<Engine>("mapbox");
  const [loaded, setLoaded] = useState(false);

  const style = useMemo(() => styleFor(engine, theme), [engine, theme]);

  const recreate = () => {
    if (!containerRef.current) return;
    const token = (recreateTokenRef.current += 1);

    const prev = mapRef.current;
    const camera = prev ? getCamera(prev) : null;
    if (prev) {
      cleanupAll(prev);
      prev.remove();
      mapRef.current = null;
    }

    setLoaded(false);

    void (async () => {
      if (engine === "mapbox") {
        const mapboxgl = await loadMapboxGL();
        if (recreateTokenRef.current !== token) return;

        mapboxgl.accessToken = MAPBOX_TOKEN;
        const map = new mapboxgl.Map({
          container: containerRef.current!,
          style,
          center: [10.7522, 59.9139],
          zoom: 12.2,
          bearing: 0,
          pitch: 0,
        });
        map.addControl(new mapboxgl.NavigationControl(), "top-right");
        const m = map as unknown as LayerEventTarget;
        mapRef.current = m;
        map.on("load", () => {
          if (recreateTokenRef.current !== token) return;
          setLoaded(true);
          onPrimaryMapReady?.(map);
          ensureAll(m, values);
          if (camera) map.jumpTo(camera as never);
        });
        return;
      }

      const maplibregl = await loadMapLibreGL();
      if (recreateTokenRef.current !== token) return;

      const map = new maplibregl.Map({
        container: containerRef.current!,
        style,
        center: [10.7522, 59.9139],
        zoom: 12.2,
        bearing: 0,
        pitch: 0,
      });
      map.addControl(new maplibregl.NavigationControl(), "top-right");
      const m = map as unknown as LayerEventTarget;
      mapRef.current = m;
      map.on("load", () => {
        if (recreateTokenRef.current !== token) return;
        setLoaded(true);
        onPrimaryMapReady?.(map as unknown as Map);
        ensureAll(m, values);
        if (camera) map.jumpTo(camera as never);
      });
    })().catch(() => {
      // ignore
    });
  };

  useEffect(() => {
    recreate();
    return () => {
      recreateTokenRef.current += 1;
      const map = mapRef.current;
      if (!map) return;
      cleanupAll(map);
      map.remove();
      mapRef.current = null;
    };
    // Recreate only on engine changes (different library instance).
  }, [engine]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    const camera = getCamera(map);
    map.setStyle(style);
    once(map as never, "style.load", () => {
      map.jumpTo(camera);
      map.resize();
      ensureAll(map, values);
    });
  }, [style, loaded, values]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    ensureAll(map, values);
  }, [values, loaded]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="panel status-panel absolute left-4 top-16 z-10 p-3">
        <div className="status-panel__message">
          Canvas-generated patterns added via <code>addImage</code> and used in{" "}
          <code>fill-pattern</code>.
        </div>
        <div className="status-panel__actions">
          <button
            type="button"
            className={createEngineButtonClass(engine === "mapbox")}
            onClick={() => setEngine("mapbox")}
          >
            Mapbox
          </button>
          <button
            type="button"
            className={createEngineButtonClass(engine === "maplibre")}
            onClick={() => setEngine("maplibre")}
          >
            MapLibre
          </button>
          <button
            type="button"
            className="status-panel__button"
            onClick={() => {
              const map = mapRef.current;
              if (!map) return;
              map.fitBounds(
                [[10.718, 59.903], [10.784, 59.929]],
                { padding: 60, duration: 700 },
              );
            }}
          >
            Fit Bounds
          </button>
        </div>
      </div>
    </div>
  );
}
