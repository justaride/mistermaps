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
  RoutingAlternative,
  RoutingProfile,
  RoutingSummary,
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

export type RouteOption = {
  id: string;
  geometry: {
    type: "LineString";
    coordinates: LngLat[];
  };
  summary: RoutingSummary;
};

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const ROUTES_SOURCE_ID = "route-alternatives-src";
const ROUTES_INACTIVE_LAYER_ID = "route-alternatives-inactive-lyr";
const ROUTES_ACTIVE_LAYER_ID = "route-alternatives-active-lyr";

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

function normalizeError(error: unknown): string {
  if (error instanceof ProviderRequestError) {
    if (error.code === "missing_token") {
      return "Mapbox token mangler. Sett VITE_MAPBOX_TOKEN for Mapbox-baserte kall.";
    }
    return error.message;
  }

  if (error instanceof Error) return error.message;
  return "Failed to fetch route alternatives";
}

export function routesToFeatureCollection(
  routes: RouteOption[],
  activeRouteId: string | null,
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  return {
    type: "FeatureCollection",
    features: routes.map((route) => ({
      type: "Feature",
      properties: {
        routeId: route.id,
        isActive: route.id === activeRouteId,
        distanceMeters: route.summary.distanceMeters,
        durationSeconds: route.summary.durationSeconds,
      },
      geometry: route.geometry,
    })),
  };
}

function ensureLayers(map: MapboxMap) {
  if (!map.getSource(ROUTES_SOURCE_ID)) {
    map.addSource(ROUTES_SOURCE_ID, {
      type: "geojson",
      data: routesToFeatureCollection([], null),
    });
  }

  if (!map.getLayer(ROUTES_INACTIVE_LAYER_ID)) {
    map.addLayer({
      id: ROUTES_INACTIVE_LAYER_ID,
      type: "line",
      source: ROUTES_SOURCE_ID,
      filter: ["==", ["get", "isActive"], false],
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#6b7280",
        "line-width": 4,
        "line-opacity": 0.65,
      },
    });
  }

  if (!map.getLayer(ROUTES_ACTIVE_LAYER_ID)) {
    map.addLayer({
      id: ROUTES_ACTIVE_LAYER_ID,
      type: "line",
      source: ROUTES_SOURCE_ID,
      filter: ["==", ["get", "isActive"], true],
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#2563eb",
        "line-width": 7,
        "line-opacity": 0.95,
      },
    });
  }
}

function setRoutesData(
  map: MapboxMap,
  routes: RouteOption[],
  activeRouteId: string | null,
) {
  const src = map.getSource(ROUTES_SOURCE_ID) as GeoJSONSource | undefined;
  src?.setData(routesToFeatureCollection(routes, activeRouteId));
}

