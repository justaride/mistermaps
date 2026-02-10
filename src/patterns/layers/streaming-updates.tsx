import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Pattern, PatternViewProps, Theme } from "../../types";
import { mapboxBasemapProvider, openFreeMapBasemapProvider } from "../../providers";
import { getSource, once } from "../utils/map-compat";
import { loadMapboxGL, loadMapLibreGL } from "../utils/load-map-engine";

type Engine = "mapbox" | "maplibre";
type LngLat = [number, number];

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const SOURCE_ID = "streaming-updates-src";
const LAYER_ID = "streaming-updates-layer";

type PointProps = {
  id: string;
  ts: number;
  speed: number;
};

type PointFeature = GeoJSON.Feature<GeoJSON.Point, PointProps>;

function styleFor(engine: Engine, theme: Theme): string {
  return engine === "maplibre"
    ? openFreeMapBasemapProvider.getStyle(theme)
    : mapboxBasemapProvider.getStyle(theme);
}

function getCamera(map: MapboxMap | MapLibreMap) {
  const c = map.getCenter();
  return {
    center: [c.lng, c.lat] as [number, number],
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  };
}

function clampNumber(v: unknown, min: number, max: number, fallback: number) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    // xorshift32
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
}

function jitterPoint([lng, lat]: LngLat, meters: number, rand: () => number): LngLat {
  const dLng = (meters / 111_320) * (rand() - 0.5) * 2;
  const dLat = (meters / 110_540) * (rand() - 0.5) * 2;
  return [lng + dLng, lat + dLat];
}

function buildCollection(features: PointFeature[]): GeoJSON.FeatureCollection<GeoJSON.Point, PointProps> {
  return { type: "FeatureCollection", features };
}

export const streamingUpdatesPattern: Pattern = {
  id: "streaming-updates",
  name: "Streaming Updates (setData)",
  category: "layers",
  description:
    "Simulate incremental feature updates over time and keep the map responsive. Demonstrates setData without re-adding layers/sources each tick (dual-engine Mapbox/MapLibre).",
  controls: [],
  disableGlobalSearch: true,
  setup() {},
  cleanup() {},
  update() {},
  view: StreamingUpdatesView,
  snippet: `// Streaming updates: keep the layer/source stable, only call setData
if (!map.getSource(sourceId)) map.addSource(sourceId, { type:'geojson', data: fc });
if (!map.getLayer(layerId)) map.addLayer({ id: layerId, type:'circle', source: sourceId });

// On each tick:
features.push(newFeature); // or update existing
map.getSource(sourceId).setData({ type:'FeatureCollection', features });`,
};

