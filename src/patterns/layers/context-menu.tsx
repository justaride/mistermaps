import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Pattern, PatternViewProps, Theme } from '../../types';
import { mapboxBasemapProvider, openFreeMapBasemapProvider } from '../../providers';
import { getSource, once } from '../utils/map-compat';
import { loadMapboxGL, loadMapLibreGL } from '../utils/load-map-engine';

type Engine = 'mapbox' | 'maplibre';

type MenuState = {
  visible: boolean;
  x: number;
  y: number;
  lngLat: { lng: number; lat: number };
} | null;

type ContextEvent = {
  preventDefault: () => void;
  point: { x: number; y: number };
  lngLat: { lng: number; lat: number };
};

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const CENTER: [number, number] = [11.0, 61.83];

const SRC_ID = 'ctx-menu-pins-src';
const LYR_ID = 'ctx-menu-pins-layer';

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

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

function ContextMenuView({ theme, onPrimaryMapReady }: PatternViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | MapLibreMap | null>(null);
  const recreateTokenRef = useRef(0);
  const pinsRef = useRef<GeoJSON.FeatureCollection>({ ...EMPTY_FC, features: [] });

  const [engine, setEngine] = useState<Engine>('mapbox');
  const [loaded, setLoaded] = useState(false);
  const [menu, setMenu] = useState<MenuState>(null);
  const [pinCount, setPinCount] = useState(0);
  const [copied, setCopied] = useState(false);

  const menuRef = useRef<HTMLDivElement | null>(null);

  const ensureLayers = useCallback((map: MapboxMap | MapLibreMap) => {
    const m = map as unknown as {
      getSource: (id: string) => unknown;
      addSource: (id: string, source: unknown) => void;
      getLayer: (id: string) => unknown;
      addLayer: (layer: unknown) => void;
    };

    if (!m.getSource(SRC_ID)) {
      m.addSource(SRC_ID, { type: 'geojson', data: pinsRef.current });
    }

    if (!m.getLayer(LYR_ID)) {
      m.addLayer({
        id: LYR_ID,
        type: 'circle',
        source: SRC_ID,
        paint: {
          'circle-radius': 7,
          'circle-color': '#ef4444',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        },
      });
    }
  }, []);

  const updateSource = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = getSource(map, SRC_ID) as { setData?: (d: unknown) => void } | null;
    if (src?.setData) src.setData(pinsRef.current);
  }, []);

  const closeMenu = useCallback(() => {
    setMenu(null);
  }, []);

  const handleContextMenu = useCallback((e: unknown) => {
    const ev = e as ContextEvent;
    ev.preventDefault();
    setMenu({
      visible: true,
      x: ev.point.x,
      y: ev.point.y,
      lngLat: { lng: ev.lngLat.lng, lat: ev.lngLat.lat },
    });
  }, []);

  const handleCopyCoordinates = useCallback(() => {
    if (!menu) return;
    const text = `${menu.lngLat.lng.toFixed(6)}, ${menu.lngLat.lat.toFixed(6)}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    setMenu(null);
  }, [menu]);

  const handleDropPin = useCallback(() => {
    if (!menu) return;
    const feature: GeoJSON.Feature = {
      type: 'Feature',
      properties: { id: Date.now() },
      geometry: {
        type: 'Point',
        coordinates: [menu.lngLat.lng, menu.lngLat.lat],
      },
    };
    pinsRef.current = {
      type: 'FeatureCollection',
      features: [...pinsRef.current.features, feature],
    };
    updateSource();
    setPinCount(pinsRef.current.features.length);
    setMenu(null);
  }, [menu, updateSource]);

  const handleClearPins = useCallback(() => {
    pinsRef.current = { type: 'FeatureCollection', features: [] };
    updateSource();
    setPinCount(0);
    setMenu(null);
  }, [updateSource]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClick);
    };
  }, [closeMenu]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const m = map as unknown as {
      on: (type: string, cb: () => void) => void;
      off: (type: string, cb: () => void) => void;
    };
    m.on('movestart', closeMenu);
    return () => { m.off('movestart', closeMenu); };
  }, [loaded, closeMenu]);

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
    setMenu(null);

    void (async () => {
      if (engine === 'mapbox') {
        const mapboxgl = await loadMapboxGL();
        if (recreateTokenRef.current !== token) return;
        mapboxgl.accessToken = MAPBOX_TOKEN;
        const map = new mapboxgl.Map({
          container: containerRef.current!,
          style: styleFor(engine, theme),
          center: camera?.center ?? CENTER,
          zoom: camera?.zoom ?? 10,
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
        style: styleFor(engine, theme),
        center: camera?.center ?? CENTER,
        zoom: camera?.zoom ?? 10,
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
    map.setStyle(styleFor(engine, theme));
    once(map, 'style.load', () => {
      map.jumpTo(camera as never);
      map.resize();
      ensureLayers(map);
    });
  }, [theme, loaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const m = map as unknown as {
      on: (type: string, cb: (e: unknown) => void) => void;
      off: (type: string, cb: (e: unknown) => void) => void;
    };
    m.on('contextmenu', handleContextMenu);
    return () => { m.off('contextmenu', handleContextMenu); };
  }, [loaded, handleContextMenu]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

      {menu && menu.visible && (
        <div
          ref={menuRef}
          style={{ position: 'absolute', left: menu.x, top: menu.y, zIndex: 50 }}
          className="panel rounded-lg border border-border/60 bg-bg/95 shadow-lg backdrop-blur-sm"
        >
          <div className="flex flex-col py-1">
            <button
              type="button"
              className="px-4 py-2 text-left text-sm text-fg hover:bg-border/20 transition-colors"
              onClick={handleCopyCoordinates}
            >
              {copied ? 'Copied!' : 'Copy Coordinates'}
            </button>
            <button
              type="button"
              className="px-4 py-2 text-left text-sm text-fg hover:bg-border/20 transition-colors"
              onClick={handleDropPin}
            >
              Drop Pin
            </button>
            <button
              type="button"
              className="px-4 py-2 text-left text-sm text-fg hover:bg-border/20 transition-colors"
              onClick={handleClearPins}
            >
              Clear Pins
            </button>
          </div>
        </div>
      )}

      <div className="panel status-panel absolute left-4 top-16 z-10 w-[320px] p-3">
        <div className="status-panel__message">
          Right-click the map to open a context menu with copy coordinates, drop pin, and clear actions.
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

        <div className="mt-3 grid grid-cols-1 gap-2 font-mono text-xs">
          <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
            <div className="text-muted">Pins Dropped</div>
            <div className="text-fg">{pinCount}</div>
          </div>
        </div>

        <div className="mt-2 text-xs text-muted">
          Right-click anywhere on the map to open the context menu. Use it to copy coordinates, drop pins, or clear all pins.
        </div>
      </div>
    </div>
  );
}

export const contextMenuPattern: Pattern = {
  id: 'context-menu',
  name: 'Right-Click Context Menu',
  category: 'layers',
  description: 'Context menu with copy coordinates, drop pin, and clear actions.',
  controls: [],
  disableGlobalSearch: true,
  setup() {},
  cleanup() {},
  update() {},
  view: ContextMenuView,
  snippet: `map.on('contextmenu', (e) => {
  e.preventDefault();
  const { x, y } = e.point;
  const { lng, lat } = e.lngLat;
  showMenu({ x, y, lngLat: { lng, lat } });
});

// Copy coordinates
navigator.clipboard.writeText(
  \`\${lng.toFixed(6)}, \${lat.toFixed(6)}\`
);

// Drop pin — add feature to GeoJSON source
pins.features.push(pointFeature);
map.getSource('pins').setData(pins);`,
};
