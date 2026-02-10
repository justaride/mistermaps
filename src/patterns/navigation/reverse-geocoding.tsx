import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import maplibregl from "maplibre-gl";
import type { Pattern, PatternViewProps, Theme } from "../../types";
import {
  MapboxGeocodingProvider,
  NominatimGeocodingProvider,
  createReverseGeocodingService,
  openFreeMapBasemapProvider,
  mapboxBasemapProvider,
} from "../../providers";
import type { ReverseGeocodingService } from "../../providers";
import { copyText } from "../utils/export";

type Engine = "mapbox" | "maplibre";
type ProviderMode = "mapbox" | "nominatim";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const PIN_SOURCE_ID = "reverse-geocode-pin-src";
const PIN_LAYER_ID = "reverse-geocode-pin-layer";

function styleFor(engine: Engine, theme: Theme): string {
  return engine === "maplibre"
    ? openFreeMapBasemapProvider.getStyle(theme)
    : mapboxBasemapProvider.getStyle(theme);
}

function getCamera(map: mapboxgl.Map | maplibregl.Map) {
  const c = map.getCenter();
  return {
    center: [c.lng, c.lat] as [number, number],
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  };
}

function buildService(primary: ProviderMode): ReverseGeocodingService {
  const primaryProvider =
    primary === "nominatim"
      ? new NominatimGeocodingProvider()
      : new MapboxGeocodingProvider();
  const fallbackProvider =
    primary === "nominatim"
      ? new MapboxGeocodingProvider()
      : new NominatimGeocodingProvider();

  return createReverseGeocodingService({
    primaryProvider,
    fallbackProviders: [fallbackProvider],
    fallbackEnabled: true,
  });
}

function getAttributionText(map: mapboxgl.Map | maplibregl.Map): string {
  const container = map.getContainer();
  const el = container.querySelector(
    ".mapboxgl-ctrl-attrib, .maplibregl-ctrl-attrib",
  ) as HTMLElement | null;
  const text = el?.textContent ?? "";
  return text.replace(/\s+/g, " ").trim();
}

function ensurePin(map: mapboxgl.Map | maplibregl.Map) {
  const m = map as unknown as {
    getSource: (id: string) => unknown;
    addSource: (id: string, source: unknown) => void;
    getLayer: (id: string) => unknown;
    addLayer: (layer: unknown) => void;
  };

  if (!m.getSource(PIN_SOURCE_ID)) {
    m.addSource(PIN_SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }

  if (!m.getLayer(PIN_LAYER_ID)) {
    m.addLayer({
      id: PIN_LAYER_ID,
      type: "circle",
      source: PIN_SOURCE_ID,
      paint: {
        "circle-radius": 7,
        "circle-color": "#f97316",
        "circle-stroke-color": "#052e16",
        "circle-stroke-width": 2,
        "circle-opacity": 0.95,
      },
    });
  }
}

function setPin(map: mapboxgl.Map | maplibregl.Map, center: [number, number]) {
  const src = map.getSource(PIN_SOURCE_ID) as unknown as {
    setData?: (d: unknown) => void;
  };
  src.setData?.({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: center },
      },
    ],
  });
}

export const reverseGeocodingPattern: Pattern = {
  id: "reverse-geocoding",
  name: "Reverse Geocoding On Click",
  category: "navigation",
  description:
    "Click map to resolve nearest address/place with fallback (Mapbox/Nominatim) and copy-to-clipboard. Dual-engine Mapbox/MapLibre.",
  controls: [],
  disableGlobalSearch: true,
  setup() {},
  cleanup() {},
  update() {},
  view: ReverseGeocodingView,
  snippet: `// Reverse geocode on click with fallback
map.on('click', async (e) => {
  const service = createReverseGeocodingService({
    primaryProvider: new MapboxGeocodingProvider(),
    fallbackProviders: [new NominatimGeocodingProvider()],
    fallbackEnabled: true,
  });

  const { results, attemptedProviders, providerId } =
    await service.reverseGeocode({ center: [e.lngLat.lng, e.lngLat.lat], limit: 1 });
  console.log({ providerId, attemptedProviders, place: results[0]?.placeName });
});`,
};

