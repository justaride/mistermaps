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

const SRC_ID = 'timeslider-src';
const LYR_ID = 'timeslider-layer';

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

function generateEvents(): GeoJSON.FeatureCollection {
  const rand = seededRandom(12345);
  const features: GeoJSON.Feature[] = [];
  for (let i = 0; i < 200; i++) {
    features.push({
      type: 'Feature',
      properties: {
        id: i,
        timestamp: Math.floor(rand() * 86400),
        label: `Event ${i + 1}`,
      },
      geometry: {
        type: 'Point',
        coordinates: [
          CENTER[0] + (rand() - 0.5) * 0.2,
          CENTER[1] + (rand() - 0.5) * 0.15,
        ],
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

const EVENTS = generateEvents();

function TimeSliderView({ theme, onPrimaryMapReady }: PatternViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | MapLibreMap | null>(null);
  const recreateTokenRef = useRef(0);

  const [engine, setEngine] = useState<Engine>('mapbox');
  const [loaded, setLoaded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);

  const style = styleFor(engine, theme);

  const ensureLayers = useCallback((map: MapboxMap | MapLibreMap) => {
    const m = map as unknown as {
      getSource: (id: string) => unknown;
      addSource: (id: string, source: unknown) => void;
      getLayer: (id: string) => unknown;
      addLayer: (layer: unknown) => void;
    };

    if (!m.getSource(SRC_ID)) {
      m.addSource(SRC_ID, { type: 'geojson', data: EVENTS });
    }

    if (!m.getLayer(LYR_ID)) {
      m.addLayer({
        id: LYR_ID,
        type: 'circle',
        source: SRC_ID,
        paint: {
          'circle-radius': 6,
          'circle-color': '#8b5cf6',
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff',
          'circle-opacity': 0.8,
        },
      });
    }
  }, []);

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
          zoom: camera?.zoom ?? 13,
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
        zoom: camera?.zoom ?? 13,
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
    if (!playing) return;
    const interval = setInterval(() => {
      setCurrentTime(t => {
        const next = t + 300;
        if (next > 86400) {
          setPlaying(false);
          return 86400;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [playing]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    (map as any).setFilter(LYR_ID, ['<=', ['get', 'timestamp'], currentTime]);
    const count = EVENTS.features.filter(
      f => (f.properties?.timestamp ?? 0) <= currentTime
    ).length;
    setVisibleCount(count);
  }, [currentTime, loaded]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="panel status-panel absolute left-4 top-16 z-10 w-[360px] p-3">
        <div className="status-panel__message">
          Scrub through 24 hours of simulated events. Use play/pause or drag the slider.
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
            Time
          </div>
          <input
            type="range"
            min={0}
            max={86400}
            step={300}
            value={currentTime}
            onChange={e => setCurrentTime(Number(e.target.value))}
            className="w-full"
          />
          <div className="mt-1 flex items-center justify-between font-mono text-xs text-fg">
            <span>{formatTime(currentTime)}</span>
            <button
              type="button"
              className="status-panel__button primary"
              onClick={() => setPlaying(p => !p)}
            >
              {playing ? 'Pause' : 'Play'}
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs">
          <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
            <div className="text-muted">Visible</div>
            <div className="text-fg">{visibleCount}</div>
          </div>
          <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
            <div className="text-muted">Total</div>
            <div className="text-fg">200</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const timeSliderPattern: Pattern = {
  id: 'time-slider',
  name: 'Time Slider Playback',
  category: 'data-viz',
  description: 'Scrub and play through time-series point events with cumulative filtering.',
  controls: [],
  disableGlobalSearch: true,
  setup() {},
  cleanup() {},
  update() {},
  view: TimeSliderView,
  snippet: `const filter = ['<=', ['get', 'timestamp'], currentTime];
map.setFilter('timeslider-layer', filter);

setInterval(() => {
  currentTime += 300;
  map.setFilter('timeslider-layer',
    ['<=', ['get', 'timestamp'], currentTime]);
}, 100);`,
};
