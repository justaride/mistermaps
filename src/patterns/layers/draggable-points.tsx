import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Pattern, PatternViewProps, Theme } from '../../types';
import { mapboxBasemapProvider, openFreeMapBasemapProvider } from '../../providers';
import { getSource, once } from '../utils/map-compat';
import { loadMapboxGL, loadMapLibreGL } from '../utils/load-map-engine';

type Engine = 'mapbox' | 'maplibre';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const CENTER: [number, number] = [11.0, 61.83];

const SRC_ID = 'draggable-pts-src';
const LYR_ID = 'draggable-pts-layer';

const POINTS: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: Array.from({ length: 10 }, (_, i) => ({
    type: 'Feature' as const,
    properties: { name: `Point ${i + 1}`, id: i },
    geometry: {
      type: 'Point' as const,
      coordinates: [CENTER[0] + (Math.sin(i * 0.63) * 0.04), CENTER[1] + (Math.cos(i * 0.63) * 0.03)],
    },
  })),
};

function clonePoints(): GeoJSON.FeatureCollection {
  return JSON.parse(JSON.stringify(POINTS));
}

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

type MapLike = {
  getSource: (id: string) => unknown;
  addSource: (id: string, source: unknown) => void;
  getLayer: (id: string) => unknown;
  addLayer: (layer: unknown) => void;
  on: (type: string, layerOrCb: string | ((e: unknown) => void), cb?: (e: unknown) => void) => void;
  off: (type: string, layerOrCb: string | ((e: unknown) => void), cb?: (e: unknown) => void) => void;
  getCanvas: () => { style: CSSStyleDeclaration };
  dragPan: { disable: () => void; enable: () => void };
};

type DragEvent = {
  lngLat: { lng: number; lat: number };
  features?: Array<{ properties?: Record<string, unknown> }>;
};

