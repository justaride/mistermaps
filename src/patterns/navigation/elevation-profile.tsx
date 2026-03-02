import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import type { Pattern, PatternViewProps, Theme } from "../../types";
import { mapboxBasemapProvider } from "../../providers";
import { ProviderRequestError } from "../../providers/errors";
import {
  mapboxRoutingProvider,
  osrmRoutingProvider,
} from "../../providers/routing";
import type {
  LngLat,
  RoutingProfile,
  RoutingResult,
} from "../../providers/types";
import { once } from "../utils/map-compat";
import { loadMapboxGL } from "../utils/load-map-engine";

type ProviderMode = "mapbox" | "osrm";

type CameraState = {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
};

type ElevationSample = {
  distanceMeters: number;
  elevationMeters: number;
  coordinate: LngLat;
};

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const ROUTE_SOURCE_ID = "elevation-route-src";
const ROUTE_LAYER_ID = "elevation-route-lyr";
const HOVER_SOURCE_ID = "elevation-hover-src";
const HOVER_LAYER_ID = "elevation-hover-lyr";
const TERRAIN_SOURCE_ID = "elevation-dem-src";

const WAYPOINTS: LngLat[] = [
  [10.7522, 59.9139],
  [10.6225, 59.9596],
];

function styleFor(theme: Theme): string {
  return mapboxBasemapProvider.getStyle(theme);
}

function getCamera(map: MapboxMap): CameraState {
  const c = map.getCenter();
  return {
    center: [c.lng, c.lat],
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  };
}

function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)} m`;
  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

function formatDuration(durationSeconds: number): string {
  const totalMinutes = Math.round(durationSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes} min`;
}

function getBounds(coords: LngLat[]): [[number, number], [number, number]] {
  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

function haversineMeters(a: LngLat, b: LngLat): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

function interpolateCoord(a: LngLat, b: LngLat, t: number): LngLat {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function sampleAlongLine(
  coords: LngLat[],
  intervalMeters: number,
): Array<{ distanceMeters: number; coordinate: LngLat }> {
  if (coords.length < 2) return [];

  const samples: Array<{ distanceMeters: number; coordinate: LngLat }> = [
    { distanceMeters: 0, coordinate: coords[0] },
  ];

  const step = Math.max(20, intervalMeters);
  let traversed = 0;
  let nextSampleDistance = step;

  for (let i = 1; i < coords.length; i += 1) {
    const start = coords[i - 1];
    const end = coords[i];
    const segmentDistance = haversineMeters(start, end);
    if (segmentDistance <= 0) continue;

    while (nextSampleDistance < traversed + segmentDistance) {
      const t = (nextSampleDistance - traversed) / segmentDistance;
      samples.push({
        distanceMeters: nextSampleDistance,
        coordinate: interpolateCoord(start, end, t),
      });
      nextSampleDistance += step;
    }

    traversed += segmentDistance;
  }

  const lastCoord = coords[coords.length - 1];
  const lastSample = samples[samples.length - 1];
  if (!lastSample || lastSample.distanceMeters < traversed) {
    samples.push({ distanceMeters: traversed, coordinate: lastCoord });
  }

  return samples;
}

function emptyLineCollection(): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  return { type: "FeatureCollection", features: [] };
}

function toLineCollection(
  coords: LngLat[],
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  if (coords.length < 2) return emptyLineCollection();
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: coords,
        },
      },
    ],
  };
}

function toPointCollection(
  coord: LngLat | null,
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  if (!coord) return { type: "FeatureCollection", features: [] };
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Point",
          coordinates: coord,
        },
      },
    ],
  };
}

function ensureTerrain(map: MapboxMap) {
  if (!map.getSource(TERRAIN_SOURCE_ID)) {
    map.addSource(TERRAIN_SOURCE_ID, {
      type: "raster-dem",
      url: "mapbox://mapbox.terrain-rgb",
      tileSize: 512,
      maxzoom: 14,
    });
  }

  map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: 1 });
}