function ReverseGeocodingView({ theme, onPrimaryMapReady }: PatternViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | maplibregl.Map | null>(null);
  const clickHandlerRef = useRef<((e: unknown) => void) | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [engine, setEngine] = useState<Engine>("mapbox");
  const [provider, setProvider] = useState<ProviderMode>("mapbox");
  const [loaded, setLoaded] = useState(false);
  const [attribution, setAttribution] = useState("");

  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [placeName, setPlaceName] = useState<string>("");
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [providerUsed, setProviderUsed] = useState<string>("");
  const [attemptedProviders, setAttemptedProviders] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const style = useMemo(() => styleFor(engine, theme), [engine, theme]);
  const service = useMemo(() => buildService(provider), [provider]);

  const teardownClick = (map: mapboxgl.Map | maplibregl.Map) => {
    const h = clickHandlerRef.current;
    if (!h) return;
    try {
      // maplibre/mapbox share on/off signatures.
      (map as unknown as { off: (t: string, fn: (e: unknown) => void) => void }).off(
        "click",
        h,
      );
    } catch {
      // ignore
    }
    clickHandlerRef.current = null;
  };

  const ensureClick = (map: mapboxgl.Map | maplibregl.Map) => {
    teardownClick(map);
    clickHandlerRef.current = (e: unknown) => {
      const ev = e as { lngLat?: { lng: number; lat: number } };
      const ll = ev.lngLat;
      if (!ll) return;
      void reverseAt([ll.lng, ll.lat]);
    };

    (map as unknown as { on: (t: string, fn: (e: unknown) => void) => void }).on(
      "click",
      clickHandlerRef.current,
    );
  };

  const reverseAt = async (center: [number, number]) => {
    const map = mapRef.current;
    if (!map) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setError("");
    setStatus("Reverse geocoding...");
    setCoords(center);
    setPin(map, center);

    try {
      const res = await service.reverseGeocode(
        { center, limit: 1 },
        abortRef.current.signal,
      );

      setProviderUsed(res.providerId);
      setAttemptedProviders(res.attemptedProviders);
      setPlaceName(res.results[0]?.placeName ?? "");
      setStatus(res.results.length > 0 ? "OK" : "No results");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setStatus("");
      setPlaceName("");
      setProviderUsed("");
      setAttemptedProviders([]);
      setError(err instanceof Error ? err.message : "Reverse geocoding failed");
    }
  };

  const recreateMap = () => {
    if (!containerRef.current) return;
    const prev = mapRef.current;
    const camera = prev ? getCamera(prev) : null;
    if (prev) {
      teardownClick(prev);
      try {
        prev.remove();
      } catch {
        // ignore
      }
      mapRef.current = null;
    }

    setLoaded(false);
    setAttribution("");

    if (engine === "mapbox") {
      mapboxgl.accessToken = MAPBOX_TOKEN;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style,
        center: [10.7522, 59.9139],
        zoom: 12.5,
        bearing: 0,
        pitch: 0,
      });
      map.addControl(new mapboxgl.NavigationControl(), "top-right");
      mapRef.current = map;
      map.on("load", () => {
        setLoaded(true);
        onPrimaryMapReady?.(map);
        ensurePin(map);
        ensureClick(map);
        if (camera) map.jumpTo(camera);
        setAttribution(getAttributionText(map));
      });
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [10.7522, 59.9139],
      zoom: 12.5,
      bearing: 0,
      pitch: 0,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;
    map.on("load", () => {
      setLoaded(true);
      onPrimaryMapReady?.(map as unknown as mapboxgl.Map);
      ensurePin(map);
      ensureClick(map);
      if (camera) map.jumpTo(camera as never);
      setAttribution(getAttributionText(map));
    });
  };

  useEffect(() => {
    recreateMap();
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;

      const map = mapRef.current;
      if (!map) return;
      teardownClick(map);
      try {
        map.remove();
      } catch {
        // ignore
      }
      mapRef.current = null;
    };
    // Recreate map on engine only (different library instance).
  }, [engine]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const camera = getCamera(map);
    map.setStyle(style);
    map.once("style.load", () => {
      map.jumpTo(camera as never);
      map.resize();
      ensurePin(map);
      ensureClick(map);
      setAttribution(getAttributionText(map));
      if (coords) setPin(map, coords);
    });
  }, [style, loaded]);

  useEffect(() => {
    setError("");
    setStatus("");
    setPlaceName("");
    setProviderUsed("");
    setAttemptedProviders([]);
  }, [provider]);

  const coordsLabel = coords
    ? `${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}`
    : "";

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="panel status-panel absolute left-4 top-16 z-10 w-[380px] p-3">
        <div className="status-panel__message">
          Click the map to reverse geocode (primary + fallback). Copy the result.
        </div>

        <div className="status-panel__actions">
          <button
            type="button"
            className={`status-panel__button ${engine === "mapbox" ? "primary" : ""}`}
            onClick={() => setEngine("mapbox")}
          >
            Mapbox
          </button>
          <button
            type="button"
            className={`status-panel__button ${engine === "maplibre" ? "primary" : ""}`}
            onClick={() => setEngine("maplibre")}
          >
            MapLibre
          </button>
          <button
            type="button"
            className={`status-panel__button ${provider === "mapbox" ? "primary" : ""}`}
            onClick={() => setProvider("mapbox")}
          >
            Primary: Mapbox
          </button>
          <button
            type="button"
            className={`status-panel__button ${provider === "nominatim" ? "primary" : ""}`}
            onClick={() => setProvider("nominatim")}
          >
            Primary: Nominatim
          </button>
        </div>

        <div className="mt-3 rounded-sm border border-border/40 bg-bg/50 p-2 font-mono text-xs">
          <div className="text-muted">Coordinates</div>
          <div className="text-fg">{coordsLabel || "Click to set"}</div>
        </div>

        <div className="mt-3 rounded-sm border border-border/40 bg-bg/50 p-2 font-mono text-xs">
          <div className="text-muted">Result</div>
          <div className="mt-1 text-fg">{placeName || "No result yet"}</div>
          {(providerUsed || attemptedProviders.length > 0) && (
            <div className="mt-2 text-[11px] text-muted">
              Used: {providerUsed || "?"}{" "}
              {attemptedProviders.length > 0
                ? `· Attempted: ${attemptedProviders.join(" -> ")}`
                : ""}
            </div>
          )}
          {status && <div className="mt-2 text-[11px] text-muted">{status}</div>}
          {error && (
            <div className="mt-2 text-[11px] text-warn">
              {error}
              {!MAPBOX_TOKEN && provider === "mapbox"
                ? " (Mapbox token missing; fallback should still work.)"
                : ""}
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="status-panel__button"
            disabled={!placeName || !coords}
            onClick={async () => {
              if (!placeName || !coords) return;
              const ok = await copyText(`${placeName}\n${coordsLabel}`);
              if (!ok) return;
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1100);
            }}
          >
            {copied ? "Copied" : "Copy address + coords"}
          </button>
          <button
            type="button"
            className="status-panel__button"
            disabled={!coords}
            onClick={() => {
              if (!coords) return;
              void reverseAt(coords);
            }}
          >
            Re-run
          </button>
        </div>

        {attribution && (
          <div className="mt-3 font-mono text-[10px] text-muted">
            Attribution: {attribution}
          </div>
        )}
      </div>
    </div>
  );
}

