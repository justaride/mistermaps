import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import maplibregl from "maplibre-gl";
import type { Pattern, PatternViewProps } from "../../types";
import {
  createGeocodingService,
  geocodingService,
  MapboxGeocodingProvider,
} from "../../providers/geocoding";
import { NominatimGeocodingProvider } from "../../providers/geocoding/nominatim-geocoding-provider";
import { PhotonGeocodingProvider } from "../../providers/geocoding/photon-geocoding-provider";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const MAPLIBRE_STYLES: Record<"light" | "dark", string> = {
  light: "https://tiles.openfreemap.org/styles/bright",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

type Engine = "mapbox" | "maplibre";
type ProviderMode = "auto" | "mapbox" | "nominatim" | "photon";

type SearchResult = {
  id: string;
  placeName: string;
  center: [number, number];
  providerId: string;
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function getProviderLabel(providerId: string): string {
  switch (providerId) {
    case "mapbox":
      return "Mapbox";
    case "nominatim":
      return "Nominatim";
    case "photon":
      return "Photon";
    default:
      return providerId;
  }
}

function getCamera(map: mapboxgl.Map | maplibregl.Map) {
  const center = map.getCenter();
  return {
    center: [center.lng, center.lat] as [number, number],
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  };
}

const PIN_SOURCE_ID = "geocode-pin-src";
const PIN_LAYER_ID = "geocode-pin-layer";

function removePin(map: mapboxgl.Map | maplibregl.Map) {
  const m = map as unknown as mapboxgl.Map;
  if (m.getLayer(PIN_LAYER_ID)) m.removeLayer(PIN_LAYER_ID);
  if (m.getSource(PIN_SOURCE_ID)) m.removeSource(PIN_SOURCE_ID);
}

function upsertPin(
  map: mapboxgl.Map | maplibregl.Map,
  center: [number, number],
) {
  const m = map as unknown as mapboxgl.Map;
  const data = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: center },
      },
    ],
  } as const;

  const existing = m.getSource(PIN_SOURCE_ID) as
    | mapboxgl.GeoJSONSource
    | undefined;

  if (existing) {
    existing.setData(data as never);
    return;
  }

  m.addSource(PIN_SOURCE_ID, {
    type: "geojson",
    data: data as never,
  });

  m.addLayer({
    id: PIN_LAYER_ID,
    type: "circle",
    source: PIN_SOURCE_ID,
    paint: {
      "circle-radius": 8,
      "circle-color": "#22c55e",
      "circle-stroke-color": "#052e16",
      "circle-stroke-width": 2,
    },
  });
}

function runAfterStyleReady(
  map: mapboxgl.Map | maplibregl.Map,
  fn: () => void,
) {
  const m = map as unknown as mapboxgl.Map;
  if (m.isStyleLoaded()) {
    fn();
    return;
  }
  (m as unknown as { once: (type: string, listener: () => void) => void }).once(
    "style.load",
    fn,
  );
}

export const geocodingSearchPattern: Pattern = {
  id: "geocoding-search",
  name: "Geocoding Search",
  category: "navigation",
  description:
    "Search places across providers (Mapbox/Nominatim/Photon) with a dual-engine (Mapbox/MapLibre) demo map.",
  controls: [
    {
      id: "engine",
      label: "Engine",
      type: "select",
      defaultValue: "mapbox",
      options: [
        { label: "Mapbox", value: "mapbox" },
        { label: "MapLibre", value: "maplibre" },
      ],
    },
    {
      id: "provider",
      label: "Provider",
      type: "select",
      defaultValue: "auto",
      options: [
        { label: "Auto (feature flags + fallback)", value: "auto" },
        { label: "Mapbox", value: "mapbox" },
        { label: "Nominatim", value: "nominatim" },
        { label: "Photon", value: "photon" },
      ],
    },
    {
      id: "dropPin",
      label: "Drop pin on select",
      type: "toggle",
      defaultValue: true,
    },
  ],

  disableGlobalSearch: true,

  // This pattern is driven by a custom view (dual-engine map + search UI).
  setup() {},
  cleanup() {},
  update() {},
  view: GeocodingSearchView,

  snippet: `// Geocoding search (provider switch + flyTo + optional pin)
const service = provider === 'auto'
  ? geocodingService
  : createGeocodingService({ primaryProvider: new NominatimGeocodingProvider() });

const { results } = await service.geocode({ query: 'Oslo', limit: 5 }, signal);
map.flyTo({ center: results[0].center, zoom: 14 });

map.addSource('pin', { type: 'geojson', data: pointGeojson });
map.addLayer({ id: 'pin', type: 'circle', source: 'pin' });`,
};

