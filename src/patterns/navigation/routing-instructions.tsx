import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  GeoJSONSource,
  Map as MapboxMap,
  Marker,
} from "mapbox-gl";
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
  RoutingStep,
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

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const ROUTE_SOURCE_ID = "routing-instructions-route-src";
const ROUTE_LAYER_ID = "routing-instructions-route-lyr";

const INITIAL_WAYPOINTS: LngLat[] = [
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

function emptyLineFeatureCollection(): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  return {
    type: "FeatureCollection",
    features: [],
  };
}

function routeFeatureCollection(
  result: RoutingResult | null,
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  if (!result) return emptyLineFeatureCollection();
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          distanceMeters: result.summary.distanceMeters,
          durationSeconds: result.summary.durationSeconds,
        },
        geometry: result.geometry,
      },
    ],
  };
}

function ensureRouteLayer(map: MapboxMap) {
  if (!map.getSource(ROUTE_SOURCE_ID)) {
    map.addSource(ROUTE_SOURCE_ID, {
      type: "geojson",
      data: emptyLineFeatureCollection(),
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
        "line-color": "#2563eb",
        "line-width": 6,
        "line-opacity": 0.92,
      },
    });
  }
}

function setRouteData(map: MapboxMap, result: RoutingResult | null) {
  const src = map.getSource(ROUTE_SOURCE_ID) as GeoJSONSource | undefined;
  src?.setData(routeFeatureCollection(result));
}

function createWaypointElement(index: number): HTMLDivElement {
  const el = document.createElement("div");
  el.style.width = "24px";
  el.style.height = "24px";
  el.style.borderRadius = "9999px";
  el.style.background = "#f97316";
  el.style.border = "2px solid #fff";
  el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.25)";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.font = "700 11px JetBrains Mono, monospace";
  el.style.color = "#fff";
  el.textContent = String(index + 1);
  return el;
}

function normalizeError(error: unknown): string {
  if (error instanceof ProviderRequestError) {
    if (error.code === "missing_token") {
      return "Mapbox token mangler. Sett VITE_MAPBOX_TOKEN for Mapbox-baserte kall.";
    }
    return error.message;
  }

  if (error instanceof Error) return error.message;
  return "Routing request failed";
}

