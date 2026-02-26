import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import * as turf from '@turf/turf';
import type { Pattern, PatternViewProps, Theme } from '../../types';
import { mapboxBasemapProvider, openFreeMapBasemapProvider } from '../../providers';
import { getSource, once } from '../utils/map-compat';
import { loadMapboxGL, loadMapLibreGL } from '../utils/load-map-engine';

type Engine = 'mapbox' | 'maplibre';
type ColorScheme = 'warm' | 'cool';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const CENTER: [number, number] = [11.0, 61.83];

const BBOX: [number, number, number, number] = [
  CENTER[0] - 0.15, CENTER[1] - 0.1,
  CENTER[0] + 0.15, CENTER[1] + 0.1,
];

const SRC_HEXBIN = 'hexbin-src';
const SRC_POINTS = 'hexbin-pts-src';
const LYR_FILL = 'hexbin-fill';
const LYR_LINE = 'hexbin-line';
const LYR_POINTS = 'hexbin-pts-layer';

function styleFor(engine: Engine, theme: Theme): string {
  return engine === 'maplibre'
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

function generatePoints(): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return turf.randomPoint(500, { bbox: BBOX }) as GeoJSON.FeatureCollection<GeoJSON.Point>;
}

function computeHexbins(
  points: GeoJSON.FeatureCollection<GeoJSON.Point>,
  cellSize: number
): GeoJSON.FeatureCollection {
  const grid = turf.hexGrid(BBOX, cellSize, { units: 'kilometers' });
  for (const hex of grid.features) {
    const within = turf.pointsWithinPolygon(points, hex as any);
    hex.properties = { ...hex.properties, count: within.features.length };
  }
  return grid as GeoJSON.FeatureCollection;
}

function colorExpression(scheme: ColorScheme) {
  return scheme === 'warm'
    ? ['interpolate', ['linear'], ['get', 'count'], 0, '#fef3c7', 5, '#f59e0b', 15, '#dc2626', 30, '#7f1d1d']
    : ['interpolate', ['linear'], ['get', 'count'], 0, '#ecfdf5', 5, '#34d399', 15, '#0ea5e9', 30, '#1e3a5f'];
}

