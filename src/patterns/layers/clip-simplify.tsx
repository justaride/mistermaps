import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import * as turf from "@turf/turf";
import type { Pattern, PatternViewProps, Theme } from "../../types";
import { mapboxBasemapProvider, openFreeMapBasemapProvider } from "../../providers";
import { getSource, once } from "../utils/map-compat";
import { loadMapboxGL, loadMapLibreGL } from "../utils/load-map-engine";

type Engine = "mapbox" | "maplibre";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const SRC_ORIGINAL = "clip-simplify-original";
const SRC_PROCESSED = "clip-simplify-processed";
const LYR_ORIGINAL_FILL = "clip-simplify-original-fill";
const LYR_ORIGINAL_LINE = "clip-simplify-original-line";
const LYR_PROCESSED_FILL = "clip-simplify-processed-fill";
const LYR_PROCESSED_LINE = "clip-simplify-processed-line";

const CENTER: [number, number] = [11.0, 61.83];

type Stats = {
  originalFeatures: number;
  originalCoords: number;
  processedFeatures: number;
  processedCoords: number;
};

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

function buildIrregularPolygon(
  center: [number, number],
  baseRadius: number,
  points: number,
  seed: number
): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = [];
  let s = seed >>> 0;
  const rand = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };

  for (let i = 0; i < points; i++) {
    const angle = (2 * Math.PI * i) / points;
    const r = baseRadius * (0.6 + 0.8 * rand());
    const lng = center[0] + (r / 111320) * Math.cos(angle);
    const lat = center[1] + (r / 110540) * Math.sin(angle);
    coords.push([lng, lat]);
  }
  coords.push(coords[0]);

  return {
    type: "Feature",
    properties: { name: `polygon-${seed}` },
    geometry: { type: "Polygon", coordinates: [coords] },
  };
}

function buildWindingLine(seed: number): GeoJSON.Feature<GeoJSON.LineString> {
  const coords: [number, number][] = [];
  let s = seed >>> 0;
  const rand = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };

  let lng = CENTER[0] - 0.08;
  let lat = CENTER[1] - 0.04;
  for (let i = 0; i < 60; i++) {
    lng += 0.003 + rand() * 0.002;
    lat += (rand() - 0.5) * 0.004;
    coords.push([lng, lat]);
  }

  return {
    type: "Feature",
    properties: { name: "winding-line" },
    geometry: { type: "LineString", coordinates: coords },
  };
}

function buildSampleData(): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      buildIrregularPolygon([CENTER[0] - 0.05, CENTER[1] + 0.02], 2800, 30, 42),
      buildIrregularPolygon([CENTER[0] + 0.04, CENTER[1] + 0.01], 2200, 25, 137),
      buildIrregularPolygon([CENTER[0] + 0.02, CENTER[1] - 0.03], 3200, 40, 999),
      buildWindingLine(7331),
    ],
  };
}

function countCoordinates(fc: GeoJSON.FeatureCollection): number {
  let count = 0;
  for (const f of fc.features) {
    const g = f.geometry;
    if (!g) continue;
    switch (g.type) {
      case "Point":
        count += 1;
        break;
      case "MultiPoint":
      case "LineString":
        count += g.coordinates.length;
        break;
      case "MultiLineString":
      case "Polygon":
        for (const ring of g.coordinates) count += ring.length;
        break;
      case "MultiPolygon":
        for (const poly of g.coordinates)
          for (const ring of poly) count += ring.length;
        break;
    }
  }
  return count;
}

type ProcessOpts = {
  clip: boolean;
  simplify: boolean;
  tolerance: number;
  bbox: [number, number, number, number] | null;
};

function processData(
  original: GeoJSON.FeatureCollection,
  opts: ProcessOpts
): GeoJSON.FeatureCollection {
  let features = original.features;

  if (opts.clip && opts.bbox) {
    features = features
      .map((f) => {
        try {
          return turf.bboxClip(
            f as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon | GeoJSON.LineString | GeoJSON.MultiLineString>,
            opts.bbox!
          ) as GeoJSON.Feature;
        } catch {
          return f;
        }
      })
      .filter((f) => {
        const g = f.geometry;
        if (!g) return false;
        if (g.type === "Point") return true;
        if ("coordinates" in g) {
          const c = g.coordinates as unknown[];
          if (Array.isArray(c) && c.length === 0) return false;
          if (g.type === "Polygon" || g.type === "MultiLineString") {
            return (c as unknown[][]).some((ring) => ring.length > 0);
          }
          if (g.type === "MultiPolygon") {
            return (c as unknown[][][]).some((poly) =>
              poly.some((ring) => ring.length > 0)
            );
          }
        }
        return true;
      });
  }

  if (opts.simplify) {
    features = features.map((f) => {
      try {
        return turf.simplify(f as GeoJSON.Feature, {
          tolerance: opts.tolerance,
          highQuality: true,
        }) as GeoJSON.Feature;
      } catch {
        return f;
      }
    });
  }

  return { type: "FeatureCollection", features };
}