function GeocodingSearchView({
  theme,
  values,
  onPrimaryMapReady,
}: PatternViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | maplibregl.Map | null>(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const abortControllerRef = useRef<AbortController | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const pinCenterRef = useRef<[number, number] | null>(null);

  const engine = (values.engine === "maplibre" ? "maplibre" : "mapbox") as Engine;
  const providerMode = ((): ProviderMode => {
    const p = values.provider;
    if (p === "mapbox" || p === "nominatim" || p === "photon" || p === "auto") {
      return p;
    }
    return "auto";
  })();
  const dropPin = Boolean(values.dropPin);

  const mapStyle = useMemo(() => {
    if (engine === "maplibre") {
      return MAPLIBRE_STYLES[theme === "dark" ? "dark" : "light"];
    }
    return theme === "dark"
      ? "mapbox://styles/mapbox/dark-v11"
      : "mapbox://styles/mapbox/light-v11";
  }, [engine, theme]);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (!panelRef.current) return;
      if (panelRef.current.contains(e.target as Node)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const recreateMap = () => {
      setIsLoaded(false);

      const prev = mapRef.current;
      if (prev) {
        try {
          prev.remove();
        } catch {
          // ignore
        }
        mapRef.current = null;
      }

      if (engine === "mapbox") {
        mapboxgl.accessToken = MAPBOX_TOKEN;
        const map = new mapboxgl.Map({
          container: containerRef.current!,
          style: mapStyle,
          center: [10.75, 59.91],
          zoom: 11.5,
          bearing: 0,
          pitch: 0,
        });
        map.addControl(new mapboxgl.NavigationControl(), "top-right");

        map.on("load", () => {
          mapRef.current = map;
          setIsLoaded(true);
          onPrimaryMapReady?.(map);

          if (dropPin && pinCenterRef.current) {
            runAfterStyleReady(map, () => upsertPin(map, pinCenterRef.current!));
          }
        });
        return;
      }

      const map = new maplibregl.Map({
        container: containerRef.current!,
        style: mapStyle,
        center: [10.75, 59.91],
        zoom: 11.5,
        bearing: 0,
        pitch: 0,
      });
      map.addControl(new maplibregl.NavigationControl(), "top-right");

      map.on("load", () => {
        mapRef.current = map;
        setIsLoaded(true);
        onPrimaryMapReady?.(map as unknown as mapboxgl.Map);

        if (dropPin && pinCenterRef.current) {
          runAfterStyleReady(map, () => upsertPin(map, pinCenterRef.current!));
        }
      });
    };

    recreateMap();

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Intentionally recreate on engine changes (different library instances).
  }, [engine]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!isLoaded) return;

    // Preserve camera + re-apply pin after style change.
    const camera = getCamera(map);
    map.setStyle(mapStyle as never);
    (
      map as unknown as { once: (type: string, listener: () => void) => void }
    ).once("style.load", () => {
      map.jumpTo(camera as never);
      if (dropPin && pinCenterRef.current) {
        upsertPin(map, pinCenterRef.current);
      } else {
        removePin(map);
      }
    });
  }, [mapStyle, dropPin, isLoaded]);

  useEffect(() => {
    // If drop-pin is toggled off, remove it immediately.
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    if (!dropPin) {
      runAfterStyleReady(map, () => removePin(map));
      return;
    }

    if (pinCenterRef.current) {
      runAfterStyleReady(map, () => upsertPin(map, pinCenterRef.current!));
    }
  }, [dropPin, isLoaded]);

  const buildService = () => {
    if (providerMode === "auto") return geocodingService;

    const primary =
      providerMode === "mapbox"
        ? new MapboxGeocodingProvider()
        : providerMode === "nominatim"
          ? new NominatimGeocodingProvider()
          : new PhotonGeocodingProvider();

    return createGeocodingService({
      primaryProvider: primary,
      fallbackEnabled: false,
    });
  };

  const search = async (q: string) => {
    const trimmed = q.trim();
    setError("");
    setStatus("");

    if (!trimmed) {
      abortControllerRef.current?.abort();
      setResults([]);
      setIsOpen(false);
      return;
    }

    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const service = buildService();
      const response = await service.geocode(
        { query: trimmed, limit: 5 },
        abortController.signal,
      );

      setResults(
        response.results.map((r) => ({
          id: r.id,
          placeName: r.placeName,
          center: r.center,
          providerId: r.providerId,
        })),
      );
      setIsOpen(true);

      const attempted =
        response.attemptedProviders?.length > 0
          ? ` (tried: ${response.attemptedProviders.join(", ")})`
          : "";
      setStatus(`provider: ${response.providerId}${attempted}`);
    } catch (e) {
      if (isAbortError(e)) return;
      setResults([]);
      setIsOpen(false);
      setError("Search failed. Try switching provider (Nominatim/Photon) or check token/network.");
    }
  };

  const handleInput = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  };

  useEffect(() => {
    // When provider mode changes, refresh results if there's an active query.
    if (!query.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 0);
  }, [providerMode]);

  const handleSelect = (result: SearchResult) => {
    setQuery(result.placeName.split(",")[0] ?? "");
    setIsOpen(false);
    setResults([]);

    const map = mapRef.current;
    if (!map || !isLoaded) return;

    map.flyTo({ center: result.center as never, zoom: 14, duration: 1200 } as never);

    if (dropPin) {
      pinCenterRef.current = result.center;
      runAfterStyleReady(map, () => upsertPin(map, result.center));
    }
  };

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

      <div
        ref={panelRef}
        className="panel absolute left-4 top-16 z-10 w-[320px] max-w-[calc(100vw-2rem)] overflow-hidden"
      >
        <div className="border-b border-[var(--panel-border)] px-3 py-2">
          <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted">
            Geocoding Search
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-muted">
            Engine: {engine === "mapbox" ? "Mapbox" : "MapLibre"} · Provider:{" "}
            {providerMode === "auto" ? "Auto" : getProviderLabel(providerMode)}
          </div>
        </div>

        <div className="p-3">
          <input
            type="text"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onFocus={() => results.length > 0 && setIsOpen(true)}
            placeholder="Search location..."
            className="w-full rounded-md border border-[var(--panel-border)] bg-transparent px-2.5 py-2 font-mono text-xs text-fg outline-none"
          />

          {error ? (
            <div className="mt-2 font-mono text-[11px] text-warn">{error}</div>
          ) : status ? (
            <div className="mt-2 font-mono text-[11px] text-muted">{status}</div>
          ) : null}
        </div>

        {isOpen && results.length > 0 && (
          <ul className="max-h-[280px] overflow-auto border-t border-[var(--panel-border)]">
            {results.map((r) => (
              <li
                key={r.id}
                className="cursor-pointer px-3 py-2 hover:bg-[var(--panel-border)]"
                onClick={() => handleSelect(r)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 font-mono text-xs text-fg">
                    <div className="truncate">{r.placeName}</div>
                  </div>
                  <div className="shrink-0 rounded-sm border border-[var(--panel-border)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted">
                    {getProviderLabel(r.providerId)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