function DraggablePointsView({ theme, onPrimaryMapReady }: PatternViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | MapLibreMap | null>(null);
  const recreateTokenRef = useRef(0);
  const geojsonRef = useRef<GeoJSON.FeatureCollection>(clonePoints());
  const draggingIdRef = useRef<number | null>(null);

  const [engine, setEngine] = useState<Engine>('mapbox');
  const [loaded, setLoaded] = useState(false);
  const [lastMoved, setLastMoved] = useState<[number, number] | null>(null);

  const style = styleFor(engine, theme);

  const handlersRef = useRef<{
    onMouseEnter: (e: unknown) => void;
    onMouseLeave: (e: unknown) => void;
    onMouseDown: (e: unknown) => void;
    onMouseMove: (e: unknown) => void;
    onMouseUp: (e: unknown) => void;
  } | null>(null);

  const teardownHandlers = useCallback((map: MapboxMap | MapLibreMap) => {
    const m = map as unknown as MapLike;
    const h = handlersRef.current;
    if (!h) return;
    m.off('mouseenter', LYR_ID, h.onMouseEnter);
    m.off('mouseleave', LYR_ID, h.onMouseLeave);
    m.off('mousedown', LYR_ID, h.onMouseDown);
    m.off('mousemove', h.onMouseMove);
    m.off('mouseup', h.onMouseUp);
    handlersRef.current = null;
  }, []);

  const setupHandlers = useCallback((map: MapboxMap | MapLibreMap) => {
    teardownHandlers(map);
    const m = map as unknown as MapLike;

    const onMouseEnter = () => {
      m.getCanvas().style.cursor = 'grab';
    };

    const onMouseLeave = () => {
      if (draggingIdRef.current === null) {
        m.getCanvas().style.cursor = '';
      }
    };

    const onMouseDown = (e: unknown) => {
      const ev = e as DragEvent;
      const feat = ev.features?.[0];
      if (!feat) return;
      const id = feat.properties?.id;
      if (typeof id !== 'number') return;
      draggingIdRef.current = id;
      m.getCanvas().style.cursor = 'grabbing';
      m.dragPan.disable();
    };

    const onMouseMove = (e: unknown) => {
      if (draggingIdRef.current === null) return;
      const ev = e as DragEvent;
      const lng = ev.lngLat.lng;
      const lat = ev.lngLat.lat;
      const fc = geojsonRef.current;
      const feat = fc.features.find(
        (f) => f.properties?.id === draggingIdRef.current
      );
      if (feat && feat.geometry.type === 'Point') {
        (feat.geometry as GeoJSON.Point).coordinates = [lng, lat];
      }
      const src = getSource(map, SRC_ID) as { setData?: (d: unknown) => void } | null;
      if (src?.setData) src.setData(fc);
      setLastMoved([lng, lat]);
    };

    const onMouseUp = () => {
      if (draggingIdRef.current === null) return;
      draggingIdRef.current = null;
      m.getCanvas().style.cursor = 'grab';
      m.dragPan.enable();
    };

    m.on('mouseenter', LYR_ID, onMouseEnter);
    m.on('mouseleave', LYR_ID, onMouseLeave);
    m.on('mousedown', LYR_ID, onMouseDown);
    m.on('mousemove', onMouseMove);
    m.on('mouseup', onMouseUp);

    handlersRef.current = { onMouseEnter, onMouseLeave, onMouseDown, onMouseMove, onMouseUp };
  }, [teardownHandlers]);

  const ensureLayers = useCallback((map: MapboxMap | MapLibreMap) => {
    const m = map as unknown as MapLike;

    if (!m.getSource(SRC_ID)) {
      m.addSource(SRC_ID, { type: 'geojson', data: geojsonRef.current });
    } else {
      const src = m.getSource(SRC_ID) as { setData?: (d: unknown) => void };
      src.setData?.(geojsonRef.current);
    }

    if (!m.getLayer(LYR_ID)) {
      m.addLayer({
        id: LYR_ID,
        type: 'circle',
        source: SRC_ID,
        paint: {
          'circle-radius': 10,
          'circle-color': '#3b82f6',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        },
      });
    }

    setupHandlers(map);
  }, [setupHandlers]);

  useEffect(() => {
    if (!containerRef.current) return;
    const token = (recreateTokenRef.current += 1);
    const prev = mapRef.current;
    const camera = prev ? getCamera(prev) : null;
    if (prev) {
      teardownHandlers(prev);
      try { prev.remove(); } catch { /* ignore */ }
      mapRef.current = null;
    }
    setLoaded(false);
    geojsonRef.current = clonePoints();
    setLastMoved(null);

    void (async () => {
      if (engine === 'mapbox') {
        const mapboxgl = await loadMapboxGL();
        if (recreateTokenRef.current !== token) return;
        mapboxgl.accessToken = MAPBOX_TOKEN;
        const map = new mapboxgl.Map({
          container: containerRef.current!,
          style,
          center: camera?.center ?? CENTER,
          zoom: camera?.zoom ?? 12,
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
        zoom: camera?.zoom ?? 12,
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
      teardownHandlers(map);
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

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="panel status-panel absolute left-4 top-16 z-10 w-[300px] p-3">
        <div className="status-panel__message">
          Click and drag the blue points to reposition them. Coordinates update in real time.
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

        {lastMoved && (
          <div className="mt-3 font-mono text-xs text-muted">
            Last moved: {lastMoved[1].toFixed(5)}, {lastMoved[0].toFixed(5)}
          </div>
        )}
      </div>
    </div>
  );
}

export const draggablePointsPattern: Pattern = {
  id: 'draggable-points',
  name: 'Draggable Points',
  category: 'layers',
  description:
    'Click and drag circle markers to reposition them. Demonstrates mousedown/mousemove/mouseup interaction with GeoJSON source updates (dual-engine Mapbox/MapLibre).',
  controls: [],
  disableGlobalSearch: true,
  setup() {},
  cleanup() {},
  update() {},
  view: DraggablePointsView,
  snippet: `map.on('mousedown', layerId, (e) => {
  const feat = e.features[0];
  map.dragPan.disable();

  const onMove = (e) => {
    feat.geometry.coordinates = [e.lngLat.lng, e.lngLat.lat];
    map.getSource(sourceId).setData(geojson);
  };

  const onUp = () => {
    map.dragPan.enable();
    map.off('mousemove', onMove);
    map.off('mouseup', onUp);
  };

  map.on('mousemove', onMove);
  map.on('mouseup', onUp);
});`,
};
