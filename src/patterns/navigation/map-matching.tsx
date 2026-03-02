import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import type { Pattern, PatternViewProps, Theme } from "../../types";
import { mapboxBasemapProvider } from "../../providers";
import { ProviderRequestError } from "../../providers/errors";
import { mapboxMapMatchingProvider } from "../../providers/routing";
import type { LngLat, RoutingProfile } from "../../providers/types";
import { once } from "../utils/map-compat";
import { loadMapboxGL } from "../utils/load-map-engine";

type CameraState = {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
};

export type ParsedTrace = {
  coords: LngLat[];
  error: string | null;
};

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const ORIGINAL_SOURCE_ID = "map-matching-original-src";
const MATCHED_SOURCE_ID = "map-matching-matched-src";
const ORIGINAL_LAYER_ID = "map-matching-original-lyr";
const MATCHED_LAYER_ID = "map-matching-matched-lyr";

const SAMPLE_TRACE: LngLat[] = [
  [10.7443, 59.9135],
  [10.748, 59.9147],
  [10.7527, 59.9153],
  [10.7574, 59.9162],
  [10.762, 59.9174],
  [10.7654, 59.9182],
  [10.7692, 59.919],
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

export function lineDistance(coords: LngLat[]): number {
  if (coords.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < coords.length; i += 1) {
    total += haversineMeters(coords[i - 1], coords[i]);
  }
  return total;
}

function coordsToTraceText(coords: LngLat[]): string {
  return coords.map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join("\n");
}

export function parseTraceInput(input: string): ParsedTrace {
  const text = input.trim();
  if (!text) return { coords: [], error: "Trace is empty" };

  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (!Array.isArray(parsed)) {
        return { coords: [], error: "JSON trace must be an array of [lng, lat]" };
      }

      const coords: LngLat[] = [];
      for (const point of parsed) {
        if (!Array.isArray(point) || point.length < 2) continue;
        const [lng, lat] = point;
        if (typeof lng !== "number" || typeof lat !== "number") continue;
        coords.push([lng, lat]);
      }

      if (coords.length < 2) {
        return { coords, error: "Trace must contain at least two valid coordinates" };
      }

      return { coords, error: null };
    } catch {
      return { coords: [], error: "Could not parse JSON trace input" };
    }
  }

  const coords: LngLat[] = [];
  const lines = text.split(/\r?\n/g);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const [lngText, latText] = trimmed.split(",").map((part) => part?.trim() ?? "");
    const lng = Number(lngText);
    const lat = Number(latText);

    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return {
        coords,
        error: `Invalid coordinate line: "${trimmed}" (expected "lng,lat")`,
      };
    }

    coords.push([lng, lat]);
  }

  if (coords.length < 2) {
    return { coords, error: "Trace must contain at least two coordinates" };
  }

  return { coords, error: null };
}

function toLineFeatureCollection(
  coords: LngLat[],
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  if (coords.length < 2) {
    return { type: "FeatureCollection", features: [] };
  }

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

function ensureLayers(map: MapboxMap) {
  if (!map.getSource(ORIGINAL_SOURCE_ID)) {
    map.addSource(ORIGINAL_SOURCE_ID, {
      type: "geojson",
      data: toLineFeatureCollection([]),
    });
  }

  if (!map.getSource(MATCHED_SOURCE_ID)) {
    map.addSource(MATCHED_SOURCE_ID, {
      type: "geojson",
      data: toLineFeatureCollection([]),
    });
  }

  if (!map.getLayer(ORIGINAL_LAYER_ID)) {
    map.addLayer({
      id: ORIGINAL_LAYER_ID,
      type: "line",
      source: ORIGINAL_SOURCE_ID,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#f97316",
        "line-width": 4,
        "line-opacity": 0.8,
        "line-dasharray": [1, 1],
      },
    });
  }

  if (!map.getLayer(MATCHED_LAYER_ID)) {
    map.addLayer({
      id: MATCHED_LAYER_ID,
      type: "line",
      source: MATCHED_SOURCE_ID,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#2563eb",
        "line-width": 6,
        "line-opacity": 0.95,
      },
    });
  }
}

function setOriginalTrace(map: MapboxMap, coords: LngLat[]) {
  const src = map.getSource(ORIGINAL_SOURCE_ID) as GeoJSONSource | undefined;
  src?.setData(toLineFeatureCollection(coords));
}

function setMatchedTrace(map: MapboxMap, coords: LngLat[]) {
  const src = map.getSource(MATCHED_SOURCE_ID) as GeoJSONSource | undefined;
  src?.setData(toLineFeatureCollection(coords));
}

function normalizeError(error: unknown): string {
  if (error instanceof ProviderRequestError) {
    if (error.code === "missing_token") {
      return "Mapbox token mangler. Sett VITE_MAPBOX_TOKEN for Map Matching API.";
    }
    return error.message;
  }

  if (error instanceof Error) return error.message;
  return "Map matching failed";
}

