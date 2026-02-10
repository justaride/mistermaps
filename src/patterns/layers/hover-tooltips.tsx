import { useEffect, useMemo, useRef, useState } from "react";
import type { Map, MapLayerMouseEvent, GeoJSONSource } from "mapbox-gl";
import type { Pattern, PatternViewProps, Theme } from "../../types";
import { mapboxBasemapProvider } from "../../providers/basemap";
import { loadMapboxGL, loadMapLibreGL } from "../utils/load-map-engine";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const MAPLIBRE_STYLES: Record<Theme, string> = {
  light: "https://tiles.openfreemap.org/styles/bright",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

const SOURCE_ID = "hover-tooltips-src";
const LAYER_ID = "hover-tooltips-layer";

type DemoFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  { name: string }
>;

function buildDemoPoints(): DemoFeatureCollection {
  // Oslo-centered sample points so the pattern behaves predictably across styles.
  const points: Array<{ name: string; center: [number, number] }> = [
    { name: "Oslo S (station)", center: [10.7532, 59.9107] },
    { name: "Karl Johans gate", center: [10.7392, 59.9134] },
    { name: "Aker Brygge", center: [10.7258, 59.9086] },
    { name: "Tjuvholmen", center: [10.7214, 59.9074] },
    { name: "Vigeland Park", center: [10.7013, 59.9270] },
    { name: "Frogner", center: [10.7067, 59.9245] },
    { name: "Majorstuen", center: [10.7147, 59.9296] },
    { name: "St. Hanshaugen", center: [10.7459, 59.9276] },
    { name: "Grunerlokka", center: [10.7608, 59.9232] },
    { name: "Barcode", center: [10.7587, 59.9079] },
    { name: "Bjorvika", center: [10.7559, 59.9070] },
    { name: "Solli plass", center: [10.7248, 59.9141] },
    { name: "Nationaltheatret", center: [10.7316, 59.9147] },
    { name: "Gamlebyen", center: [10.7816, 59.9079] },
    { name: "Toyen", center: [10.7705, 59.9157] },
    { name: "Ekeberg", center: [10.7728, 59.8903] },
  ];

  return {
    type: "FeatureCollection",
    features: points.map((p, idx) => ({
      type: "Feature",
      id: idx,
      properties: { name: p.name },
      geometry: { type: "Point", coordinates: p.center },
    })),
  };
}

type TooltipContent = {
  title: string;
  coords?: [number, number];
};

function formatLngLat(coords: [number, number]) {
  return `${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}`;
}

function createTooltip(container: HTMLElement): HTMLDivElement {
  const el = document.createElement("div");
  el.style.position = "absolute";
  el.style.left = "0";
  el.style.top = "0";
  el.style.transform = "translate(-9999px, -9999px)";
  el.style.pointerEvents = "none";
  el.style.zIndex = "20";
  el.style.maxWidth = "260px";
  el.style.padding = "8px 10px";
  el.style.borderRadius = "8px";
  el.style.border = "1px solid var(--panel-border)";
  el.style.background = "var(--panel-bg)";
  el.style.backdropFilter = "blur(10px)";
  el.style.boxShadow = "0 6px 24px rgba(0,0,0,0.18)";
  el.style.fontFamily =
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
  el.style.fontSize = "12px";
  el.style.lineHeight = "1.25";
  el.style.color = "var(--text-primary)";
  el.style.whiteSpace = "normal";
  el.style.display = "none";
  container.appendChild(el);
  return el;
}

function setTooltipHidden(el: HTMLDivElement, hidden: boolean) {
  el.style.display = hidden ? "none" : "block";
  if (hidden) {
    el.style.transform = "translate(-9999px, -9999px)";
  }
}

function setTooltipPosition(el: HTMLDivElement, x: number, y: number) {
  el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}

function setTooltipContent(el: HTMLDivElement, content: TooltipContent) {
  const lines = [content.title];
  if (content.coords) lines.push(formatLngLat(content.coords));
  el.textContent = lines.join("\n");
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

function ensureLayerAndSource(map: Map, controls: Record<string, unknown>) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, { type: "geojson", data: buildDemoPoints() });
  } else {
    const src = map.getSource(SOURCE_ID) as GeoJSONSource;
    src.setData(buildDemoPoints() as never);
  }

  if (!map.getLayer(LAYER_ID)) {
    map.addLayer({
      id: LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": clampNumber(controls.pointRadius, 2, 18, 8),
        "circle-color": readColor(controls.pointColor, "#22c55e"),
        "circle-stroke-color": "#052e16",
        "circle-stroke-width": 2,
        "circle-opacity": 0.95,
      },
    });
  }
}

