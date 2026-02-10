import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Pattern, PatternViewProps, Theme } from "../../types";
import { mapboxBasemapProvider, openFreeMapBasemapProvider } from "../../providers";
import { once } from "../utils/map-compat";
import { loadMapboxGL, loadMapLibreGL } from "../utils/load-map-engine";

type Engine = "mapbox" | "maplibre";
type LngLat = [number, number];

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const SOURCE_ID = "property-filtering-demo";
const LAYER_ID = "property-filtering-points";

type DemoProps = {
  id: string;
  name: string;
  kind: "Cafe" | "Park" | "Museum";
  status: "Open" | "Closed";
};

type DemoFeature = GeoJSON.Feature<GeoJSON.Point, DemoProps>;

function demoData(): GeoJSON.FeatureCollection<GeoJSON.Point, DemoProps> {
  const base: Array<{
    id: string;
    name: string;
    kind: DemoProps["kind"];
    status: DemoProps["status"];
    coords: LngLat;
  }> = [
    { id: "1", name: "Grunerlokka Cafe", kind: "Cafe", status: "Open", coords: [10.7598, 59.9236] },
    { id: "2", name: "Torggata Cafe", kind: "Cafe", status: "Closed", coords: [10.7518, 59.9149] },
    { id: "3", name: "Aker Brygge Cafe", kind: "Cafe", status: "Open", coords: [10.7279, 59.9097] },
    { id: "4", name: "Frogner Park", kind: "Park", status: "Open", coords: [10.7016, 59.9270] },
    { id: "5", name: "St. Hanshaugen", kind: "Park", status: "Open", coords: [10.7432, 59.9276] },
    { id: "6", name: "Ekeberg Park", kind: "Park", status: "Closed", coords: [10.7864, 59.8999] },
    { id: "7", name: "Munch Museum", kind: "Museum", status: "Open", coords: [10.7551, 59.9056] },
    { id: "8", name: "National Museum", kind: "Museum", status: "Open", coords: [10.7296, 59.9134] },
    { id: "9", name: "Vigeland Museum", kind: "Museum", status: "Closed", coords: [10.7018, 59.9261] },
    { id: "10", name: "Tjuvholmen Park", kind: "Park", status: "Open", coords: [10.7206, 59.9078] },
    { id: "11", name: "Barcode Cafe", kind: "Cafe", status: "Open", coords: [10.7559, 59.9090] },
    { id: "12", name: "Sofienberg Park", kind: "Park", status: "Closed", coords: [10.7698, 59.9210] },
    { id: "13", name: "Vulkan Cafe", kind: "Cafe", status: "Open", coords: [10.7511, 59.9230] },
    { id: "14", name: "Bygdoy Museum", kind: "Museum", status: "Closed", coords: [10.6847, 59.9040] },
    { id: "15", name: "Bygdoy Park", kind: "Park", status: "Open", coords: [10.6855, 59.9049] },
  ];

  const features: DemoFeature[] = base.map((f) => ({
    type: "Feature",
    id: f.id,
    properties: {
      id: f.id,
      name: f.name,
      kind: f.kind,
      status: f.status,
    },
    geometry: { type: "Point", coordinates: f.coords },
  }));

  return { type: "FeatureCollection", features };
}

