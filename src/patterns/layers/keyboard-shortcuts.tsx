import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Pattern, PatternViewProps, Theme } from "../../types";
import { mapboxBasemapProvider, openFreeMapBasemapProvider } from "../../providers";
import { once } from "../utils/map-compat";
import { loadMapboxGL, loadMapLibreGL } from "../utils/load-map-engine";

type Engine = "mapbox" | "maplibre";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const CENTER: [number, number] = [11.0, 61.83];

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

type Preset = {
  label: string;
  center: [number, number];
  zoom: number;
};

const PRESETS: Record<string, Preset> = {
  "1": { label: "Oslo", center: [10.75, 59.91], zoom: 12 },
  "2": { label: "Bergen", center: [5.33, 60.39], zoom: 12 },
  "3": { label: "Tromsø", center: [18.96, 69.65], zoom: 12 },
};

function KeyboardShortcutsView({ theme, onPrimaryMapReady }: PatternViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | MapLibreMap | null>(null);
  const recreateTokenRef = useRef(0);

  const [engine, setEngine] = useState<Engine>("mapbox");
  const [loaded, setLoaded] = useState(false);
  const [showHelp, setShowHelp] = useState(true);
  const [lastAction, setLastAction] = useState("");

  const style = useMemo(() => styleFor(engine, theme), [engine, theme]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const map = mapRef.current;
      if (!map) return;

      const key = e.key.toLowerCase();

      if (key === "?") {
        setShowHelp((prev) => !prev);
        setLastAction("Toggled help panel");
        return;
      }

      if (key === "r") {
        (map as any).flyTo({ center: CENTER, zoom: 10, duration: 1500 });
        setLastAction("Reset to default view");
        return;
      }

      const preset = PRESETS[key];
      if (preset) {
        (map as any).flyTo({ center: preset.center, zoom: preset.zoom, duration: 1500 });
        setLastAction(`Flew to ${preset.label}`);
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
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
      if (engine === "mapbox") {
        const mapboxgl = await loadMapboxGL();
        if (recreateTokenRef.current !== token) return;
        mapboxgl.accessToken = MAPBOX_TOKEN;
        const map = new mapboxgl.Map({
          container: containerRef.current!,
          style,
          center: camera?.center ?? CENTER,
          zoom: camera?.zoom ?? 10,
        });
        map.addControl(new mapboxgl.NavigationControl(), "top-right");
        mapRef.current = map;
        map.on("load", () => {
          if (recreateTokenRef.current !== token) return;
          setLoaded(true);
          onPrimaryMapReady?.(map);
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
        zoom: camera?.zoom ?? 10,
      });
      map.addControl(new maplibregl.NavigationControl(), "top-right");
      mapRef.current = map;
      map.on("load", () => {
        if (recreateTokenRef.current !== token) return;
        setLoaded(true);
        onPrimaryMapReady?.(map as unknown as MapboxMap);
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
    once(map, "style.load", () => {
      map.jumpTo(camera as never);
      map.resize();
    });
  }, [style, loaded]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="panel status-panel absolute left-4 top-16 z-10 w-[360px] p-3">
        <div className="status-panel__message">
          Press number keys for camera presets. Press ? to toggle this help panel.
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
        </div>

        {showHelp && (
          <div className="mt-3 space-y-1 font-mono text-xs text-fg">
            <div><kbd className="inline-block min-w-[20px] rounded border border-border/60 bg-bg/80 px-1.5 py-0.5 text-center font-mono text-[11px]">1</kbd> Oslo</div>
            <div><kbd className="inline-block min-w-[20px] rounded border border-border/60 bg-bg/80 px-1.5 py-0.5 text-center font-mono text-[11px]">2</kbd> Bergen</div>
            <div><kbd className="inline-block min-w-[20px] rounded border border-border/60 bg-bg/80 px-1.5 py-0.5 text-center font-mono text-[11px]">3</kbd> Tromsø</div>
            <div><kbd className="inline-block min-w-[20px] rounded border border-border/60 bg-bg/80 px-1.5 py-0.5 text-center font-mono text-[11px]">R</kbd> Reset</div>
            <div><kbd className="inline-block min-w-[20px] rounded border border-border/60 bg-bg/80 px-1.5 py-0.5 text-center font-mono text-[11px]">?</kbd> Toggle help</div>
          </div>
        )}

        {lastAction && (
          <div className="mt-3 rounded-sm border border-border/40 bg-bg/50 p-2 font-mono text-xs text-fg">
            {lastAction}
          </div>
        )}
      </div>
    </div>
  );
}

export const keyboardShortcutsPattern: Pattern = {
  id: "keyboard-shortcuts",
  name: "Keyboard Shortcuts + Presets",
  category: "layers",
  description:
    "Keyboard shortcuts for camera presets and UI toggles.",
  controls: [],
  disableGlobalSearch: true,
  setup() {},
  cleanup() {},
  update() {},
  view: KeyboardShortcutsView,
  snippet: `map.flyTo({ center: [10.75, 59.91], zoom: 12, duration: 1500 });

document.addEventListener("keydown", (e) => {
  if (e.key === "1") map.flyTo({ center: oslo, zoom: 12 });
  if (e.key === "2") map.flyTo({ center: bergen, zoom: 12 });
  if (e.key === "r") map.flyTo({ center: defaultCenter, zoom: 10 });
});`,
};