function ClipSimplifyView({ theme, onPrimaryMapReady }: PatternViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | MapLibreMap | null>(null);
  const recreateTokenRef = useRef(0);

  const [engine, setEngine] = useState<Engine>("mapbox");
  const [loaded, setLoaded] = useState(false);

  const [enableClip, setEnableClip] = useState(false);
  const [enableSimplify, setEnableSimplify] = useState(false);
  const [tolerance, setTolerance] = useState(0.01);
  const [showOriginal, setShowOriginal] = useState(true);
  const [stats, setStats] = useState<Stats>({
    originalFeatures: 0,
    originalCoords: 0,
    processedFeatures: 0,
    processedCoords: 0,
  });

  const originalData = useMemo(() => buildSampleData(), []);
  const style = useMemo(() => styleFor(engine, theme), [engine, theme]);

  const getBbox = useCallback((): [number, number, number, number] | null => {
    const map = mapRef.current;
    if (!map) return null;
    const b = map.getBounds();
    if (!b) return null;
    return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
  }, []);

  const updateProcessed = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const bbox = enableClip ? getBbox() : null;
    const processed = processData(originalData, {
      clip: enableClip,
      simplify: enableSimplify,
      tolerance,
      bbox,
    });

    const src = getSource(map, SRC_PROCESSED) as { setData?: (d: unknown) => void } | null;
    if (src?.setData) src.setData(processed);

    setStats({
      originalFeatures: originalData.features.length,
      originalCoords: countCoordinates(originalData),
      processedFeatures: processed.features.length,
      processedCoords: countCoordinates(processed),
    });
  }, [originalData, enableClip, enableSimplify, tolerance, getBbox]);

  const ensureLayers = useCallback(
    (map: MapboxMap | MapLibreMap) => {
      const m = map as unknown as {
        getSource: (id: string) => unknown;
        addSource: (id: string, source: unknown) => void;
        getLayer: (id: string) => unknown;
        addLayer: (layer: unknown) => void;
      };

      if (!m.getSource(SRC_ORIGINAL)) {
        m.addSource(SRC_ORIGINAL, { type: "geojson", data: originalData });
      }

      if (!m.getSource(SRC_PROCESSED)) {
        const bbox = enableClip ? getBbox() : null;
        const processed = processData(originalData, {
          clip: enableClip,
          simplify: enableSimplify,
          tolerance,
          bbox,
        });
        m.addSource(SRC_PROCESSED, { type: "geojson", data: processed });
      }

      if (!m.getLayer(LYR_ORIGINAL_FILL)) {
        m.addLayer({
          id: LYR_ORIGINAL_FILL,
          type: "fill",
          source: SRC_ORIGINAL,
          paint: {
            "fill-color": "#6366f1",
            "fill-opacity": 0.15,
          },
          filter: ["any", ["==", "$type", "Polygon"], ["==", "$type", "MultiPolygon"]],
        });
      }

      if (!m.getLayer(LYR_ORIGINAL_LINE)) {
        m.addLayer({
          id: LYR_ORIGINAL_LINE,
          type: "line",
          source: SRC_ORIGINAL,
          paint: {
            "line-color": "#6366f1",
            "line-width": 1.5,
            "line-dasharray": [4, 3],
            "line-opacity": 0.5,
          },
        });
      }

      if (!m.getLayer(LYR_PROCESSED_FILL)) {
        m.addLayer({
          id: LYR_PROCESSED_FILL,
          type: "fill",
          source: SRC_PROCESSED,
          paint: {
            "fill-color": "#f59e0b",
            "fill-opacity": 0.4,
          },
          filter: ["any", ["==", "$type", "Polygon"], ["==", "$type", "MultiPolygon"]],
        });
      }

      if (!m.getLayer(LYR_PROCESSED_LINE)) {
        m.addLayer({
          id: LYR_PROCESSED_LINE,
          type: "line",
          source: SRC_PROCESSED,
          paint: {
            "line-color": "#f59e0b",
            "line-width": 2,
          },
        });
      }
    },
    [originalData, enableClip, enableSimplify, tolerance, getBbox]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const token = (recreateTokenRef.current += 1);
    const prev = mapRef.current;
    const camera = prev ? getCamera(prev) : null;
    if (prev) {
      try {
        prev.remove();
      } catch {
        /* ignore */
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
          center: CENTER,
          zoom: 11,
        });
        map.addControl(new mapboxgl.NavigationControl(), "top-right");
        mapRef.current = map;
        map.on("load", () => {
          if (recreateTokenRef.current !== token) return;
          setLoaded(true);
          onPrimaryMapReady?.(map);
          ensureLayers(map);
          if (camera) map.jumpTo(camera);
        });
        return;
      }

      const maplibregl = await loadMapLibreGL();
      if (recreateTokenRef.current !== token) return;
      const map = new maplibregl.Map({
        container: containerRef.current!,
        style,
        center: CENTER,
        zoom: 11,
      });
      map.addControl(new maplibregl.NavigationControl(), "top-right");
      mapRef.current = map;
      map.on("load", () => {
        if (recreateTokenRef.current !== token) return;
        setLoaded(true);
        onPrimaryMapReady?.(map as unknown as MapboxMap);
        ensureLayers(map);
        if (camera) map.jumpTo(camera as never);
      });
    })().catch(() => {
      /* ignore */
    });

    return () => {
      recreateTokenRef.current += 1;
      const map = mapRef.current;
      if (!map) return;
      try {
        map.remove();
      } catch {
        /* ignore */
      }
      mapRef.current = null;
    };
  }, [engine]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const camera = getCamera(map);
    map.setStyle(style);
    once(map, "style.load", () => {
      map.jumpTo(camera as never);
      map.resize();
      ensureLayers(map);
      updateProcessed();
    });
  }, [style, loaded]);

  useEffect(() => {
    if (!loaded) return;
    updateProcessed();
  }, [enableClip, enableSimplify, tolerance, loaded, updateProcessed]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const vis = showOriginal ? "visible" : "none";
    const m = map as unknown as {
      getLayer: (id: string) => unknown;
      setLayoutProperty: (id: string, prop: string, val: string) => void;
    };
    if (m.getLayer(LYR_ORIGINAL_FILL)) m.setLayoutProperty(LYR_ORIGINAL_FILL, "visibility", vis);
    if (m.getLayer(LYR_ORIGINAL_LINE)) m.setLayoutProperty(LYR_ORIGINAL_LINE, "visibility", vis);
  }, [showOriginal, loaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !enableClip) return;
    const handler = () => updateProcessed();
    const m = map as unknown as {
      on: (type: string, fn: () => void) => void;
      off: (type: string, fn: () => void) => void;
    };
    m.on("moveend", handler);
    return () => {
      m.off("moveend", handler);
    };
  }, [enableClip, loaded, updateProcessed]);

  const reduction =
    stats.originalCoords > 0
      ? Math.round((1 - stats.processedCoords / stats.originalCoords) * 100)
      : 0;

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="panel status-panel absolute left-4 top-16 z-10 w-[360px] p-3">
        <div className="status-panel__message">
          Client-side GeoJSON clipping to viewport bounds and Douglas-Peucker
          simplification using Turf.js.
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
        </div>

        <div className="mt-3 space-y-2">
          <label className="flex items-center gap-2 font-mono text-xs text-fg">
            <input
              type="checkbox"
              checked={enableClip}
              onChange={(e) => setEnableClip(e.target.checked)}
            />
            Clip to Viewport
          </label>

          <label className="flex items-center gap-2 font-mono text-xs text-fg">
            <input
              type="checkbox"
              checked={enableSimplify}
              onChange={(e) => setEnableSimplify(e.target.checked)}
            />
            Simplify (Douglas-Peucker)
          </label>
        </div>

        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-widest text-muted">
            Tolerance
          </div>
          <input
            type="range"
            min={0.001}
            max={0.1}
            step={0.001}
            value={tolerance}
            onChange={(e) => setTolerance(Number(e.target.value))}
            className="w-full"
            disabled={!enableSimplify}
          />
          <div className="mt-1 font-mono text-[11px] text-muted">
            {tolerance.toFixed(3)}
          </div>
        </div>

        <div className="mt-3">
          <label className="flex items-center gap-2 font-mono text-xs text-fg">
            <input
              type="checkbox"
              checked={showOriginal}
              onChange={(e) => setShowOriginal(e.target.checked)}
            />
            Show Original (ghost)
          </label>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-xs">
          <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
            <div className="text-muted">Orig Features</div>
            <div className="text-fg">{stats.originalFeatures}</div>
          </div>
          <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
            <div className="text-muted">Orig Coords</div>
            <div className="text-fg">{stats.originalCoords}</div>
          </div>
          <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
            <div className="text-muted">Reduction</div>
            <div className="text-fg">{reduction}%</div>
          </div>
          <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
            <div className="text-muted">Proc Features</div>
            <div className="text-fg">{stats.processedFeatures}</div>
          </div>
          <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
            <div className="text-muted">Proc Coords</div>
            <div className="text-fg">{stats.processedCoords}</div>
          </div>
          <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
            <div className="text-muted">Engine</div>
            <div className="text-fg capitalize">{engine}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const clipSimplifyPattern: Pattern = {
  id: "clip-simplify",
  name: "Viewport Clip + Simplification",
  category: "layers",
  description:
    "Client-side GeoJSON clipping to viewport bounds and Douglas-Peucker simplification using Turf.js (dual-engine Mapbox/MapLibre).",
  controls: [],
  disableGlobalSearch: true,
  setup() {},
  cleanup() {},
  update() {},
  view: ClipSimplifyView,
  snippet: `import * as turf from "@turf/turf";

// Clip features to current viewport
const bbox = map.getBounds();
const clipped = turf.bboxClip(feature, [bbox.getWest(), bbox.getSouth(), bbox.getEast(), bbox.getNorth()]);

// Simplify with Douglas-Peucker
const simplified = turf.simplify(feature, { tolerance: 0.01, highQuality: true });

// Update map source
map.getSource(sourceId).setData(processedCollection);`,
};