function removeLayerAndSource(map: Map) {
  if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}

let tooltipEl: HTMLDivElement | null = null;
let mouseMoveHandler: ((e: MapLayerMouseEvent) => void) | null = null;
let mouseLeaveHandler: (() => void) | null = null;
let rafId: number | null = null;
let lastEvent: MapLayerMouseEvent | null = null;
let latestControls: Record<string, unknown> = {};

function cleanupHandlers(map: Map) {
  if (mouseMoveHandler) {
    map.off("mousemove", LAYER_ID, mouseMoveHandler);
  }
  if (mouseLeaveHandler) {
    map.off("mouseleave", LAYER_ID, mouseLeaveHandler);
  }
  mouseMoveHandler = null;
  mouseLeaveHandler = null;

  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  lastEvent = null;

  map.getCanvas().style.cursor = "";
}

function ensureHandlers(map: Map) {
  cleanupHandlers(map);

  mouseMoveHandler = (e: MapLayerMouseEvent) => {
    lastEvent = e;
    if (rafId != null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      const ev = lastEvent;
      if (!ev || !tooltipEl) return;
      if (!map.getLayer(LAYER_ID)) return;

      const features = map.queryRenderedFeatures(ev.point, { layers: [LAYER_ID] });
      const hit = features[0];
      if (!hit) {
        setTooltipHidden(tooltipEl, true);
        map.getCanvas().style.cursor = "";
        return;
      }

      map.getCanvas().style.cursor = "pointer";

      const title =
        typeof hit.properties?.name === "string"
          ? hit.properties.name
          : "Feature";

      const showCoords = Boolean(latestControls.showCoords);
      const coords =
        showCoords && hit.geometry?.type === "Point"
          ? ((hit.geometry as GeoJSON.Point).coordinates as [number, number])
          : undefined;

      setTooltipContent(tooltipEl, { title, coords });
      setTooltipHidden(tooltipEl, false);
      setTooltipPosition(tooltipEl, ev.point.x + 14, ev.point.y + 14);
    });
  };

  mouseLeaveHandler = () => {
    if (tooltipEl) setTooltipHidden(tooltipEl, true);
    map.getCanvas().style.cursor = "";
  };

  map.on("mousemove", LAYER_ID, mouseMoveHandler);
  map.on("mouseleave", LAYER_ID, mouseLeaveHandler);
}

export const hoverTooltipsPattern: Pattern = {
  id: "hover-tooltips",
  name: "Hover Tooltips",
  category: "layers",
  description: "Hover tooltips that follow the cursor without popup churn.",
  controls: [
    { id: "enabled", label: "Enabled", type: "toggle", defaultValue: true },
    {
      id: "showCoords",
      label: "Show Coordinates",
      type: "toggle",
      defaultValue: false,
    },
    {
      id: "pointColor",
      label: "Point Color",
      type: "color",
      defaultValue: "#22c55e",
    },
    {
      id: "pointRadius",
      label: "Point Radius",
      type: "slider",
      defaultValue: 8,
      min: 2,
      max: 18,
      step: 1,
    },
  ],

  setup(map: Map, controls: Record<string, unknown>) {
    latestControls = controls;

    map.easeTo({
      center: [10.7522, 59.9139],
      zoom: 12.5,
      duration: 800,
    });

    ensureLayerAndSource(map, controls);

    if (!tooltipEl) {
      tooltipEl = createTooltip(map.getContainer());
    } else if (!tooltipEl.isConnected) {
      map.getContainer().appendChild(tooltipEl);
    }

    setTooltipHidden(tooltipEl, true);
    ensureHandlers(map);

    const enabled = Boolean(controls.enabled);
    map.setLayoutProperty(LAYER_ID, "visibility", enabled ? "visible" : "none");
  },

  update(map: Map, controls: Record<string, unknown>) {
    latestControls = controls;
    if (!map.getLayer(LAYER_ID)) return;

    const enabled = Boolean(controls.enabled);
    map.setLayoutProperty(LAYER_ID, "visibility", enabled ? "visible" : "none");

    map.setPaintProperty(
      LAYER_ID,
      "circle-radius",
      clampNumber(controls.pointRadius, 2, 18, 8),
    );
    map.setPaintProperty(
      LAYER_ID,
      "circle-color",
      readColor(controls.pointColor, "#22c55e"),
    );

    if (!enabled) {
      if (tooltipEl) setTooltipHidden(tooltipEl, true);
      map.getCanvas().style.cursor = "";
    }
  },

  cleanup(map: Map) {
    cleanupHandlers(map);
    removeLayerAndSource(map);
    if (tooltipEl) {
      tooltipEl.remove();
      tooltipEl = null;
    }
  },

  // Catalog page can use a dual-engine view (Mapbox/MapLibre toggle).
  view: HoverTooltipsView,

  snippet: `// Lightweight hover tooltip (no popups)
map.on('mousemove', layerId, (e) => {
  const hit = e.features?.[0] ?? map.queryRenderedFeatures(e.point, { layers:[layerId] })[0];
  tooltip.style.transform = \`translate(\${e.point.x + 14}px, \${e.point.y + 14}px)\`;
  tooltip.textContent = hit?.properties?.name ?? 'Feature';
});

map.on('mouseleave', layerId, () => {
  tooltip.style.display = 'none';
  map.getCanvas().style.cursor = '';
});`,
};