function ensureLayers(map: MapboxMap) {
  if (!map.getSource(ROUTE_SOURCE_ID)) {
    map.addSource(ROUTE_SOURCE_ID, {
      type: "geojson",
      data: emptyLineCollection(),
    });
  }

  if (!map.getSource(HOVER_SOURCE_ID)) {
    map.addSource(HOVER_SOURCE_ID, {
      type: "geojson",
      data: toPointCollection(null),
    });
  }

  if (!map.getLayer(ROUTE_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_LAYER_ID,
      type: "line",
      source: ROUTE_SOURCE_ID,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#1d4ed8",
        "line-width": 6,
        "line-opacity": 0.9,
      },
    });
  }

  if (!map.getLayer(HOVER_LAYER_ID)) {
    map.addLayer({
      id: HOVER_LAYER_ID,
      type: "circle",
      source: HOVER_SOURCE_ID,
      paint: {
        "circle-radius": 7,
        "circle-color": "#ef4444",
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 2,
      },
    });
  }
}

function setRouteData(map: MapboxMap, route: RoutingResult | null) {
  const src = map.getSource(ROUTE_SOURCE_ID) as GeoJSONSource | undefined;
  src?.setData(toLineCollection(route?.geometry.coordinates ?? []));
}

function setHoverData(map: MapboxMap, coord: LngLat | null) {
  const src = map.getSource(HOVER_SOURCE_ID) as GeoJSONSource | undefined;
  src?.setData(toPointCollection(coord));
}

async function waitForTerrainReady(map: MapboxMap): Promise<void> {
  if (map.areTilesLoaded()) return;
  await new Promise<void>((resolve) => {
    map.once("idle", () => resolve());
  });
}

function queryTerrainElevationMeters(map: MapboxMap, coordinate: LngLat): number | null {
  type TerrainQueryableMap = MapboxMap & {
    queryTerrainElevation?: (
      lngLat: { lng: number; lat: number },
      options?: { exaggerated?: boolean },
    ) => number | null;
  };

  const terrainMap = map as TerrainQueryableMap;
  if (typeof terrainMap.queryTerrainElevation !== "function") return null;

  const elevation = terrainMap.queryTerrainElevation(
    { lng: coordinate[0], lat: coordinate[1] },
    { exaggerated: false },
  );
  return typeof elevation === "number" ? elevation : null;
}

async function buildElevationProfile(
  map: MapboxMap,
  routeCoords: LngLat[],
  sampleIntervalMeters: number,
): Promise<{ samples: ElevationSample[]; missingSamples: number }> {
  const rawSamples = sampleAlongLine(routeCoords, sampleIntervalMeters);
  if (rawSamples.length === 0) {
    return { samples: [], missingSamples: 0 };
  }

  await waitForTerrainReady(map);

  const samples: ElevationSample[] = [];
  let missingSamples = 0;

  for (const rawSample of rawSamples) {
    const measured = queryTerrainElevationMeters(map, rawSample.coordinate);
    if (typeof measured === "number" && Number.isFinite(measured)) {
      samples.push({
        distanceMeters: rawSample.distanceMeters,
        elevationMeters: measured,
        coordinate: rawSample.coordinate,
      });
      continue;
    }

    missingSamples += 1;

    const fallbackElevation =
      samples.length > 0 ? samples[samples.length - 1].elevationMeters : 0;
    samples.push({
      distanceMeters: rawSample.distanceMeters,
      elevationMeters: fallbackElevation,
      coordinate: rawSample.coordinate,
    });
  }

  return { samples, missingSamples };
}

function computeGainLoss(samples: ElevationSample[]): { gain: number; loss: number } {
  let gain = 0;
  let loss = 0;

  for (let i = 1; i < samples.length; i += 1) {
    const delta = samples[i].elevationMeters - samples[i - 1].elevationMeters;
    if (delta > 0) {
      gain += delta;
    } else {
      loss += Math.abs(delta);
    }
  }

  return { gain, loss };
}