function RoutingInstructionsView({
  theme,
  onPrimaryMapReady,
}: PatternViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const recreateTokenRef = useRef(0);
  const mapboxModuleRef = useRef<Awaited<ReturnType<typeof loadMapboxGL>> | null>(
    null,
  );
  const markersRef = useRef<Marker[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<RoutingResult | null>(null);

  const [loaded, setLoaded] = useState(false);
  const [provider, setProvider] = useState<ProviderMode>("mapbox");
  const [profile, setProfile] = useState<RoutingProfile>("driving");
  const [waypoints, setWaypoints] = useState<LngLat[]>(INITIAL_WAYPOINTS);
  const [result, setResult] = useState<RoutingResult | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isRouting, setIsRouting] = useState(false);

  const activeProvider = useMemo(
    () => (provider === "osrm" ? osrmRoutingProvider : mapboxRoutingProvider),
    [provider],
  );
  const style = styleFor(theme);

  const clearMarkers = useCallback(() => {
    for (const marker of markersRef.current) {
      try {
        marker.remove();
      } catch {
        // ignore
      }
    }
    markersRef.current = [];
  }, []);

  const syncMarkers = useCallback(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxModuleRef.current;
    if (!map || !mapboxgl) return;

    clearMarkers();

    markersRef.current = waypoints.map((coord, index) => {
      const marker = new mapboxgl.Marker({
        draggable: true,
        element: createWaypointElement(index),
      })
        .setLngLat(coord)
        .addTo(map);

      marker.on("dragend", () => {
        const ll = marker.getLngLat();
        setWaypoints((prev) => {
          if (!prev[index]) return prev;
          const next = [...prev];
          next[index] = [ll.lng, ll.lat];
          return next;
        });
      });

      return marker;
    });
  }, [clearMarkers, waypoints]);

  const requestRoute = useCallback(
    async (coords: LngLat[]) => {
      if (coords.length < 2) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsRouting(true);
      setError("");
      setStatus("Calculating route...");

      try {
        const nextResult = await activeProvider.route(
          {
            coordinates: coords,
            profile,
          },
          controller.signal,
        );

        setResult(nextResult);
        setStatus(
          `Route ready (${activeProvider.id.toUpperCase()}, ${formatDistance(nextResult.summary.distanceMeters)}, ${formatDuration(nextResult.summary.durationSeconds)})`,
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;

        setResult(null);
        setStatus("");
        setError(normalizeError(err));
      } finally {
        setIsRouting(false);
      }
    },
    [activeProvider, profile],
  );

  useEffect(() => {
    resultRef.current = result;
    const map = mapRef.current;
    if (!map || !loaded) return;

    setRouteData(map, result);
    if (result && result.geometry.coordinates.length >= 2) {
      map.fitBounds(getBounds(result.geometry.coordinates), {
        padding: 80,
        duration: 600,
      });
    }
  }, [loaded, result]);

  useEffect(() => {
    if (!containerRef.current) return;

    const token = (recreateTokenRef.current += 1);
    const prev = mapRef.current;
    const camera = prev ? getCamera(prev) : null;

    if (prev) {
      clearMarkers();
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

      mapboxModuleRef.current = mapboxgl;
      mapboxgl.accessToken = MAPBOX_TOKEN ?? "";

      const map = new mapboxgl.Map({
        container: containerRef.current!,
        style,
        center: camera?.center ?? waypoints[0],
        zoom: camera?.zoom ?? 12,
        bearing: camera?.bearing ?? 0,
        pitch: camera?.pitch ?? 0,
      });
      map.addControl(new mapboxgl.NavigationControl(), "top-right");
      mapRef.current = map;

      map.on("load", () => {
        if (recreateTokenRef.current !== token) return;
        ensureRouteLayer(map);
        setRouteData(map, resultRef.current);
        setLoaded(true);
        onPrimaryMapReady?.(map);
      });
    })().catch(() => {
      setError("Failed to load map view");
    });

    return () => {
      recreateTokenRef.current += 1;
      abortRef.current?.abort();
      clearMarkers();
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
      ensureRouteLayer(map);
      setRouteData(map, resultRef.current);
    });
  }, [loaded, style]);

  useEffect(() => {
    if (!loaded) return;
    syncMarkers();
  }, [loaded, syncMarkers]);

  useEffect(() => {
    if (!loaded) return;
    void requestRoute(waypoints);
  }, [loaded, requestRoute, waypoints]);

  const steps: RoutingStep[] = result?.steps ?? [];

  const addWaypointAtCenter = () => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    setWaypoints((prev) => [...prev, [c.lng, c.lat]]);
  };

  const removeLastWaypoint = () => {
    setWaypoints((prev) => {
      if (prev.length <= 2) return prev;
      return prev.slice(0, -1);
    });
  };

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="panel status-panel absolute left-4 top-16 z-10 w-[400px] p-3">
        <div className="status-panel__message">
          Turn-by-turn routing with draggable waypoints. Drag markers directly on
          the map to recompute instructions.
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="routing-provider">Provider</label>
            <select
              id="routing-provider"
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
            <label htmlFor="routing-profile">Profile</label>
            <select
              id="routing-profile"
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
            className="status-panel__button"
            onClick={addWaypointAtCenter}
          >
            Add waypoint
          </button>
          <button
            type="button"
            className="status-panel__button"
            onClick={removeLastWaypoint}
            disabled={waypoints.length <= 2}
          >
            Remove last
          </button>
          <button
            type="button"
            className="status-panel__button primary"
            onClick={() => void requestRoute(waypoints)}
            disabled={isRouting}
          >
            {isRouting ? "Routing..." : "Recalculate"}
          </button>
        </div>

        {result ? (
          <div className="grid grid-cols-3 gap-2 font-mono text-xs">
            <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
              <div className="text-muted">Distance</div>
              <div className="text-fg">
                {formatDistance(result.summary.distanceMeters)}
              </div>
            </div>
            <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
              <div className="text-muted">Duration</div>
              <div className="text-fg">
                {formatDuration(result.summary.durationSeconds)}
              </div>
            </div>
            <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
              <div className="text-muted">Waypoints</div>
              <div className="text-fg">{waypoints.length}</div>
            </div>
          </div>
        ) : null}

        {status ? <div className="text-xs text-muted">{status}</div> : null}
        {error ? <div className="text-xs text-danger">{error}</div> : null}

        <div className="max-h-[280px] overflow-auto rounded-sm border border-border/30 bg-bg/40 p-2">
          <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-widest text-muted">
            Instructions ({steps.length})
          </div>
          {steps.length === 0 ? (
            <div className="text-xs text-muted">No instructions available yet.</div>
          ) : (
            <ol className="space-y-2">
              {steps.map((step, index) => (
                <li
                  key={`${index}-${step.instruction}`}
                  className="rounded border border-border/20 bg-bg/40 p-2"
                >
                  <div className="font-mono text-xs text-fg">{step.instruction}</div>
                  <div className="mt-1 font-mono text-[11px] text-muted">
                    {formatDistance(step.distanceMeters)} • {formatDuration(step.durationSeconds)}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

export const routingInstructionsPattern: Pattern = {
  id: "routing-instructions",
  name: "Routing With Instructions Panel",
  category: "navigation",
  description:
    "Turn-by-turn routing panel with draggable waypoints, profile switching, and provider selection.",
  controls: [],
  disableGlobalSearch: true,
  setup() {},
  cleanup() {},
  update() {},
  view: RoutingInstructionsView,
  snippet: `// Routing with instructions + alternatives-ready result shape
const provider = providerMode === 'osrm' ? osrmRoutingProvider : mapboxRoutingProvider;
const result = await provider.route({
  coordinates: waypoints,
  profile: 'driving'
});

console.log(result.summary, result.steps);
map.getSource('route').setData({
  type: 'Feature',
  geometry: result.geometry,
  properties: {}
});`,
};