type Engine = "mapbox" | "maplibre";

type LayerEventTarget = {
  on: (type: string, layerId: string, listener: (e: unknown) => void) => void;
  off: (type: string, layerId: string, listener: (e: unknown) => void) => void;
  getCanvas: () => HTMLCanvasElement;
  getContainer: () => HTMLElement;
  getCenter: () => { lng: number; lat: number };
  getZoom: () => number;
  getBearing: () => number;
  getPitch: () => number;
  isStyleLoaded: () => boolean;
  once: (type: string, listener: () => void) => void;
  setStyle: (style: unknown) => void;
  jumpTo: (opts: unknown) => void;
  resize: () => void;
  flyTo: (opts: unknown) => void;
  getLayer: (id: string) => unknown;
  getSource: (id: string) => unknown;
  removeLayer: (id: string) => void;
  removeSource: (id: string) => void;
  addSource: (id: string, source: unknown) => void;
  addLayer: (layer: unknown) => void;
};

type HoverEventLike = {
  point: { x: number; y: number };
  features?: Array<{ properties?: Record<string, unknown>; geometry?: unknown }>;
  lngLat?: { lng: number; lat: number };
};

function isHoverEventLike(e: unknown): e is HoverEventLike {
  if (!e || typeof e !== "object") return false;
  const point = (e as { point?: unknown }).point;
  if (!point || typeof point !== "object") return false;
  const x = (point as { x?: unknown }).x;
  const y = (point as { y?: unknown }).y;
  return typeof x === "number" && typeof y === "number";
}

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