function MapMatchingView({ theme, onPrimaryMapReady }: PatternViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const recreateTokenRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const [loaded, setLoaded] = useState(false);
  const [traceText, setTraceText] = useState(coordsToTraceText(SAMPLE_TRACE));
  const [profile, setProfile] = useState<RoutingProfile>("driving");
  const [tidy, setTidy] = useState(true);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isMatching, setIsMatching] = useState(false);
  const [matchedCoords, setMatchedCoords] = useState<LngLat[]>([]);
  const [confidence, setConfidence] = useState<number | null>(null);

  const parsedTrace = useMemo(() => parseTraceInput(traceText), [traceText]);
  const style = styleFor(theme);

  const originalCoordsRef = useRef<LngLat[]>([]);
  const matchedCoordsRef = useRef<LngLat[]>([]);

  const runMatch = useCallback(async () => {
    if (parsedTrace.error) {
      setError(parsedTrace.error);
      setStatus("");
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsMatching(true);
    setError("");
    setStatus("Matching trace to road network...");

    try {
      const result = await mapboxMapMatchingProvider.match(
        {
          trace: parsedTrace.coords,
          profile,
          tidy,
        },
        controller.signal,
      );

      setMatchedCoords(result.matchedGeometry.coordinates);
      setConfidence(result.confidence ?? null);
      setStatus("Matched trace ready.");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setMatchedCoords([]);
      setConfidence(null);
      setStatus("");
      setError(normalizeError(err));
    } finally {
      setIsMatching(false);
    }
  }, [parsedTrace, profile, tidy]);

  useEffect(() => {
    originalCoordsRef.current = parsedTrace.coords;
    const map = mapRef.current;
    if (!map || !loaded) return;
    setOriginalTrace(map, parsedTrace.coords);
  }, [loaded, parsedTrace.coords]);

  useEffect(() => {
    matchedCoordsRef.current = matchedCoords;

    const map = mapRef.current;
    if (!map || !loaded) return;

    setMatchedTrace(map, matchedCoords);

    const coordsForBounds = matchedCoords.length >= 2 ? matchedCoords : parsedTrace.coords;
    if (coordsForBounds.length >= 2) {
      map.fitBounds(getBounds(coordsForBounds), {
        padding: 80,
        duration: 600,
      });
    }
  }, [loaded, matchedCoords, parsedTrace.coords]);

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
        center: camera?.center ?? SAMPLE_TRACE[0],
        zoom: camera?.zoom ?? 13,
        bearing: camera?.bearing ?? 0,
        pitch: camera?.pitch ?? 0,
      });
      map.addControl(new mapboxgl.NavigationControl(), "top-right");
      mapRef.current = map;

      map.on("load", () => {
        if (recreateTokenRef.current !== token) return;
        ensureLayers(map);
        setOriginalTrace(map, originalCoordsRef.current);
        setMatchedTrace(map, matchedCoordsRef.current);
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
      ensureLayers(map);
      setOriginalTrace(map, originalCoordsRef.current);
      setMatchedTrace(map, matchedCoordsRef.current);
    });
  }, [loaded, style]);

  useEffect(() => {
    if (!loaded) return;
    void runMatch();
  }, [loaded]);

  const originalDistance = lineDistance(parsedTrace.coords);
  const matchedDistance = lineDistance(matchedCoords);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="panel status-panel absolute left-4 top-16 z-10 w-[440px] p-3">
        <div className="status-panel__message">
          Compare raw GPS trace vs snapped road trace. Paste input as lines of
          <span className="font-mono"> lng,lat</span> or JSON array.
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="matching-profile">Profile</label>
            <select
              id="matching-profile"
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
          <div className="flex items-end">
            <label className="mb-0 inline-flex items-center gap-2 text-xs text-fg">
              <input
                type="checkbox"
                checked={tidy}
                onChange={(event) => setTidy(event.target.checked)}
              />
              Enable tidy
            </label>
          </div>
        </div>

        <textarea
          className="geojson-import__textarea"
          rows={7}
          value={traceText}
          onChange={(event) => setTraceText(event.target.value)}
          spellCheck={false}
        />

        <div className="status-panel__actions">
          <button
            type="button"
            className="status-panel__button"
            onClick={() => setTraceText(coordsToTraceText(SAMPLE_TRACE))}
          >
            Load sample trace
          </button>
          <button
            type="button"
            className="status-panel__button primary"
            onClick={() => void runMatch()}
            disabled={isMatching}
          >
            {isMatching ? "Matching..." : "Run map matching"}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 font-mono text-xs">
          <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
            <div className="text-muted">Raw</div>
            <div className="text-fg">{formatDistance(originalDistance)}</div>
          </div>
          <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
            <div className="text-muted">Matched</div>
            <div className="text-fg">{formatDistance(matchedDistance)}</div>
          </div>
          <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
            <div className="text-muted">Confidence</div>
            <div className="text-fg">
              {confidence === null ? "-" : `${Math.round(confidence * 100)}%`}
            </div>
          </div>
        </div>

        {status ? <div className="text-xs text-muted">{status}</div> : null}
        {parsedTrace.error ? (
          <div className="text-xs text-danger">{parsedTrace.error}</div>
        ) : null}
        {error ? <div className="text-xs text-danger">{error}</div> : null}
      </div>
    </div>
  );
}

export const mapMatchingPattern: Pattern = {
  id: "map-matching",
  name: "Snap-To-Road / Map Matching",
  category: "navigation",
  description:
    "Compare raw GPS traces against Mapbox map-matched geometry with confidence and error handling.",
  controls: [],
  disableGlobalSearch: true,
  setup() {},
  cleanup() {},
  update() {},
  view: MapMatchingView,
  snippet: `const result = await mapboxMapMatchingProvider.match({
  trace,
  profile: 'driving',
  tidy: true
});

map.getSource('raw-trace').setData(rawFeatureCollection);
map.getSource('matched-trace').setData({
  type: 'Feature',
  geometry: result.matchedGeometry,
  properties: {}
});`,
};