function HexbinGridView({ theme, onPrimaryMapReady }: PatternViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | MapLibreMap | null>(null);
  const recreateTokenRef = useRef(0);

  const [engine, setEngine] = useState<Engine>('mapbox');
  const [loaded, setLoaded] = useState(false);
  const [cellSize, setCellSize] = useState(1);
  const [colorScheme, setColorScheme] = useState<ColorScheme>('warm');

  const points = useMemo(() => generatePoints(), []);
  const hexbins = useMemo(() => computeHexbins(points, cellSize), [points, cellSize]);
  const style = useMemo(() => styleFor(engine, theme), [engine, theme]);

  const nonEmptyCount = useMemo(
    () => hexbins.features.filter((f) => (f.properties?.count ?? 0) > 0).length,
    [hexbins]
  );

  const ensureLayers = useCallback(
    (map: MapboxMap | MapLibreMap) => {
      const m = map as unknown as {
        getSource: (id: string) => unknown;
        addSource: (id: string, source: unknown) => void;
        getLayer: (id: string) => unknown;
        addLayer: (layer: unknown) => void;
      };

      if (!m.getSource(SRC_POINTS)) {
        m.addSource(SRC_POINTS, { type: 'geojson', data: points });
      }

      if (!m.getSource(SRC_HEXBIN)) {
        m.addSource(SRC_HEXBIN, { type: 'geojson', data: hexbins });
      }

      if (!m.getLayer(LYR_FILL)) {
        m.addLayer({
          id: LYR_FILL,
          type: 'fill',
          source: SRC_HEXBIN,
          paint: {
            'fill-color': colorExpression(colorScheme),
            'fill-opacity': 0.7,
          },
        });
      }

      if (!m.getLayer(LYR_LINE)) {
        m.addLayer({
          id: LYR_LINE,
          type: 'line',
          source: SRC_HEXBIN,
          paint: {
            'line-color': '#374151',
            'line-width': 0.5,
            'line-opacity': 0.4,
          },
        });
      }

      if (!m.getLayer(LYR_POINTS)) {
        m.addLayer({
          id: LYR_POINTS,
          type: 'circle',
          source: SRC_POINTS,
          paint: {
            'circle-radius': 2,
            'circle-color': '#6b7280',
            'circle-opacity': 0.4,
          },
        });
      }
    },
    [points, hexbins, colorScheme]
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
      if (engine === 'mapbox') {
        const mapboxgl = await loadMapboxGL();
        if (recreateTokenRef.current !== token) return;
        mapboxgl.accessToken = MAPBOX_TOKEN;
        const map = new mapboxgl.Map({
          container: containerRef.current!,
          style,
          center: camera?.center ?? CENTER,
          zoom: camera?.zoom ?? 11,
        });
        map.addControl(new mapboxgl.NavigationControl(), 'top-right');
        mapRef.current = map;
        map.on('load', () => {
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
        zoom: camera?.zoom ?? 11,
      });
      map.addControl(new maplibregl.NavigationControl(), 'top-right');
      mapRef.current = map;
      map.on('load', () => {
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
    once(map, 'style.load', () => {
      map.jumpTo(camera as never);
      map.resize();
      ensureLayers(map);
    });
  }, [style, loaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const src = getSource(map, SRC_HEXBIN) as { setData?: (d: unknown) => void } | null;
    if (src?.setData) src.setData(hexbins);
    (map as any).setPaintProperty(LYR_FILL, 'fill-color', colorExpression(colorScheme));
  }, [hexbins, colorScheme, loaded]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="panel status-panel absolute left-4 top-16 z-10 w-[360px] p-3">
        <div className="status-panel__message">
          Aggregate random points into hexagonal bins with data-driven fill
          colors using Turf.js hexGrid and pointsWithinPolygon.
        </div>

        <div className="status-panel__actions">
          <button
            type="button"
            className={`status-panel__button ${engine === 'mapbox' ? 'primary' : ''}`}
            onClick={() => setEngine('mapbox')}
          >
            Mapbox
          </button>
          <button
            type="button"
            className={`status-panel__button ${engine === 'maplibre' ? 'primary' : ''}`}
            onClick={() => setEngine('maplibre')}
          >
            MapLibre
          </button>
        </div>

        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-widest text-muted">
            Cell Size (km)
          </div>
          <input
            type="range"
            min={0.5}
            max={5}
            step={0.5}
            value={cellSize}
            onChange={(e) => setCellSize(Number(e.target.value))}
            className="w-full"
          />
          <div className="mt-1 font-mono text-[11px] text-muted">
            {cellSize.toFixed(1)} km
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-widest text-muted">
            Color Scheme
          </div>
          <div className="status-panel__actions">
            <button
              type="button"
              className={`status-panel__button ${colorScheme === 'warm' ? 'primary' : ''}`}
              onClick={() => setColorScheme('warm')}
            >
              Warm
            </button>
            <button
              type="button"
              className={`status-panel__button ${colorScheme === 'cool' ? 'primary' : ''}`}
              onClick={() => setColorScheme('cool')}
            >
              Cool
            </button>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-widest text-muted">Legend</div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted">0</span>
            <div className="h-3 flex-1 rounded-sm" style={{
              background: colorScheme === 'warm'
                ? 'linear-gradient(to right, #fef3c7, #f59e0b, #dc2626, #7f1d1d)'
                : 'linear-gradient(to right, #ecfdf5, #34d399, #0ea5e9, #1e3a5f)',
            }} />
            <span className="font-mono text-[10px] text-muted">30+</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs">
          <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
            <div className="text-muted">Total Points</div>
            <div className="text-fg">{points.features.length}</div>
          </div>
          <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
            <div className="text-muted">Non-Empty Hexes</div>
            <div className="text-fg">{nonEmptyCount}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const hexbinGridPattern: Pattern = {
  id: 'hexbin-grid',
  name: 'Hexbin / Grid Aggregation',
  category: 'data-viz',
  description: 'Aggregate points into hexagonal bins with data-driven fill colors using Turf.js.',
  controls: [],
  disableGlobalSearch: true,
  setup() {},
  cleanup() {},
  update() {},
  view: HexbinGridView,
  snippet: `import * as turf from '@turf/turf';

const points = turf.randomPoint(500, { bbox });
const grid = turf.hexGrid(bbox, cellSize, { units: 'kilometers' });

for (const hex of grid.features) {
  const within = turf.pointsWithinPolygon(points, hex);
  hex.properties.count = within.features.length;
}

map.getSource('hexbin-src').setData(grid);
map.setPaintProperty('hexbin-fill', 'fill-color',
  ['interpolate', ['linear'], ['get', 'count'],
    0, '#fef3c7', 5, '#f59e0b', 15, '#dc2626', 30, '#7f1d1d']);`,
};