function buildProfilePath(samples: ElevationSample[], width: number, height: number): string {
  if (samples.length === 0) return "";

  const maxDistance = samples[samples.length - 1].distanceMeters || 1;
  const elevations = samples.map((sample) => sample.elevationMeters);
  const minElevation = Math.min(...elevations);
  const maxElevation = Math.max(...elevations);
  const elevationRange = Math.max(1, maxElevation - minElevation);

  return samples
    .map((sample, index) => {
      const x = (sample.distanceMeters / maxDistance) * width;
      const y =
        height - ((sample.elevationMeters - minElevation) / elevationRange) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function normalizeError(error: unknown): string {
  if (error instanceof ProviderRequestError) {
    if (error.code === "missing_token") {
      return "Mapbox token mangler. Sett VITE_MAPBOX_TOKEN for routing/terrain data.";
    }
    return error.message;
  }

  if (error instanceof Error) return error.message;
  return "Failed to compute elevation profile";
}

function ElevationProfileView({ theme, onPrimaryMapReady }: PatternViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const recreateTokenRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const [loaded, setLoaded] = useState(false);
  const [provider, setProvider] = useState<ProviderMode>("mapbox");
  const [profile, setProfile] = useState<RoutingProfile>("driving");
  const [sampleIntervalMeters, setSampleIntervalMeters] = useState(150);
  const [route, setRoute] = useState<RoutingResult | null>(null);
  const [samples, setSamples] = useState<ElevationSample[]>([]);
  const [missingSamples, setMissingSamples] = useState(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  const routeRef = useRef<RoutingResult | null>(null);
  const samplesRef = useRef<ElevationSample[]>([]);
  const hoverIndexRef = useRef<number | null>(null);

  const activeProvider = useMemo(
    () => (provider === "osrm" ? osrmRoutingProvider : mapboxRoutingProvider),
    [provider],
  );
  const style = styleFor(theme);

  const elevationStats = useMemo(() => computeGainLoss(samples), [samples]);

  const hoveredSample =
    hoverIndex !== null && hoverIndex >= 0 && hoverIndex < samples.length
      ? samples[hoverIndex]
      : null;

  const profilePath = useMemo(() => buildProfilePath(samples, 360, 120), [samples]);

  const refreshRouteAndProfile = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoadingProfile(true);
    setError("");
    setStatus("Fetching route...");

    try {
      const nextRoute = await activeProvider.route(
        {
          coordinates: WAYPOINTS,
          profile,
        },
        controller.signal,
      );

      setRoute(nextRoute);
      setStatus("Sampling terrain elevations...");

      ensureTerrain(map);

      const profileResult = await buildElevationProfile(
        map,
        nextRoute.geometry.coordinates,
        sampleIntervalMeters,
      );

      setSamples(profileResult.samples);
      setMissingSamples(profileResult.missingSamples);
      setStatus(
        profileResult.missingSamples > 0
          ? `Profile ready (${profileResult.missingSamples} fallback sample(s) where terrain data was unavailable).`
          : "Profile ready.",
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;

      setRoute(null);
      setSamples([]);
      setMissingSamples(0);
      setHoverIndex(null);
      setStatus("");
      setError(normalizeError(err));
    } finally {
      setIsLoadingProfile(false);
    }
  }, [activeProvider, profile, sampleIntervalMeters]);

  useEffect(() => {
    routeRef.current = route;
    const map = mapRef.current;
    if (!map || !loaded) return;

    setRouteData(map, route);
    if (route && route.geometry.coordinates.length >= 2) {
      map.fitBounds(getBounds(route.geometry.coordinates), {
        padding: 80,
        duration: 600,
      });
    }
  }, [loaded, route]);

  useEffect(() => {
    samplesRef.current = samples;
  }, [samples]);

  useEffect(() => {
    hoverIndexRef.current = hoverIndex;

    const map = mapRef.current;
    if (!map || !loaded) return;

    const coord =
      hoverIndex !== null && hoverIndex >= 0 && hoverIndex < samples.length
        ? samples[hoverIndex].coordinate
        : null;

    setHoverData(map, coord);
  }, [hoverIndex, loaded, samples]);

  useEffect(() => {
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

    void (async () => {
      const mapboxgl = await loadMapboxGL();
      if (recreateTokenRef.current !== token) return;

      mapboxgl.accessToken = MAPBOX_TOKEN ?? "";
      const map = new mapboxgl.Map({
        container: containerRef.current!,
        style,
        center: camera?.center ?? WAYPOINTS[0],
        zoom: camera?.zoom ?? 12,
        bearing: camera?.bearing ?? 0,
        pitch: camera?.pitch ?? 45,
      });
      map.addControl(new mapboxgl.NavigationControl(), "top-right");
      mapRef.current = map;

      map.on("load", () => {
        if (recreateTokenRef.current !== token) return;
        ensureTerrain(map);
        ensureLayers(map);
        setRouteData(map, routeRef.current);

        const hoverCoord =
          hoverIndexRef.current !== null &&
          hoverIndexRef.current >= 0 &&
          hoverIndexRef.current < samplesRef.current.length
            ? samplesRef.current[hoverIndexRef.current].coordinate
            : null;
        setHoverData(map, hoverCoord);

        setLoaded(true);
        onPrimaryMapReady?.(map);
      });
    })().catch(() => {
      setError("Failed to load map view");
    });

    return () => {
      recreateTokenRef.current += 1;
      abortRef.current?.abort();
      const map = mapRef.current;
      if (map) {
        try {
          map.remove();
        } catch {
          // ignore
        }
      }
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    const camera = getCamera(map);
    map.setStyle(style);

    once(map, "style.load", () => {
      map.jumpTo(camera);
      ensureTerrain(map);
      ensureLayers(map);
      setRouteData(map, routeRef.current);

      const hoverCoord =
        hoverIndexRef.current !== null &&
        hoverIndexRef.current >= 0 &&
        hoverIndexRef.current < samplesRef.current.length
          ? samplesRef.current[hoverIndexRef.current].coordinate
          : null;
      setHoverData(map, hoverCoord);
    });
  }, [loaded, style]);

  useEffect(() => {
    if (!loaded) return;
    void refreshRouteAndProfile();
  }, [loaded, refreshRouteAndProfile]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="panel status-panel absolute left-4 top-16 z-10 w-[460px] p-3">
        <div className="status-panel__message">
          Terrain elevation profile sampled along the active route. Hover the graph
          to highlight the corresponding map position.
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label htmlFor="elevation-provider">Provider</label>
            <select
              id="elevation-provider"
              value={provider}
              onChange={(event) =>
                setProvider(event.target.value === "osrm" ? "osrm" : "mapbox")
              }
            >
              <option value="mapbox">Mapbox</option>
              <option value="osrm">OSRM</option>
            </select>
          </div>
          <div>
            <label htmlFor="elevation-profile">Profile</label>
            <select
              id="elevation-profile"
              value={profile}
              onChange={(event) => {
                const next = event.target.value;
                setProfile(
                  next === "walking" || next === "cycling" ? next : "driving",
                );
              }}
            >
              <option value="driving">Driving</option>
              <option value="walking">Walking</option>
              <option value="cycling">Cycling</option>
            </select>
          </div>
          <div>
            <label htmlFor="elevation-interval">Interval (m)</label>
            <input
              id="elevation-interval"
              type="number"
              min={20}
              max={500}
              step={10}
              value={sampleIntervalMeters}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next)) return;
                setSampleIntervalMeters(Math.min(500, Math.max(20, next)));
              }}
              className="w-full rounded border border-border/30 bg-bg/80 px-2 py-1 text-sm"
            />
          </div>
        </div>

        <div className="status-panel__actions">
          <button
            type="button"
            className="status-panel__button primary"
            onClick={() => void refreshRouteAndProfile()}
            disabled={isLoadingProfile}
          >
            {isLoadingProfile ? "Loading..." : "Refresh profile"}
          </button>
        </div>

        {route ? (
          <div className="grid grid-cols-4 gap-2 font-mono text-xs">
            <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
              <div className="text-muted">Distance</div>
              <div className="text-fg">{formatDistance(route.summary.distanceMeters)}</div>
            </div>
            <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
              <div className="text-muted">Duration</div>
              <div className="text-fg">{formatDuration(route.summary.durationSeconds)}</div>
            </div>
            <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
              <div className="text-muted">Gain</div>
              <div className="text-fg">{Math.round(elevationStats.gain)} m</div>
            </div>
            <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
              <div className="text-muted">Loss</div>
              <div className="text-fg">{Math.round(elevationStats.loss)} m</div>
            </div>
          </div>
        ) : null}

        <div
          className="rounded border border-border/30 bg-bg/30 p-2"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <svg
            viewBox="0 0 360 120"
            className="h-32 w-full"
            onMouseMove={(event) => {
              if (samples.length === 0) return;
              const rect = event.currentTarget.getBoundingClientRect();
              const ratio = Math.min(
                1,
                Math.max(0, (event.clientX - rect.left) / rect.width),
              );
              const index = Math.round(ratio * (samples.length - 1));
              setHoverIndex(index);
            }}
          >
            <rect x={0} y={0} width={360} height={120} fill="rgba(0,0,0,0.04)" />
            {profilePath ? (
              <path
                d={profilePath}
                fill="none"
                stroke="#2563eb"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {hoveredSample ? (
              <line
                x1={
                  samples.length > 1
                    ? (hoveredSample.distanceMeters /
                        (samples[samples.length - 1].distanceMeters || 1)) *
                      360
                    : 0
                }
                y1={0}
                x2={
                  samples.length > 1
                    ? (hoveredSample.distanceMeters /
                        (samples[samples.length - 1].distanceMeters || 1)) *
                      360
                    : 0
                }
                y2={120}
                stroke="#ef4444"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            ) : null}
          </svg>

          {hoveredSample ? (
            <div className="mt-1 font-mono text-[11px] text-muted">
              {formatDistance(hoveredSample.distanceMeters)} • {Math.round(hoveredSample.elevationMeters)} m
            </div>
          ) : (
            <div className="mt-1 font-mono text-[11px] text-muted">
              Hover profile to inspect elevation point.
            </div>
          )}
        </div>

        {status ? <div className="text-xs text-muted">{status}</div> : null}
        {missingSamples > 0 ? (
          <div className="text-xs text-muted">
            Terrain fallback used for {missingSamples} sample point(s).
          </div>
        ) : null}
        {error ? <div className="text-xs text-danger">{error}</div> : null}
      </div>
    </div>
  );
}

export const elevationProfilePattern: Pattern = {
  id: "elevation-profile",
  name: "Elevation Profile Along Route",
  category: "navigation",
  description:
    "Sample terrain elevation along a routed line and sync chart hover with map marker position.",
  controls: [],
  disableGlobalSearch: true,
  setup() {},
  cleanup() {},
  update() {},
  view: ElevationProfileView,
  snippet: `// 1) Fetch route geometry
const route = await provider.route({ coordinates, profile: 'driving' });

// 2) Enable terrain and sample elevations
map.addSource('dem', { type: 'raster-dem', url: 'mapbox://mapbox.terrain-rgb' });
map.setTerrain({ source: 'dem', exaggeration: 1 });

const elevation = map.queryTerrainElevation({ lng, lat }, { exaggerated: false });`,
};