function RouteAlternativesView({
  theme,
  onPrimaryMapReady,
}: PatternViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const recreateTokenRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const [loaded, setLoaded] = useState(false);
  const [provider, setProvider] = useState<ProviderMode>("mapbox");
  const [profile, setProfile] = useState<RoutingProfile>("driving");
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);

  const routesRef = useRef<RouteOption[]>([]);
  const activeRouteIdRef = useRef<string | null>(null);

  const activeProvider = useMemo(
    () => (provider === "osrm" ? osrmRoutingProvider : mapboxRoutingProvider),
    [provider],
  );
  const style = styleFor(theme);

  const selectedRoute =
    routes.find((route) => route.id === activeRouteId) ?? routes[0] ?? null;

  const requestRoutes = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoadingRoutes(true);
    setError("");
    setStatus("Fetching alternatives...");

    try {
      const response = await activeProvider.route(
        {
          coordinates: WAYPOINTS,
          profile,
          alternatives: true,
        },
        controller.signal,
      );

      const alternatives: RoutingAlternative[] = response.alternatives ?? [];
      const nextRoutes: RouteOption[] = [
        {
          id: "primary",
          geometry: response.geometry,
          summary: response.summary,
        },
        ...alternatives.map((alternative, index) => ({
          id: alternative.id || `alt-${index + 1}`,
          geometry: alternative.geometry,
          summary: alternative.summary,
        })),
      ];

      setRoutes(nextRoutes);
      setActiveRouteId(nextRoutes[0]?.id ?? null);
      setStatus(`Loaded ${nextRoutes.length} route option(s).`);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;

      setRoutes([]);
      setActiveRouteId(null);
      setStatus("");
      setError(normalizeError(err));
    } finally {
      setIsLoadingRoutes(false);
    }
  }, [activeProvider, profile]);

  useEffect(() => {
    routesRef.current = routes;
    activeRouteIdRef.current = activeRouteId;

    const map = mapRef.current;
    if (!map || !loaded) return;

    setRoutesData(map, routes, activeRouteId);

    if (selectedRoute && selectedRoute.geometry.coordinates.length >= 2) {
      map.fitBounds(getBounds(selectedRoute.geometry.coordinates), {
        padding: 80,
        duration: 600,
      });
    }
  }, [activeRouteId, loaded, routes, selectedRoute]);

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
        pitch: camera?.pitch ?? 0,
      });
      map.addControl(new mapboxgl.NavigationControl(), "top-right");
      mapRef.current = map;

      map.on("load", () => {
        if (recreateTokenRef.current !== token) return;
        ensureLayers(map);
        setRoutesData(map, routesRef.current, activeRouteIdRef.current);
        setLoaded(true);
        onPrimaryMapReady?.(map);
      });

      map.on("click", (event) => {
        const features = map.queryRenderedFeatures(event.point, {
          layers: [ROUTES_ACTIVE_LAYER_ID, ROUTES_INACTIVE_LAYER_ID],
        });
        const routeId = features[0]?.properties?.routeId;
        if (typeof routeId === "string") {
          setActiveRouteId(routeId);
        }
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
      ensureLayers(map);
      setRoutesData(map, routesRef.current, activeRouteIdRef.current);
    });
  }, [loaded, style]);

  useEffect(() => {
    if (!loaded) return;
    void requestRoutes();
  }, [loaded, requestRoutes]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="panel status-panel absolute left-4 top-16 z-10 w-[420px] p-3">
        <div className="status-panel__message">
          Fetch and compare multiple routes. Click a line on the map or choose in
          the list to set the active route.
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="alternatives-provider">Provider</label>
            <select
              id="alternatives-provider"
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
            <label htmlFor="alternatives-profile">Profile</label>
            <select
              id="alternatives-profile"
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
        </div>

        <div className="status-panel__actions">
          <button
            type="button"
            className="status-panel__button primary"
            onClick={() => void requestRoutes()}
            disabled={isLoadingRoutes}
          >
            {isLoadingRoutes ? "Loading..." : "Refresh alternatives"}
          </button>
        </div>

        {selectedRoute ? (
          <div className="grid grid-cols-3 gap-2 font-mono text-xs">
            <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
              <div className="text-muted">Active</div>
              <div className="text-fg">{selectedRoute.id}</div>
            </div>
            <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
              <div className="text-muted">Distance</div>
              <div className="text-fg">
                {formatDistance(selectedRoute.summary.distanceMeters)}
              </div>
            </div>
            <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
              <div className="text-muted">Duration</div>
              <div className="text-fg">
                {formatDuration(selectedRoute.summary.durationSeconds)}
              </div>
            </div>
          </div>
        ) : null}

        {status ? <div className="text-xs text-muted">{status}</div> : null}
        {error ? <div className="text-xs text-danger">{error}</div> : null}

        <div className="max-h-[220px] overflow-auto rounded-sm border border-border/30 bg-bg/40 p-2">
          <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-widest text-muted">
            Alternatives ({routes.length})
          </div>

          {routes.length === 0 ? (
            <div className="text-xs text-muted">No routes loaded.</div>
          ) : (
            <div className="space-y-2">
              {routes.map((route) => {
                const active = route.id === activeRouteId;
                return (
                  <button
                    key={route.id}
                    type="button"
                    className={`w-full rounded border px-2 py-2 text-left transition ${
                      active
                        ? "border-blue-600 bg-blue-600/10"
                        : "border-border/30 bg-bg/40"
                    }`}
                    onClick={() => setActiveRouteId(route.id)}
                  >
                    <div className="font-mono text-xs text-fg">{route.id}</div>
                    <div className="mt-1 font-mono text-[11px] text-muted">
                      {formatDistance(route.summary.distanceMeters)} • {formatDuration(route.summary.durationSeconds)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const routeAlternativesPattern: Pattern = {
  id: "route-alternatives",
  name: "Route Alternatives Selector",
  category: "navigation",
  description:
    "Fetch multiple route options and switch active route from map click or selector list.",
  controls: [],
  disableGlobalSearch: true,
  setup() {},
  cleanup() {},
  update() {},
  view: RouteAlternativesView,
  snippet: `const result = await provider.route({
  coordinates: [start, end],
  profile: 'driving',
  alternatives: true
});

const routes = [
  { id: 'primary', geometry: result.geometry, summary: result.summary },
  ...(result.alternatives ?? [])
];`,
};
