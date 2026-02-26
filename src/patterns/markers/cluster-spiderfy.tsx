import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Pattern, PatternViewProps, Theme } from '../../types';
import { mapboxBasemapProvider, openFreeMapBasemapProvider } from '../../providers';
import { getSource, once } from '../utils/map-compat';
import { loadMapboxGL, loadMapLibreGL } from '../utils/load-map-engine';

type Engine = 'mapbox' | 'maplibre';
type PopupInfo = { lngLat: [number, number]; name: string } | null;

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const CENTER: [number, number] = [11.0, 61.83];

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

function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
}

function generateClusteredPoints(): GeoJSON.FeatureCollection {
  const rand = seededRandom(42);
  const clusterCenters: [number, number][] = [
    [CENTER[0] - 0.06, CENTER[1] + 0.04],
    [CENTER[0] + 0.05, CENTER[1] + 0.03],
    [CENTER[0] - 0.03, CENTER[1] - 0.03],
    [CENTER[0] + 0.04, CENTER[1] - 0.04],
    [CENTER[0], CENTER[1] + 0.06],
    [CENTER[0] + 0.07, CENTER[1]],
  ];
  const features: GeoJSON.Feature[] = [];
  for (let i = 0; i < 100; i++) {
    const cluster = clusterCenters[i % clusterCenters.length];
    features.push({
      type: 'Feature',
      properties: { name: `Point ${i + 1}`, category: ['A', 'B', 'C'][i % 3] },
      geometry: {
        type: 'Point',
        coordinates: [
          cluster[0] + (rand() - 0.5) * 0.008,
          cluster[1] + (rand() - 0.5) * 0.006,
        ],
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

function ClusterSpiderfyView({ theme, onPrimaryMapReady }: PatternViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | MapLibreMap | null>(null);
  const recreateTokenRef = useRef(0);
  const spiderLegsRef = useRef<GeoJSON.FeatureCollection>({ ...EMPTY_FC });
  const spiderPointsRef = useRef<GeoJSON.FeatureCollection>({ ...EMPTY_FC });

  const [engine, setEngine] = useState<Engine>('mapbox');
  const [loaded, setLoaded] = useState(false);
  const [spiderOpen, setSpiderOpen] = useState(false);
  const [popup, setPopup] = useState<PopupInfo>(null);

  const style = styleFor(engine, theme);
  const pointData = generateClusteredPoints();

  const collapseSpider = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    spiderLegsRef.current = { ...EMPTY_FC };
    spiderPointsRef.current = { ...EMPTY_FC };
    const legsSrc = getSource(map, 'spiderfy-legs-src') as { setData?: (d: unknown) => void } | null;
    const ptsSrc = getSource(map, 'spiderfy-spider-src') as { setData?: (d: unknown) => void } | null;
    if (legsSrc?.setData) legsSrc.setData(EMPTY_FC);
    if (ptsSrc?.setData) ptsSrc.setData(EMPTY_FC);
    setSpiderOpen(false);
    setPopup(null);
  }, []);

  const ensureLayers = useCallback(
    (map: MapboxMap | MapLibreMap) => {
      const m = map as unknown as {
        getSource: (id: string) => unknown;
        addSource: (id: string, source: unknown) => void;
        getLayer: (id: string) => unknown;
        addLayer: (layer: unknown) => void;
      };

      if (!m.getSource('spiderfy-src')) {
        m.addSource('spiderfy-src', {
          type: 'geojson',
          data: pointData,
          cluster: true,
          clusterRadius: 60,
          clusterMaxZoom: 14,
        });
      }

      if (!m.getSource('spiderfy-legs-src')) {
        m.addSource('spiderfy-legs-src', { type: 'geojson', data: EMPTY_FC });
      }

      if (!m.getSource('spiderfy-spider-src')) {
        m.addSource('spiderfy-spider-src', { type: 'geojson', data: EMPTY_FC });
      }

      if (!m.getLayer('spiderfy-clusters')) {
        m.addLayer({
          id: 'spiderfy-clusters',
          type: 'circle',
          source: 'spiderfy-src',
          filter: ['has', 'point_count'],
          paint: {
            'circle-radius': ['step', ['get', 'point_count'], 18, 10, 24, 30, 32],
            'circle-color': ['step', ['get', 'point_count'], '#51bbd6', 10, '#f1f075', 30, '#f28cb1'],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff',
          },
        });
      }

      if (!m.getLayer('spiderfy-count')) {
        m.addLayer({
          id: 'spiderfy-count',
          type: 'symbol',
          source: 'spiderfy-src',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-size': 12,
          },
        });
      }

      if (!m.getLayer('spiderfy-unclustered')) {
        m.addLayer({
          id: 'spiderfy-unclustered',
          type: 'circle',
          source: 'spiderfy-src',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-radius': 6,
            'circle-color': '#3b82f6',
            'circle-stroke-width': 1,
            'circle-stroke-color': '#fff',
          },
        });
      }

      if (!m.getLayer('spiderfy-legs')) {
        m.addLayer({
          id: 'spiderfy-legs',
          type: 'line',
          source: 'spiderfy-legs-src',
          paint: {
            'line-color': '#6b7280',
            'line-width': 1.5,
          },
        });
      }

      if (!m.getLayer('spiderfy-spider-pts')) {
        m.addLayer({
          id: 'spiderfy-spider-pts',
          type: 'circle',
          source: 'spiderfy-spider-src',
          paint: {
            'circle-radius': 7,
            'circle-color': '#ef4444',
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#fff',
          },
        });
      }
    },
    [pointData]
  );

  const attachHandlers = useCallback(
    (map: MapboxMap | MapLibreMap) => {
      const m = map as unknown as {
        on: (type: string, layerOrCb: string | (() => void), cb?: (e: unknown) => void) => void;
        queryRenderedFeatures: (point: unknown, opts: unknown) => GeoJSON.Feature[];
        getCanvas: () => HTMLElement;
      };

      m.on('click', 'spiderfy-clusters', (e: unknown) => {
        const evt = e as { point: unknown };
        const features = m.queryRenderedFeatures(evt.point, { layers: ['spiderfy-clusters'] });
        if (!features.length) return;

        const feature = features[0];
        const clusterId = feature.properties?.cluster_id;
        if (clusterId === undefined) return;

        const src = getSource(map, 'spiderfy-src') as unknown as {
          getClusterLeaves: (
            id: number, limit: number, offset: number,
            cb: (err: unknown, features: GeoJSON.Feature[]) => void
          ) => void;
        };

        src.getClusterLeaves(clusterId, 100, 0, (err, leaves) => {
          if (err || !leaves) return;

          const clusterCoord = (feature.geometry as GeoJSON.Point).coordinates;
          const count = leaves.length;
          const legLength = 0.0015 + count * 0.0002;
          const spiderPoints: GeoJSON.Feature[] = [];
          const spiderLegs: GeoJSON.Feature[] = [];

          for (let i = 0; i < count; i++) {
            const angle = (2 * Math.PI * i) / count;
            const lng = clusterCoord[0] + legLength * Math.cos(angle);
            const lat = clusterCoord[1] + legLength * Math.sin(angle);
            spiderPoints.push({
              type: 'Feature',
              properties: leaves[i].properties,
              geometry: { type: 'Point', coordinates: [lng, lat] },
            });
            spiderLegs.push({
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: [clusterCoord, [lng, lat]] },
            });
          }

          const legsFC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: spiderLegs };
          const ptsFC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: spiderPoints };
          spiderLegsRef.current = legsFC;
          spiderPointsRef.current = ptsFC;

          const legsSrc = getSource(map, 'spiderfy-legs-src') as { setData?: (d: unknown) => void } | null;
          const ptsSrc = getSource(map, 'spiderfy-spider-src') as { setData?: (d: unknown) => void } | null;
          if (legsSrc?.setData) legsSrc.setData(legsFC);
          if (ptsSrc?.setData) ptsSrc.setData(ptsFC);
          setSpiderOpen(true);
          setPopup(null);
        });
      });

      m.on('click', 'spiderfy-spider-pts', (e: unknown) => {
        const evt = e as { point: unknown; lngLat: { lng: number; lat: number } };
        const features = m.queryRenderedFeatures(evt.point, { layers: ['spiderfy-spider-pts'] });
        if (!features.length) return;
        const name = features[0].properties?.name ?? 'Unknown';
        setPopup({ lngLat: [evt.lngLat.lng, evt.lngLat.lat], name });
      });

      let clickToken = 0;
      const mapAny = map as unknown as {
        on: (type: string, cb: (e: unknown) => void) => void;
      };
      mapAny.on('click', (e: unknown) => {
        const token = ++clickToken;
        setTimeout(() => {
          if (token !== clickToken) return;
          const evt = e as { point: unknown };
          const clusterHits = m.queryRenderedFeatures(evt.point, { layers: ['spiderfy-clusters'] });
          const spiderHits = m.queryRenderedFeatures(evt.point, { layers: ['spiderfy-spider-pts'] });
          if (!clusterHits.length && !spiderHits.length) {
            collapseSpider();
          }
        }, 50);
      });

      m.on('mouseenter', 'spiderfy-clusters', () => {
        m.getCanvas().style.cursor = 'pointer';
      });
      m.on('mouseleave', 'spiderfy-clusters', () => {
        m.getCanvas().style.cursor = '';
      });
      m.on('mouseenter', 'spiderfy-spider-pts', () => {
        m.getCanvas().style.cursor = 'pointer';
      });
      m.on('mouseleave', 'spiderfy-spider-pts', () => {
        m.getCanvas().style.cursor = '';
      });
    },
    [collapseSpider]
  );

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
    setSpiderOpen(false);
    setPopup(null);

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
          attachHandlers(map);
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
        attachHandlers(map);
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
      attachHandlers(map);
      collapseSpider();
    });
  }, [style, loaded]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

      {popup && (
        <div
          className="absolute z-20 rounded border border-border bg-bg px-3 py-2 text-sm text-fg shadow-lg"
          style={{ left: '50%', top: 16, transform: 'translateX(-50%)' }}
        >
          <strong>{popup.name}</strong>
          <button
            type="button"
            className="ml-3 text-xs text-muted hover:text-fg"
            onClick={() => setPopup(null)}
          >
            close
          </button>
        </div>
      )}

      <div className="panel status-panel absolute left-4 top-16 z-10 w-[360px] p-3">
        <div className="status-panel__message">
          Click clusters to expand into a radial spider layout showing individual points.
          Dual-engine pattern supporting Mapbox GL and MapLibre GL.
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

        <div className="mt-3 font-mono text-xs text-muted">
          Click a cluster to expand it. Click elsewhere to collapse.
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-xs">
          <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
            <div className="text-muted">Total Points</div>
            <div className="text-fg">100</div>
          </div>
          <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
            <div className="text-muted">Clusters</div>
            <div className="text-fg">6 groups</div>
          </div>
          <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
            <div className="text-muted">Spider</div>
            <div className="text-fg">{spiderOpen ? 'Open' : 'Closed'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const clusterSpiderfyPattern: Pattern = {
  id: 'cluster-spiderfy',
  name: 'Cluster Spiderfy',
  category: 'markers',
  description: 'Click clusters to expand into a radial spider layout showing individual points.',
  controls: [],
  disableGlobalSearch: true,
  setup() {},
  cleanup() {},
  update() {},
  view: ClusterSpiderfyView,
  snippet: `map.addSource('points', {
  type: 'geojson',
  data: pointsGeoJSON,
  cluster: true,
  clusterRadius: 60,
  clusterMaxZoom: 14,
});

map.on('click', 'clusters', (e) => {
  const clusterId = e.features[0].properties.cluster_id;
  const source = map.getSource('points');
  source.getClusterLeaves(clusterId, 100, 0, (err, leaves) => {
    const center = e.features[0].geometry.coordinates;
    const count = leaves.length;
    const legLength = 0.0015 + count * 0.0002;
    leaves.forEach((leaf, i) => {
      const angle = (2 * Math.PI * i) / count;
      const lng = center[0] + legLength * Math.cos(angle);
      const lat = center[1] + legLength * Math.sin(angle);
      // Add spider point at [lng, lat]
      // Add leg line from center to [lng, lat]
    });
  });
});`,
};
