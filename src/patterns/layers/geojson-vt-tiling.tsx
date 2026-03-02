import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import geojsonvt from "geojson-vt";
import type { Pattern, PatternViewProps, Theme } from "../../types";
import { mapboxBasemapProvider, openFreeMapBasemapProvider } from "../../providers";
import { getSource, once } from "../utils/map-compat";
import { loadMapboxGL, loadMapLibreGL } from "../utils/load-map-engine";

type Engine = "mapbox" | "maplibre";
type Mode = "raw" | "tiled";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const SRC_RAW = "geojsonvt-raw-src";
const LYR_RAW_FILL = "geojsonvt-raw-fill";
const LYR_RAW_LINE = "geojsonvt-raw-line";
const SRC_TILED = "geojsonvt-tiled-src";
const LYR_TILED_FILL = "geojsonvt-tiled-fill";
const LYR_TILED_LINE = "geojsonvt-tiled-line";

const CENTER: [number, number] = [11.0, 61.83];
const FEATURE_COUNT = 1500;

function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
}

function buildLargeDataset(count: number): GeoJSON.FeatureCollection {
  const rand = seededRng(31337);
  const features: GeoJSON.Feature[] = [];

  for (let i = 0; i < count; i++) {
    const cx = CENTER[0] - 1.0 + rand() * 2.0;
    const cy = CENTER[1] - 1.0 + rand() * 2.0;
    const vertices = 6 + Math.floor(rand() * 3);
    const baseR = 0.002 + rand() * 0.004;
    const coords: [number, number][] = [];

    for (let v = 0; v < vertices; v++) {
      const angle = (2 * Math.PI * v) / vertices;
      const r = baseR * (0.7 + 0.6 * rand());
      coords.push([
        cx + (r / Math.cos((cy * Math.PI) / 180)) * Math.cos(angle),
        cy + r * Math.sin(angle),
      ]);
    }
    coords.push(coords[0]);

    features.push({
      type: "Feature",
      properties: { id: i, name: `hex-${i}` },
      geometry: { type: "Polygon", coordinates: [coords] },
    });
  }

  return { type: "FeatureCollection", features };
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

function tileFeaturesToGeoJSON(
  tile: ReturnType<ReturnType<typeof geojsonvt>["getTile"]>,
  z: number,
  x: number,
  y: number,
  extent: number
): GeoJSON.FeatureCollection {
  if (!tile || !tile.features) return { type: "FeatureCollection", features: [] };

  const size = 1 << z;
  const features: GeoJSON.Feature[] = [];

  for (const tf of tile.features) {
    if (tf.type === 3) {
      const rings = tf.geometry as unknown as number[][][];
      const coords: [number, number][][] = rings.map((ring) =>
        ring.map(([px, py]) => {
          const lng = ((x + px / extent) / size) * 360 - 180;
          const latRad = Math.atan(
            Math.sinh(Math.PI - (2 * Math.PI * (y + py / extent)) / size)
          );
          return [lng, (latRad * 180) / Math.PI] as [number, number];
        })
      );
      features.push({
        type: "Feature",
        properties: tf.tags ?? {},
        geometry: { type: "Polygon", coordinates: coords },
      });
    } else if (tf.type === 2) {
      const lines = tf.geometry as unknown as number[][][];
      for (const line of lines) {
        const coords = line.map(([px, py]) => {
          const lng = ((x + px / extent) / size) * 360 - 180;
          const latRad = Math.atan(
            Math.sinh(Math.PI - (2 * Math.PI * (y + py / extent)) / size)
          );
          return [lng, (latRad * 180) / Math.PI] as [number, number];
        });
        features.push({
          type: "Feature",
          properties: tf.tags ?? {},
          geometry: { type: "LineString", coordinates: coords },
        });
      }
    } else if (tf.type === 1) {
      const points = tf.geometry as unknown as number[][];
      for (const [px, py] of points) {
        const lng = ((x + px / extent) / size) * 360 - 180;
        const latRad = Math.atan(
          Math.sinh(Math.PI - (2 * Math.PI * (y + py / extent)) / size)
        );
        features.push({
          type: "Feature",
          properties: tf.tags ?? {},
          geometry: { type: "Point", coordinates: [lng, (latRad * 180) / Math.PI] },
        });
      }
    }
  }

  return { type: "FeatureCollection", features };
}

function getVisibleTileCoords(
  map: MapboxMap | MapLibreMap,
  z: number
): { x: number; y: number }[] {
  const bounds = map.getBounds();
  if (!bounds) return [];

  const size = 1 << z;

  const lngToTileX = (lng: number) =>
    Math.floor(((lng + 180) / 360) * size);
  const latToTileY = (lat: number) => {
    const latRad = (lat * Math.PI) / 180;
    return Math.floor(
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * size
    );
  };

  const west = Math.max(bounds.getWest(), -180);
  const east = Math.min(bounds.getEast(), 180);
  const north = Math.min(bounds.getNorth(), 85.051);
  const south = Math.max(bounds.getSouth(), -85.051);

  const minX = Math.max(0, lngToTileX(west));
  const maxX = Math.min(size - 1, lngToTileX(east));
  const minY = Math.max(0, latToTileY(north));
  const maxY = Math.min(size - 1, latToTileY(south));

  const tiles: { x: number; y: number }[] = [];
  for (let tx = minX; tx <= maxX; tx++) {
    for (let ty = minY; ty <= maxY; ty++) {
      tiles.push({ x: tx, y: ty });
    }
  }
  return tiles;
}

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

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function GeojsonVtTilingView({ theme, onPrimaryMapReady }: PatternViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | MapLibreMap | null>(null);
  const recreateTokenRef = useRef(0);
  const tileIndexRef = useRef<ReturnType<typeof geojsonvt> | null>(null);

  const [engine, setEngine] = useState<Engine>("mapbox");
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<Mode>("tiled");
  const [featureCount] = useState(FEATURE_COUNT);
  const [visibleFeatures, setVisibleFeatures] = useState(0);
  const [visibleCoords, setVisibleCoords] = useState(0);
  const [tileCount, setTileCount] = useState(0);
  const [indexTime, setIndexTime] = useState(0);

  const rawData = useMemo(() => buildLargeDataset(featureCount), [featureCount]);

  const totalCoords = useMemo(() => countCoordinates(rawData), [rawData]);
  const style = useMemo(() => styleFor(engine, theme), [engine, theme]);

  useEffect(() => {
    const t0 = performance.now();
    tileIndexRef.current = geojsonvt(rawData, {
      maxZoom: 18,
      tolerance: 3,
      extent: 4096,
      buffer: 64,
      indexMaxZoom: 5,
      indexMaxPoints: 100000,
    });
    setIndexTime(Math.round(performance.now() - t0));
  }, [rawData]);

  const updateTiledSource = useCallback(() => {
    const map = mapRef.current;
    const index = tileIndexRef.current;
    if (!map || !index) return;

    const z = Math.floor(map.getZoom());
    const tiles = getVisibleTileCoords(map, z);
    const allFeatures: GeoJSON.Feature[] = [];

    for (const { x, y } of tiles) {
      const tile = index.getTile(z, x, y);
      if (!tile) continue;
      const fc = tileFeaturesToGeoJSON(tile, z, x, y, 4096);
      allFeatures.push(...fc.features);
    }

    const combined: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: allFeatures,
    };

    const src = getSource(map, SRC_TILED) as { setData?: (d: unknown) => void } | null;
    if (src?.setData) src.setData(combined);

    setTileCount(tiles.length);
    setVisibleFeatures(allFeatures.length);
    setVisibleCoords(countCoordinates(combined));
  }, []);

  const ensureLayers = useCallback(
    (map: MapboxMap | MapLibreMap) => {
      const m = map as unknown as {
        getSource: (id: string) => unknown;
        addSource: (id: string, source: unknown) => void;
        getLayer: (id: string) => unknown;
        addLayer: (layer: unknown) => void;
        setLayoutProperty: (id: string, prop: string, val: string) => void;
      };

      if (!m.getSource(SRC_RAW)) {
        m.addSource(SRC_RAW, { type: "geojson", data: rawData });
      }
      if (!m.getSource(SRC_TILED)) {
        m.addSource(SRC_TILED, { type: "geojson", data: EMPTY_FC });
      }

      if (!m.getLayer(LYR_RAW_FILL)) {
        m.addLayer({
          id: LYR_RAW_FILL,
          type: "fill",
          source: SRC_RAW,
          paint: { "fill-color": "#3b82f6", "fill-opacity": 0.3 },
        });
      }
      if (!m.getLayer(LYR_RAW_LINE)) {
        m.addLayer({
          id: LYR_RAW_LINE,
          type: "line",
          source: SRC_RAW,
          paint: { "line-color": "#3b82f6", "line-width": 1 },
        });
      }

      if (!m.getLayer(LYR_TILED_FILL)) {
        m.addLayer({
          id: LYR_TILED_FILL,
          type: "fill",
          source: SRC_TILED,
          paint: { "fill-color": "#f59e0b", "fill-opacity": 0.35 },
        });
      }
      if (!m.getLayer(LYR_TILED_LINE)) {
        m.addLayer({
          id: LYR_TILED_LINE,
          type: "line",
          source: SRC_TILED,
          paint: { "line-color": "#f59e0b", "line-width": 1.5 },
        });
      }

      const rawVis = mode === "raw" ? "visible" : "none";
      const tiledVis = mode === "tiled" ? "visible" : "none";
      if (m.getLayer(LYR_RAW_FILL)) m.setLayoutProperty(LYR_RAW_FILL, "visibility", rawVis);
      if (m.getLayer(LYR_RAW_LINE)) m.setLayoutProperty(LYR_RAW_LINE, "visibility", rawVis);
      if (m.getLayer(LYR_TILED_FILL)) m.setLayoutProperty(LYR_TILED_FILL, "visibility", tiledVis);
      if (m.getLayer(LYR_TILED_LINE)) m.setLayoutProperty(LYR_TILED_LINE, "visibility", tiledVis);
    },
    [rawData, mode]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const token = (recreateTokenRef.current += 1);
    const prev = mapRef.current;
    const camera = prev ? getCamera(prev) : null;
    if (prev) {
      try { prev.remove(); } catch { /* ignore */ }
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
          center: camera?.center ?? CENTER,
          zoom: camera?.zoom ?? 10,
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
        center: camera?.center ?? CENTER,
        zoom: camera?.zoom ?? 10,
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
    })().catch(() => { /* ignore */ });

    return () => {
      recreateTokenRef.current += 1;
      const map = mapRef.current;
      if (!map) return;
      try { map.remove(); } catch { /* ignore */ }
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
      if (mode === "tiled") updateTiledSource();
    });
  }, [style, loaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const m = map as unknown as {
      getLayer: (id: string) => unknown;
      setLayoutProperty: (id: string, prop: string, val: string) => void;
    };

    const rawVis = mode === "raw" ? "visible" : "none";
    const tiledVis = mode === "tiled" ? "visible" : "none";
    if (m.getLayer(LYR_RAW_FILL)) m.setLayoutProperty(LYR_RAW_FILL, "visibility", rawVis);
    if (m.getLayer(LYR_RAW_LINE)) m.setLayoutProperty(LYR_RAW_LINE, "visibility", rawVis);
    if (m.getLayer(LYR_TILED_FILL)) m.setLayoutProperty(LYR_TILED_FILL, "visibility", tiledVis);
    if (m.getLayer(LYR_TILED_LINE)) m.setLayoutProperty(LYR_TILED_LINE, "visibility", tiledVis);

    if (mode === "tiled") updateTiledSource();
    if (mode === "raw") {
      setVisibleFeatures(rawData.features.length);
      setVisibleCoords(totalCoords);
      setTileCount(0);
    }
  }, [mode, loaded, rawData, totalCoords, updateTiledSource]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    const handler = () => {
      if (mode === "tiled") updateTiledSource();
    };
    const m = map as unknown as {
      on: (type: string, fn: () => void) => void;
      off: (type: string, fn: () => void) => void;
    };
    m.on("moveend", handler);
    handler();
    return () => { m.off("moveend", handler); };
  }, [loaded, mode, updateTiledSource]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="panel status-panel absolute left-4 top-16 z-10 w-[360px] p-3">
        <div className="status-panel__message">
          Client-side GeoJSON tiling with <strong>geojson-vt</strong>. In tiled mode,
          only features within visible tiles are sent to the map — reducing per-frame cost
          for large datasets.
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

        <div className="status-panel__actions mt-2">
          <button
            type="button"
            className={`status-panel__button ${mode === "raw" ? "primary" : ""}`}
            onClick={() => setMode("raw")}
          >
            Raw GeoJSON
          </button>
          <button
            type="button"
            className={`status-panel__button ${mode === "tiled" ? "primary" : ""}`}
            onClick={() => setMode("tiled")}
          >
            Tiled (geojson-vt)
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-xs">
          <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
            <div className="text-muted">Total Features</div>
            <div className="text-fg">{featureCount.toLocaleString()}</div>
          </div>
          <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
            <div className="text-muted">Visible Features</div>
            <div className="text-fg">{visibleFeatures.toLocaleString()}</div>
          </div>
          <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
            <div className="text-muted">Visible Coords</div>
            <div className="text-fg">{visibleCoords.toLocaleString()}</div>
          </div>
          <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
            <div className="text-muted">Tiles Shown</div>
            <div className="text-fg">{mode === "tiled" ? tileCount : "—"}</div>
          </div>
          <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
            <div className="text-muted">Index Time</div>
            <div className="text-fg">{indexTime} ms</div>
          </div>
          <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
            <div className="text-muted">Mode</div>
            <div className="text-fg capitalize">{mode}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const geojsonVtTilingPattern: Pattern = {
  id: "geojson-vt",
  name: "Client-Side Tiling (geojson-vt)",
  category: "layers",
  description:
    "Render large GeoJSON using client-side tiling with geojson-vt to reduce per-frame cost (dual-engine Mapbox/MapLibre).",
  controls: [],
  disableGlobalSearch: true,
  setup() {},
  cleanup() {},
  update() {},
  view: GeojsonVtTilingView,
  snippet: `import geojsonvt from "geojson-vt";

// Build tile index from full dataset (once)
const tileIndex = geojsonvt(largeFeatureCollection, {
  maxZoom: 18, tolerance: 3, extent: 4096, buffer: 64,
});

// On viewport change, get visible tiles
const z = Math.floor(map.getZoom());
const tile = tileIndex.getTile(z, x, y);

// Convert tile features back to GeoJSON lng/lat
// and setData with only visible features
map.getSource("tiled").setData(visibleFeatures);`,
};
