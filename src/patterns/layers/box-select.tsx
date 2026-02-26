import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Pattern, PatternViewProps, Theme } from '../../types';
import { mapboxBasemapProvider, openFreeMapBasemapProvider } from '../../providers';
import { once } from '../utils/map-compat';
import { loadMapboxGL, loadMapLibreGL } from '../utils/load-map-engine';

type Engine = 'mapbox' | 'maplibre';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const CENTER: [number, number] = [11.0, 61.83];
const POINT_COUNT = 50;
const SRC_ID = 'box-select-src';
const LYR_ID = 'box-select-layer';

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

function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
}

function buildPoints(): GeoJSON.FeatureCollection {
  const rand = seededRandom(42);
  const features: GeoJSON.Feature[] = [];
  for (let i = 0; i < POINT_COUNT; i++) {
    features.push({
      type: 'Feature',
      properties: { id: i },
      geometry: {
        type: 'Point',
        coordinates: [
          CENTER[0] - 0.5 + rand() * 1.0,
          CENTER[1] - 0.3 + rand() * 0.6,
        ],
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

const POINTS_DATA = buildPoints();

function BoxSelectView({ theme, onPrimaryMapReady }: PatternViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | MapLibreMap | null>(null);
  const recreateTokenRef = useRef(0);
  const selectedIdsRef = useRef<Set<number>>(new Set());
  const boxRef = useRef<HTMLDivElement | null>(null);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);

  const [engine, setEngine] = useState<Engine>('mapbox');
  const [loaded, setLoaded] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);

  const style = styleFor(engine, theme);

  const ensureLayers = useCallback((map: MapboxMap | MapLibreMap) => {
    const m = map as unknown as {
      getSource: (id: string) => unknown;
      addSource: (id: string, source: unknown) => void;
      getLayer: (id: string) => unknown;
      addLayer: (layer: unknown) => void;
    };
    if (!m.getSource(SRC_ID)) {
      m.addSource(SRC_ID, {
        type: 'geojson',
        data: POINTS_DATA,
        promoteId: 'id',
      });
    }
    if (!m.getLayer(LYR_ID)) {
      m.addLayer({
        id: LYR_ID,
        type: 'circle',
        source: SRC_ID,
        paint: {
          'circle-radius': 6,
          'circle-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            '#ef4444',
            '#3b82f6',
          ],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff',
        },
      });
    }
  }, []);

  const clearSelection = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const m = map as unknown as {
      removeFeatureState: (target: { source: string }) => void;
    };
    m.removeFeatureState({ source: SRC_ID });
    selectedIdsRef.current.clear();
    setSelectedCount(0);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const token = (recreateTokenRef.current += 1);
    const prev = mapRef.current;
    const camera = prev ? getCamera(prev) : null;
    if (prev) {
      try { prev.remove(); } catch { /* noop */ }
      mapRef.current = null;
    }
    setLoaded(false);
    selectedIdsRef.current.clear();
    setSelectedCount(0);

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
    })().catch(() => { /* noop */ });

    return () => {
      recreateTokenRef.current += 1;
      const map = mapRef.current;
      if (!map) return;
      try { map.remove(); } catch { /* noop */ }
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
    const container = (map as unknown as { getContainer: () => HTMLElement }).getContainer();
    const canvas = (map as unknown as { getCanvas: () => HTMLCanvasElement }).getCanvas();

    const m = map as unknown as {
      getSource: (id: string) => unknown;
      addSource: (id: string, source: unknown) => void;
      getLayer: (id: string) => unknown;
      addLayer: (layer: unknown) => void;
      setFeatureState: (target: { source: string; id: number }, state: Record<string, unknown>) => void;
      removeFeatureState: (target: { source: string }) => void;
      queryRenderedFeatures: (bbox: [[number, number], [number, number]], opts: { layers: string[] }) => { id?: number }[];
    };

    let dragging = false;

    const onMouseDown = (e: MouseEvent) => {
      if (!e.shiftKey) return;
      e.preventDefault();
      dragging = true;
      startPointRef.current = { x: e.offsetX, y: e.offsetY };

      const box = document.createElement('div');
      box.style.position = 'absolute';
      box.style.border = '2px dashed #3b82f6';
      box.style.backgroundColor = 'rgba(59,130,246,0.15)';
      box.style.pointerEvents = 'none';
      box.style.zIndex = '20';
      box.style.left = `${e.offsetX}px`;
      box.style.top = `${e.offsetY}px`;
      box.style.width = '0px';
      box.style.height = '0px';
      container.appendChild(box);
      boxRef.current = box;

      canvas.style.cursor = 'crosshair';
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging || !startPointRef.current || !boxRef.current) return;
      const start = startPointRef.current;
      const minX = Math.min(start.x, e.offsetX);
      const minY = Math.min(start.y, e.offsetY);
      const maxX = Math.max(start.x, e.offsetX);
      const maxY = Math.max(start.y, e.offsetY);
      boxRef.current.style.left = `${minX}px`;
      boxRef.current.style.top = `${minY}px`;
      boxRef.current.style.width = `${maxX - minX}px`;
      boxRef.current.style.height = `${maxY - minY}px`;
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!dragging || !startPointRef.current) return;
      dragging = false;
      canvas.style.cursor = '';

      if (boxRef.current) {
        boxRef.current.remove();
        boxRef.current = null;
      }

      const start = startPointRef.current;
      startPointRef.current = null;

      const sw: [number, number] = [
        Math.min(start.x, e.offsetX),
        Math.max(start.y, e.offsetY),
      ];
      const ne: [number, number] = [
        Math.max(start.x, e.offsetX),
        Math.min(start.y, e.offsetY),
      ];

      m.removeFeatureState({ source: SRC_ID });
      selectedIdsRef.current.clear();

      const features = m.queryRenderedFeatures([sw, ne], { layers: [LYR_ID] });
      for (const f of features) {
        if (f.id != null) {
          m.setFeatureState({ source: SRC_ID, id: f.id as number }, { selected: true });
          selectedIdsRef.current.add(f.id as number);
        }
      }
      setSelectedCount(selectedIdsRef.current.size);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragging) {
        dragging = false;
        canvas.style.cursor = '';
        if (boxRef.current) {
          boxRef.current.remove();
          boxRef.current = null;
        }
        startPointRef.current = null;
      }
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('keydown', onKeyDown);
      if (boxRef.current) {
        boxRef.current.remove();
        boxRef.current = null;
      }
    };
  }, [loaded]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="panel status-panel absolute left-4 top-16 z-10 w-[360px] p-3">
        <div className="status-panel__message">
          Hold <strong>Shift</strong> and drag to draw a selection box.
          Points inside the box turn red. Press <strong>Escape</strong> to
          cancel a drag.
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

        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="font-mono text-muted">
            Selected: <span className="text-fg">{selectedCount}</span> / {POINT_COUNT}
          </span>
          <button
            type="button"
            className="status-panel__button"
            onClick={clearSelection}
            disabled={selectedCount === 0}
          >
            Clear Selection
          </button>
        </div>
      </div>
    </div>
  );
}

export const boxSelectPattern: Pattern = {
  id: 'box-select',
  name: 'Box Select (Shift-Drag)',
  category: 'layers',
  description:
    'Shift-drag to draw a rectangle and select features within it using queryRenderedFeatures and feature-state (dual-engine Mapbox/MapLibre).',
  controls: [],
  disableGlobalSearch: true,
  setup() {},
  cleanup() {},
  update() {},
  view: BoxSelectView,
  snippet: `map.on('mousedown', (e) => {
  if (!e.originalEvent.shiftKey) return;
  // Record start point, show selection rectangle
});

map.on('mouseup', (e) => {
  const features = map.queryRenderedFeatures(
    [startPoint, endPoint],
    { layers: ['my-layer'] }
  );
  for (const f of features) {
    map.setFeatureState(
      { source: 'my-src', id: f.id },
      { selected: true }
    );
  }
});`,
};