function styleFor(engine: Engine, theme: Theme): string {
  return engine === "maplibre"
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

function getAttributionText(map: MapboxMap | MapLibreMap): string {
  const container = map.getContainer();
  const el = container.querySelector(
    ".mapboxgl-ctrl-attrib, .maplibregl-ctrl-attrib",
  ) as HTMLElement | null;
  const text = el?.textContent ?? "";
  return text.replace(/\s+/g, " ").trim();
}

function toFilterExpr(selectedKinds: string[], selectedStatuses: string[]) {
  const clauses: unknown[] = [];
  if (selectedKinds.length > 0) {
    clauses.push(["in", ["get", "kind"], ["literal", selectedKinds]]);
  }
  if (selectedStatuses.length > 0) {
    clauses.push(["in", ["get", "status"], ["literal", selectedStatuses]]);
  }
  if (clauses.length === 0) return null;
  return ["all", ...clauses];
}

function uniqueSorted<T extends string>(
  features: DemoFeature[],
  pick: (p: DemoProps) => T,
): T[] {
  const set = new Set<T>();
  for (const f of features) set.add(pick(f.properties));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export const propertyFilteringPattern: Pattern = {
  id: "property-filtering",
  name: "Property-Based Filtering UI",
  category: "layers",
  description:
    "Filter visible features by property values with a small UI (setFilter), with clearable active filters. Dual-engine (Mapbox/MapLibre).",
  controls: [],
  disableGlobalSearch: true,
  setup() {},
  cleanup() {},
  update() {},
  view: PropertyFilteringView,
  snippet: `// Build a Mapbox/MapLibre layer filter from UI state
const clauses = [];
if (kinds.length) clauses.push(["in", ["get","kind"], ["literal", kinds]]);
if (statuses.length) clauses.push(["in", ["get","status"], ["literal", statuses]]);
map.setFilter(layerId, clauses.length ? ["all", ...clauses] : null);`,
};

function PropertyFilteringView({ theme, onPrimaryMapReady }: PatternViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | MapLibreMap | null>(null);
  const recreateTokenRef = useRef(0);

  const [engine, setEngine] = useState<Engine>("mapbox");
  const [loaded, setLoaded] = useState(false);
  const [attribution, setAttribution] = useState("");

  const data = useMemo(() => demoData(), []);
  const kinds = useMemo(() => uniqueSorted(data.features, (p) => p.kind), [data]);
  const statuses = useMemo(
    () => uniqueSorted(data.features, (p) => p.status),
    [data],
  );

  const [selectedKinds, setSelectedKinds] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  const style = useMemo(() => styleFor(engine, theme), [engine, theme]);
  const filterExpr = useMemo(
    () => toFilterExpr(selectedKinds, selectedStatuses),
    [selectedKinds, selectedStatuses],
  );

  const ensureDemo = (map: MapboxMap | MapLibreMap) => {
    const m = map as unknown as {
      getSource: (id: string) => unknown;
      addSource: (id: string, source: unknown) => void;
      getLayer: (id: string) => unknown;
      addLayer: (layer: unknown) => void;
      setFilter: (id: string, filter: unknown) => void;
      setPaintProperty: (id: string, prop: string, v: unknown) => void;
    };

    if (!m.getSource(SOURCE_ID)) {
      m.addSource(SOURCE_ID, { type: "geojson", data });
    } else {
      const src = m.getSource(SOURCE_ID) as unknown as { setData?: (d: unknown) => void };
      src.setData?.(data);
    }

    if (!m.getLayer(LAYER_ID)) {
      m.addLayer({
        id: LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-radius": 7,
          "circle-color": [
            "match",
            ["get", "kind"],
            "Cafe",
            "#f97316",
            "Park",
            "#22c55e",
            "Museum",
            "#38bdf8",
            "#a78bfa",
          ],
          "circle-stroke-color": "#052e16",
          "circle-stroke-width": 2,
          "circle-opacity": 0.92,
        },
      });
    }

    m.setFilter(LAYER_ID, filterExpr);
    m.setPaintProperty(LAYER_ID, "circle-opacity", filterExpr ? 0.98 : 0.92);
  };

  const recreateMap = () => {
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
    setAttribution("");

    void (async () => {
      if (engine === "mapbox") {
        const mapboxgl = await loadMapboxGL();
        if (recreateTokenRef.current !== token) return;

        mapboxgl.accessToken = MAPBOX_TOKEN;
        const map = new mapboxgl.Map({
          container: containerRef.current!,
          style,
          center: [10.7522, 59.9139],
          zoom: 12.5,
          bearing: 0,
          pitch: 0,
        });
        map.addControl(new mapboxgl.NavigationControl(), "top-right");
        mapRef.current = map;
        map.on("load", () => {
          if (recreateTokenRef.current !== token) return;
          setLoaded(true);
          onPrimaryMapReady?.(map);
          ensureDemo(map);
          if (camera) map.jumpTo(camera);
          setAttribution(getAttributionText(map));
        });
        return;
      }

      const maplibregl = await loadMapLibreGL();
      if (recreateTokenRef.current !== token) return;

      const map = new maplibregl.Map({
        container: containerRef.current!,
        style,
        center: [10.7522, 59.9139],
        zoom: 12.5,
        bearing: 0,
        pitch: 0,
      });
      map.addControl(new maplibregl.NavigationControl(), "top-right");
      mapRef.current = map;
      map.on("load", () => {
        if (recreateTokenRef.current !== token) return;
        setLoaded(true);
        onPrimaryMapReady?.(map as unknown as MapboxMap);
        ensureDemo(map);
        if (camera) map.jumpTo(camera as never);
        setAttribution(getAttributionText(map));
      });
    })().catch(() => {
      // ignore
    });
  };

  useEffect(() => {
    recreateMap();
    return () => {
      recreateTokenRef.current += 1;
      const map = mapRef.current;
      if (!map) return;
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
    once(map, "style.load", () => {
      map.jumpTo(camera as never);
      map.resize();
      ensureDemo(map);
      setAttribution(getAttributionText(map));
    });
  }, [style, loaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const m = map as unknown as { setFilter: (id: string, filter: unknown) => void };
    m.setFilter(LAYER_ID, filterExpr);
  }, [filterExpr, loaded]);

  const toggle = (arr: string[], value: string) => {
    return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
  };

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onClear: () => void }> = [];
    for (const k of selectedKinds) {
      chips.push({
        key: `kind:${k}`,
        label: `Kind: ${k}`,
        onClear: () => setSelectedKinds((prev) => prev.filter((v) => v !== k)),
      });
    }
    for (const s of selectedStatuses) {
      chips.push({
        key: `status:${s}`,
        label: `Status: ${s}`,
        onClear: () =>
          setSelectedStatuses((prev) => prev.filter((v) => v !== s)),
      });
    }
    return chips;
  }, [selectedKinds, selectedStatuses]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="panel status-panel absolute left-4 top-16 z-10 w-[340px] p-3">
        <div className="status-panel__message">
          Filter the demo features by two properties. UI builds a layer filter and
          applies it via <span className="font-mono">setFilter</span>.
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
            className="status-panel__button"
            onClick={() => {
              setSelectedKinds([]);
              setSelectedStatuses([]);
            }}
            disabled={selectedKinds.length === 0 && selectedStatuses.length === 0}
          >
            Clear all
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-widest text-muted">
              Kind
            </div>
            <div className="space-y-1">
              {kinds.map((k) => (
                <label key={k} className="flex items-center gap-2 font-mono text-xs">
                  <input
                    type="checkbox"
                    checked={selectedKinds.includes(k)}
                    onChange={() => setSelectedKinds((prev) => toggle(prev, k))}
                  />
                  <span>{k}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-widest text-muted">
              Status
            </div>
            <div className="space-y-1">
              {statuses.map((s) => (
                <label key={s} className="flex items-center gap-2 font-mono text-xs">
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes(s)}
                    onChange={() =>
                      setSelectedStatuses((prev) => toggle(prev, s))
                    }
                  />
                  <span>{s}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-widest text-muted">
            Active filters
          </div>
          {activeChips.length === 0 ? (
            <div className="font-mono text-xs text-muted">None</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {activeChips.map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex items-center gap-2 rounded-sm border border-border/50 bg-bg/60 px-2 py-1 font-mono text-[11px]"
                >
                  {chip.label}
                  <button
                    type="button"
                    className="secondary !px-2 !py-0.5"
                    onClick={chip.onClear}
                    aria-label={`Clear ${chip.label}`}
                    title="Clear"
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          )}
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