function StreamingUpdatesView({ theme, onPrimaryMapReady }: PatternViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | MapLibreMap | null>(null);
  const recreateTokenRef = useRef(0);

  const [engine, setEngine] = useState<Engine>("mapbox");
  const [loaded, setLoaded] = useState(false);

  const [running, setRunning] = useState(true);
  const [tickMs, setTickMs] = useState(450);
  const [maxFeatures, setMaxFeatures] = useState(160);
  const [tickCount, setTickCount] = useState(0);
  const [featureCount, setFeatureCount] = useState(0);
  const [addSourceCount, setAddSourceCount] = useState(0);
  const [addLayerCount, setAddLayerCount] = useState(0);

  const style = useMemo(() => styleFor(engine, theme), [engine, theme]);

  const featuresRef = useRef<PointFeature[]>([]);
  const seededRandRef = useRef<() => number>(() => 0.5);
  const intervalRef = useRef<number | null>(null);

  const ensureDemo = (map: MapboxMap | MapLibreMap) => {
    const m = map as unknown as {
      getSource: (id: string) => unknown;
      addSource: (id: string, source: unknown) => void;
      getLayer: (id: string) => unknown;
      addLayer: (layer: unknown) => void;
    };

    if (!m.getSource(SOURCE_ID)) {
      m.addSource(SOURCE_ID, {
        type: "geojson",
        data: buildCollection(featuresRef.current),
      });
      setAddSourceCount((c) => c + 1);
    }

    if (!m.getLayer(LAYER_ID)) {
      m.addLayer({
        id: LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-radius": 5.5,
          "circle-color": [
            "interpolate",
            ["linear"],
            ["get", "speed"],
            0,
            "#22c55e",
            1,
            "#f97316",
          ],
          "circle-stroke-color": "#052e16",
          "circle-stroke-width": 2,
          "circle-opacity": 0.9,
        },
      });
      setAddLayerCount((c) => c + 1);
    }
  };

  const setDataOnMap = (map: MapboxMap | MapLibreMap) => {
    const src = getSource(map, SOURCE_ID) as { setData?: (d: unknown) => void };
    src.setData?.(buildCollection(featuresRef.current));
  };

  const seedDemo = () => {
    const rand = rng(1337);
    seededRandRef.current = rand;
    const center: LngLat = [10.7522, 59.9139];
    const start = 25;
    const features: PointFeature[] = [];
    for (let i = 0; i < start; i += 1) {
      const coords = jitterPoint(center, 2200, rand);
      const speed = rand();
      features.push({
        type: "Feature",
        id: `pt-${i}`,
        properties: { id: `pt-${i}`, ts: Date.now(), speed },
        geometry: { type: "Point", coordinates: coords },
      });
    }
    featuresRef.current = features;
    setTickCount(0);
    setFeatureCount(features.length);
  };

  const tick = () => {
    const map = mapRef.current;
    if (!map) return;
    if (!loaded) return;
    if (!running) return;

    const rand = seededRandRef.current;
    const center: LngLat = [10.7522, 59.9139];
    const next = featuresRef.current.slice();

    // Update a few points in-place (move + change property)
    const updates = Math.min(12, next.length);
    for (let i = 0; i < updates; i += 1) {
      const idx = Math.floor(rand() * next.length);
      const f = next[idx];
      const coords = f.geometry.coordinates as LngLat;
      const moved = jitterPoint(coords, 420, rand);
      next[idx] = {
        ...f,
        properties: { ...f.properties, ts: Date.now(), speed: rand() },
        geometry: { type: "Point", coordinates: moved },
      };
    }

    // Append a new point until we hit maxFeatures
    if (next.length < maxFeatures) {
      const id = `pt-${next.length}`;
      next.push({
        type: "Feature",
        id,
        properties: { id, ts: Date.now(), speed: rand() },
        geometry: { type: "Point", coordinates: jitterPoint(center, 3200, rand) },
      });
    }

    featuresRef.current = next;
    setDataOnMap(map);
    setTickCount((c) => c + 1);
    setFeatureCount(next.length);
  };

  const recreateMap = () => {
    if (!containerRef.current) return;
    const token = (recreateTokenRef.current += 1);
    const prev = mapRef.current;
    const camera = prev ? getCamera(prev) : null;
    if (prev) {
      try {
        prev.remove();
      } catch {
        // ignore
      }
      mapRef.current = null;
    }

    setLoaded(false);
    setAddSourceCount(0);
    setAddLayerCount(0);

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
        mapRef.current = map;
        map.on("load", () => {
          if (recreateTokenRef.current !== token) return;
          setLoaded(true);
          onPrimaryMapReady?.(map);
          ensureDemo(map);
          setDataOnMap(map);
          if (camera) map.jumpTo(camera);
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
      mapRef.current = map;
      map.on("load", () => {
        if (recreateTokenRef.current !== token) return;
        setLoaded(true);
        onPrimaryMapReady?.(map as unknown as MapboxMap);
        ensureDemo(map);
        setDataOnMap(map);
        if (camera) map.jumpTo(camera as never);
      });
    })().catch(() => {
      // ignore
    });
  };

  useEffect(() => {
    seedDemo();
  }, []);

  useEffect(() => {
    recreateMap();
    return () => {
      recreateTokenRef.current += 1;
      const map = mapRef.current;
      if (!map) return;
      try {
        map.remove();
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
    once(map, "style.load", () => {
      map.jumpTo(camera as never);
      map.resize();
      ensureDemo(map);
      setDataOnMap(map);
    });
  }, [style, loaded]);

  useEffect(() => {
    const clear = () => {
      if (intervalRef.current != null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    clear();
    if (!running) return clear;

    const ms = clampNumber(tickMs, 120, 2000, 450);
    intervalRef.current = window.setInterval(tick, ms);
    return clear;
  }, [running, tickMs, loaded, maxFeatures]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="panel status-panel absolute left-4 top-16 z-10 w-[360px] p-3">
        <div className="status-panel__message">
          Streaming updates: a stable GeoJSON source + layer, updated via{" "}
          <span className="font-mono">setData</span>.
        </div>

        <div className="status-panel__actions">
          <button
            type="button"
            className={`status-panel__button ${engine === "mapbox" ? "primary" : ""}`}
            onClick={() => setEngine("mapbox")}
          >
            Mapbox
          </button>
          <button
            type="button"
            className={`status-panel__button ${engine === "maplibre" ? "primary" : ""}`}
            onClick={() => setEngine("maplibre")}
          >
            MapLibre
          </button>
          <button
            type="button"
            className="status-panel__button"
            onClick={() => setRunning((r) => !r)}
          >
            {running ? "Pause" : "Resume"}
          </button>
          <button
            type="button"
            className="status-panel__button"
            onClick={() => {
              seedDemo();
              const map = mapRef.current;
              if (!map || !loaded) return;
              setDataOnMap(map);
            }}
          >
            Reset
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 font-mono text-xs">
          <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
            <div className="text-muted">Tick</div>
            <div className="text-fg">{tickCount}</div>
          </div>
          <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
            <div className="text-muted">Features</div>
            <div className="text-fg">{featureCount}</div>
          </div>
          <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
            <div className="text-muted">addSource calls</div>
            <div className="text-fg">{addSourceCount}</div>
          </div>
          <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
            <div className="text-muted">addLayer calls</div>
            <div className="text-fg">{addLayerCount}</div>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-widest text-muted">
            Tick interval (ms)
          </div>
          <input
            type="range"
            min={120}
            max={2000}
            step={10}
            value={tickMs}
            onChange={(e) => setTickMs(Number(e.target.value))}
            className="w-full"
          />
          <div className="mt-1 font-mono text-[11px] text-muted">
            {tickMs}ms
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-widest text-muted">
            Max features
          </div>
          <input
            type="range"
            min={20}
            max={400}
            step={10}
            value={maxFeatures}
            onChange={(e) => setMaxFeatures(Number(e.target.value))}
            className="w-full"
          />
          <div className="mt-1 font-mono text-[11px] text-muted">
            {maxFeatures}
          </div>
        </div>
      </div>
    </div>
  );
}