function HoverTooltipsView({ theme, values, onPrimaryMapReady }: PatternViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LayerEventTarget | null>(null);
  const recreateTokenRef = useRef(0);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const [engine, setEngine] = useState<Engine>("mapbox");
  const [loaded, setLoaded] = useState(false);

  const enabled = Boolean(values.enabled);
  const showCoords = Boolean(values.showCoords);
  const pointColor = readColor(values.pointColor, "#22c55e");
  const pointRadius = clampNumber(values.pointRadius, 2, 18, 8);

  const style = useMemo(() => styleFor(engine, theme), [engine, theme]);

  // Tooltip controller (local to this view)
  const moveListenerRef = useRef<((e: unknown) => void) | null>(null);
  const leaveListenerRef = useRef<((e: unknown) => void) | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastEventRef = useRef<HoverEventLike | null>(null);

  const teardownListeners = (map: LayerEventTarget) => {
    if (moveListenerRef.current) {
      map.off("mousemove", LAYER_ID, moveListenerRef.current);
    }
    if (leaveListenerRef.current) {
      map.off("mouseleave", LAYER_ID, leaveListenerRef.current);
    }
    moveListenerRef.current = null;
    leaveListenerRef.current = null;
    map.getCanvas().style.cursor = "";
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastEventRef.current = null;
  };

  const ensureListeners = (map: LayerEventTarget) => {
    teardownListeners(map);

    moveListenerRef.current = (e: unknown) => {
      if (!enabled) return;
      if (!isHoverEventLike(e)) return;
      lastEventRef.current = e;
      if (rafRef.current != null) return;

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const ev = lastEventRef.current;
        const tip = tooltipRef.current;
        if (!ev || !tip) return;
        if (!map.getLayer(LAYER_ID)) return;

        // Layer-bound listeners usually include features. Fall back to queryRenderedFeatures when missing.
        const first =
          (Array.isArray(ev.features) && ev.features.length > 0
            ? ev.features[0]
            : null) ?? null;

        if (!first) {
          setTooltipHidden(tip, true);
          map.getCanvas().style.cursor = "";
          return;
        }

        map.getCanvas().style.cursor = "pointer";

        const title =
          typeof first.properties?.name === "string"
            ? first.properties.name
            : "Feature";

        const coords = showCoords && ev.lngLat
          ? ([ev.lngLat.lng, ev.lngLat.lat] as [number, number])
          : undefined;

        setTooltipContent(tip, { title, coords });
        setTooltipHidden(tip, false);
        setTooltipPosition(tip, ev.point.x + 14, ev.point.y + 14);
      });
    };

    leaveListenerRef.current = () => {
      const tip = tooltipRef.current;
      if (tip) setTooltipHidden(tip, true);
      map.getCanvas().style.cursor = "";
    };

    map.on("mousemove", LAYER_ID, moveListenerRef.current);
    map.on("mouseleave", LAYER_ID, leaveListenerRef.current);
  };

  const ensureDemo = (map: LayerEventTarget) => {
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: "geojson", data: buildDemoPoints() });
    } else {
      // Not all engines expose the same source typing; setData is optional here.
      const src = map.getSource(SOURCE_ID) as unknown as { setData?: (d: unknown) => void };
      src.setData?.(buildDemoPoints());
    }

    if (!map.getLayer(LAYER_ID)) {
      map.addLayer({
        id: LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-radius": pointRadius,
          "circle-color": pointColor,
          "circle-stroke-color": "#052e16",
          "circle-stroke-width": 2,
          "circle-opacity": 0.95,
        },
        layout: { visibility: enabled ? "visible" : "none" },
      });
    }
  };

  const applyPaint = (map: LayerEventTarget) => {
    if (!map.getLayer(LAYER_ID)) return;
    // setPaintProperty exists in both, but typing differs; call via structural cast.
    const m = map as unknown as { setPaintProperty: (id: string, prop: string, v: unknown) => void; setLayoutProperty: (id: string, prop: string, v: unknown) => void };
    m.setPaintProperty(LAYER_ID, "circle-radius", pointRadius);
    m.setPaintProperty(LAYER_ID, "circle-color", pointColor);
    m.setLayoutProperty(LAYER_ID, "visibility", enabled ? "visible" : "none");
    if (!enabled && tooltipRef.current) setTooltipHidden(tooltipRef.current, true);
  };

  const recreateMap = () => {
    if (!containerRef.current) return;
    const token = (recreateTokenRef.current += 1);

    const prev = mapRef.current;
    const camera = prev ? getCamera(prev) : null;
    if (prev) {
      teardownListeners(prev);
      try {
        (prev as unknown as { remove: () => void }).remove();
      } catch {
        // ignore
      }
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
          zoom: 12.5,
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
          if (!tooltipRef.current) tooltipRef.current = createTooltip(m.getContainer());
          setTooltipHidden(tooltipRef.current, true);
          ensureDemo(m);
          ensureListeners(m);
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
        zoom: 12.5,
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
        if (!tooltipRef.current) tooltipRef.current = createTooltip(m.getContainer());
        setTooltipHidden(tooltipRef.current, true);
        ensureDemo(m);
        ensureListeners(m);
        if (camera) map.jumpTo(camera as never);
      });
    })().catch(() => {
      // ignore
    });
  };

  useEffect(() => {
    recreateMap();
    return () => {
      recreateTokenRef.current += 1;
      const map = mapRef.current;
      if (!map) return;
      teardownListeners(map);
      tooltipRef.current?.remove();
      tooltipRef.current = null;
      try {
        (map as unknown as { remove: () => void }).remove();
      } catch {
        // ignore
      }
      mapRef.current = null;
    };
    // Recreate map on engine only (different library instance).
  }, [engine]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    const camera = getCamera(map);
    map.setStyle(style);
    map.once("style.load", () => {
      map.jumpTo(camera);
      map.resize();
      ensureDemo(map);
      ensureListeners(map);
      applyPaint(map);
    });
  }, [style, loaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    applyPaint(map);
  }, [enabled, pointColor, pointRadius, loaded]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="panel status-panel absolute left-4 top-16 z-10 p-3">
        <div className="status-panel__message">
          Hover the green points. Tooltip follows cursor (throttled by rAF).
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
              map.flyTo({
                center: [10.7522, 59.9139],
                zoom: 12.5,
                duration: 800,
              });
            }}
          >
            Reset View
          </button>
        </div>
      </div>
    </div>
  );
}
