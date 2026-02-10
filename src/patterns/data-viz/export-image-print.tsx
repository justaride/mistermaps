import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { Map as MapLibreMap, MapOptions as MapLibreMapOptions } from "maplibre-gl";
import type { Pattern, PatternViewProps, Theme } from "../../types";
import { mapboxBasemapProvider, openFreeMapBasemapProvider } from "../../providers";
import { formatTimestampForFilename } from "../utils/export";
import { once } from "../utils/map-compat";
import { loadMapboxGL, loadMapLibreGL } from "../utils/load-map-engine";

type Engine = "mapbox" | "maplibre";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const DEMO_SOURCE_ID = "export-demo-src";
const DEMO_FILL_ID = "export-demo-fill";
const DEMO_LINE_ID = "export-demo-line";
const DEMO_POINTS_ID = "export-demo-points";

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

function ensureDemo(map: MapboxMap | MapLibreMap) {
  const m = map as unknown as {
    getSource: (id: string) => unknown;
    addSource: (id: string, source: unknown) => void;
    getLayer: (id: string) => unknown;
    addLayer: (layer: unknown) => void;
  };

  if (!m.getSource(DEMO_SOURCE_ID)) {
    m.addSource(DEMO_SOURCE_ID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { name: "Oslo (demo extent)" },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [10.665, 59.955],
                  [10.845, 59.955],
                  [10.845, 59.875],
                  [10.665, 59.875],
                  [10.665, 59.955],
                ],
              ],
            },
          },
          {
            type: "Feature",
            properties: { name: "Aker Brygge" },
            geometry: { type: "Point", coordinates: [10.7279, 59.9097] },
          },
          {
            type: "Feature",
            properties: { name: "MUNCH" },
            geometry: { type: "Point", coordinates: [10.7551, 59.9056] },
          },
          {
            type: "Feature",
            properties: { name: "Frogner Park" },
            geometry: { type: "Point", coordinates: [10.7016, 59.927] },
          },
        ],
      },
    });
  }

  if (!m.getLayer(DEMO_FILL_ID)) {
    m.addLayer({
      id: DEMO_FILL_ID,
      type: "fill",
      source: DEMO_SOURCE_ID,
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: {
        "fill-color": "#60a5fa",
        "fill-opacity": 0.12,
      },
    });
  }

  if (!m.getLayer(DEMO_LINE_ID)) {
    m.addLayer({
      id: DEMO_LINE_ID,
      type: "line",
      source: DEMO_SOURCE_ID,
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: {
        "line-color": "#1d4ed8",
        "line-width": 2,
        "line-opacity": 0.65,
      },
    });
  }

  if (!m.getLayer(DEMO_POINTS_ID)) {
    m.addLayer({
      id: DEMO_POINTS_ID,
      type: "circle",
      source: DEMO_SOURCE_ID,
      filter: ["==", ["geometry-type"], "Point"],
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

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const w of words) {
    const next = current ? `${current} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = w;
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [text];
}

function exportPngWithAttribution(map: MapboxMap | MapLibreMap): {
  pngDataUrl: string;
  attribution: string;
  meta: { center: [number, number]; zoom: number };
} {
  const canvas = map.getCanvas();
  const attribution = getAttributionText(map);

  const cssW = canvas.clientWidth || 1;
  const scale = canvas.width / cssW; // devicePixelRatio-like

  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context not available");
  }

  ctx.drawImage(canvas, 0, 0);

  const pad = Math.round(12 * scale);
  const fontSize = Math.max(10, Math.round(12 * scale));
  ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
  ctx.textBaseline = "top";

  const meta = {
    center: [map.getCenter().lng, map.getCenter().lat] as [number, number],
    zoom: map.getZoom(),
  };

  const stamp = `Center: ${meta.center[0].toFixed(5)}, ${meta.center[1].toFixed(5)} · Zoom: ${meta.zoom.toFixed(2)} · ${new Date().toLocaleString()}`;
  const attributionLine = attribution ? `Attribution: ${attribution}` : "Attribution: (none detected)";
  const maxWidth = out.width - pad * 2;
  const lines = [
    ...wrapLines(ctx, attributionLine, maxWidth),
    ...wrapLines(ctx, stamp, maxWidth),
  ];

  const lineH = Math.round(fontSize * 1.35);
  const boxH = pad * 2 + lines.length * lineH;
  ctx.fillStyle = "rgba(0,0,0,0.62)";
  ctx.fillRect(0, out.height - boxH, out.width, boxH);

  ctx.fillStyle = "rgba(255,255,255,0.95)";
  let y = out.height - boxH + pad;
  for (const line of lines) {
    ctx.fillText(line, pad, y);
    y += lineH;
  }

  const pngDataUrl = out.toDataURL("image/png");
  return { pngDataUrl, attribution, meta };
}

function downloadDataUrl(filename: string, dataUrl: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function openPrintView(options: {
  title: string;
  pngDataUrl: string;
  attribution: string;
}) {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) {
    throw new Error("Popup blocked");
  }

  const safeTitle = options.title.replace(/[<>]/g, "");
  const attribution = options.attribution.replace(/[<>]/g, "");

  w.document.open();
  w.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      :root { color-scheme: light; }
      body { font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif; margin: 0; background: #fff; color: #111; }
      .wrap { max-width: 960px; margin: 0 auto; padding: 24px; }
      h1 { margin: 0 0 8px; font-size: 22px; }
      .meta { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 11px; color: #444; }
      .img { margin-top: 16px; border: 1px solid #ddd; }
      img { width: 100%; height: auto; display: block; }
      .actions { margin-top: 16px; display: flex; gap: 8px; }
      button { padding: 10px 14px; border: 1px solid #222; background: #fff; cursor: pointer; font-family: ui-monospace, monospace; font-size: 12px; }
      @media print {
        .actions { display: none; }
        .wrap { padding: 0; max-width: none; }
        .img { border: none; }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>${safeTitle}</h1>
      <div class="meta">Attribution: ${attribution || "(none)"}</div>
      <div class="actions">
        <button onclick="window.print()">Print</button>
        <button onclick="window.close()">Close</button>
      </div>
      <div class="img">
        <img src="${options.pngDataUrl}" alt="Map export" />
      </div>
    </div>
  </body>
</html>`);
  w.document.close();
}

export const exportImagePrintPattern: Pattern = {
  id: "export-image-print",
  name: "Screenshot / Export Image + Print View",
  category: "data-viz",
  description:
    "Export the current map view as a PNG (with attribution) and open a simplified print layout. Dual-engine Mapbox/MapLibre.",
  controls: [],
  disableGlobalSearch: true,
  setup() {},
  cleanup() {},
  update() {},
  view: ExportImagePrintView,
  snippet: `// Export map canvas with attribution overlay
// Note: requires preserveDrawingBuffer: true
const base = map.getCanvas();
const out = document.createElement('canvas');
out.width = base.width; out.height = base.height;
out.getContext('2d').drawImage(base, 0, 0);
// draw attribution text box ...
download(out.toDataURL('image/png'));`,
};

function ExportImagePrintView({ theme, onPrimaryMapReady }: PatternViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | MapLibreMap | null>(null);
  const recreateTokenRef = useRef(0);

  const [engine, setEngine] = useState<Engine>("mapbox");
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  const lastExportRef = useRef<{
    pngDataUrl: string;
    attribution: string;
  } | null>(null);

  const style = useMemo(() => styleFor(engine, theme), [engine, theme]);

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
    setStatus("");
    setError("");

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
          preserveDrawingBuffer: true,
        });
        map.addControl(new mapboxgl.NavigationControl(), "top-right");
        mapRef.current = map;
        map.on("load", () => {
          if (recreateTokenRef.current !== token) return;
          setLoaded(true);
          onPrimaryMapReady?.(map);
          ensureDemo(map);
          if (camera) map.jumpTo(camera);
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
        preserveDrawingBuffer: true,
      } as unknown as MapLibreMapOptions);
      map.addControl(new maplibregl.NavigationControl(), "top-right");
      mapRef.current = map;
      map.on("load", () => {
        if (recreateTokenRef.current !== token) return;
        setLoaded(true);
        onPrimaryMapReady?.(map as unknown as MapboxMap);
        ensureDemo(map);
        if (camera) map.jumpTo(camera as never);
      });
    })().catch(() => {
      // ignore
    });
  };

  useEffect(() => {
    recreateMap();
    return () => {
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
    });
  }, [style, loaded]);

  const runExport = () => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    setError("");
    setStatus("Exporting...");

    try {
      const { pngDataUrl, attribution } = exportPngWithAttribution(map);
      lastExportRef.current = { pngDataUrl, attribution };
      const filename = `mister-maps-${engine}-${formatTimestampForFilename()}.png`;
      downloadDataUrl(filename, pngDataUrl);
      setStatus("PNG downloaded");
      window.setTimeout(() => setStatus(""), 1400);
    } catch (err) {
      setStatus("");
      const message =
        err instanceof Error ? err.message : "Export failed (unknown error)";
      // Common failure mode: tainted canvas due to tiles without CORS.
      setError(message);
    }
  };

  const runPrintView = () => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    setError("");
    setStatus("Preparing print view...");

    try {
      const { pngDataUrl, attribution } = exportPngWithAttribution(map);
      lastExportRef.current = { pngDataUrl, attribution };
      openPrintView({
        title: "Mister Maps Print View",
        pngDataUrl,
        attribution,
      });
      setStatus("");
    } catch (err) {
      setStatus("");
      setError(err instanceof Error ? err.message : "Print view failed");
    }
  };

  const lastAttribution = lastExportRef.current?.attribution ?? "";

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="panel status-panel absolute left-4 top-16 z-10 w-[420px] p-3">
        <div className="status-panel__message">
          Export a PNG with attribution baked into the image, or open a simplified
          print layout.
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
            onClick={runExport}
            disabled={!loaded}
          >
            Export PNG
          </button>
          <button
            type="button"
            className="status-panel__button"
            onClick={runPrintView}
            disabled={!loaded}
          >
            Print view
          </button>
        </div>

        {status && (
          <div className="mt-3 font-mono text-xs text-muted">{status}</div>
        )}
        {error && (
          <div className="mt-3 font-mono text-xs text-warn">
            {error}
            {error.toLowerCase().includes("security") ||
            error.toLowerCase().includes("taint")
              ? " (Canvas likely tainted by tiles without CORS.)"
              : ""}
          </div>
        )}

        <div className="mt-3 rounded-sm border border-border/40 bg-bg/50 p-2 font-mono text-[11px] text-muted">
          PNG export uses <span className="font-mono">preserveDrawingBuffer</span>{" "}
          and draws attribution text onto the exported image.
        </div>

        {lastAttribution && (
          <div className="mt-3 font-mono text-[10px] text-muted">
            Last export attribution: {lastAttribution}
          </div>
        )}
      </div>
    </div>
  );
}
