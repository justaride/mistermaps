import mapboxgl, {
  type GeoJSONSource,
  type Map,
  type MapLayerMouseEvent,
  type MapMouseEvent,
} from "mapbox-gl";
import type { Pattern } from "../../types";
import type { LngLat } from "../../providers/types";
import {
  buildOverpassQuery,
  fetchOverpass,
  overpassElementsToFeatureCollection,
  type OverpassCategoryFilter,
} from "../../providers/osm/overpass";

const SOURCE_ID = "overpass-poi-source";
const CIRCLE_LAYER_ID = "overpass-poi-circles";
const LABEL_LAYER_ID = "overpass-poi-labels";

const DEFAULT_CENTER: LngLat = [10.7522, 59.9139]; // Oslo Sentrum

const DEFAULT_ENDPOINT = "https://overpass.kumi.systems/api/interpreter";

type CategoryOption = {
  label: string;
  value: string; // "key=value"
};

const CATEGORY_OPTIONS: CategoryOption[] = [
  { label: "Cafe", value: "amenity=cafe" },
  { label: "Restaurant", value: "amenity=restaurant" },
  { label: "Bar/Pub", value: "amenity=bar" },
  { label: "Toilets", value: "amenity=toilets" },
  { label: "Drinking Water", value: "amenity=drinking_water" },
  { label: "Playground", value: "leisure=playground" },
  { label: "Park", value: "leisure=park" },
  { label: "Viewpoint", value: "tourism=viewpoint" },
];

let currentControls: Record<string, unknown> = {};
let currentCenter: LngLat | null = null;
let lastFetchKey = "";

let clickHandler: ((e: MapMouseEvent) => void) | null = null;
let moveEndHandler: (() => void) | null = null;
let poiClickHandler: ((e: MapLayerMouseEvent) => void) | null = null;
let mouseEnterHandler: (() => void) | null = null;
let mouseLeaveHandler: (() => void) | null = null;

let pendingTimer: number | null = null;
let abortController: AbortController | null = null;
let popup: mapboxgl.Popup | null = null;

let statusPanel: HTMLDivElement | null = null;
let statusMessage: HTMLDivElement | null = null;

function roundCoord(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}

function parseCategory(raw: unknown): OverpassCategoryFilter {
  const str = typeof raw === "string" ? raw : "amenity=cafe";
  const [key, value] = str.split("=");
  if (!key || !value) return { key: "amenity", value: "cafe" };
  return { key, value };
}

function parseNumber(raw: unknown, fallback: number): number {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : fallback;
}

function getFetchKey(
  center: LngLat,
  filter: OverpassCategoryFilter,
  radiusMeters: number,
  maxResults: number,
): string {
  return JSON.stringify({
    c: [roundCoord(center[0]), roundCoord(center[1])],
    f: `${filter.key}=${filter.value}`,
    r: Math.round(radiusMeters),
    m: Math.round(maxResults),
  });
}

function ensureStatusPanel() {
  if (statusPanel) return;

  statusPanel = document.createElement("div");
  statusPanel.className = "panel status-panel";
  statusPanel.style.cssText = `
    position: absolute;
    bottom: 24px;
    right: 16px;
    z-index: 10;
    padding: 12px 16px;
    font-size: 13px;
    max-width: 340px;
  `;

  statusMessage = document.createElement("div");
  statusMessage.className = "status-panel__message";
  statusPanel.append(statusMessage);
  document.body.appendChild(statusPanel);
}

function setStatus(message: string) {
  ensureStatusPanel();
  if (!statusPanel || !statusMessage) return;
  statusMessage.textContent = message;
  statusPanel.style.display = message ? "block" : "none";
}

function getEndpoint(): string {
  const raw = import.meta.env.VITE_OVERPASS_ENDPOINT;
  return typeof raw === "string" && raw.trim() ? raw.trim() : DEFAULT_ENDPOINT;
}

function getSource(map: Map): GeoJSONSource | null {
  const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
  return source ?? null;
}

function setGeoJson(map: Map, data: GeoJSON.FeatureCollection) {
  const source = getSource(map);
  if (!source) return;
  source.setData(data);
}

function cancelPendingWork() {
  if (pendingTimer !== null) {
    window.clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
}

function scheduleFetch(map: Map, delayMs: number) {
  if (pendingTimer !== null) {
    window.clearTimeout(pendingTimer);
    pendingTimer = null;
  }

  pendingTimer = window.setTimeout(() => {
    pendingTimer = null;
    void doFetch(map);
  }, Math.max(0, delayMs));
}

async function doFetch(map: Map) {
  const center = currentCenter ?? (map.getCenter().toArray() as LngLat);
  const filter = parseCategory(currentControls.category);
  const radiusMeters = parseNumber(currentControls.radiusMeters, 800);
  const maxResults = parseNumber(currentControls.maxResults, 100);

  const fetchKey = getFetchKey(center, filter, radiusMeters, maxResults);
  if (fetchKey === lastFetchKey && getSource(map)) return;
  lastFetchKey = fetchKey;

  cancelPendingWork();

  const endpoint = getEndpoint();
  const query = buildOverpassQuery({
    filter,
    center,
    radiusMeters,
    maxResults,
    timeoutSeconds: 25,
  });

  abortController = new AbortController();
  const signal = abortController.signal;

  const timeoutMs = 20_000;
  const timeoutId = window.setTimeout(() => {
    abortController?.abort();
  }, timeoutMs);

  setStatus(
    `Fetching ${filter.value} within ${Math.round(radiusMeters)}m… (click map to search elsewhere)`,
  );

  try {
    const res = await fetchOverpass({ endpoint, query, signal });
    const fc = overpassElementsToFeatureCollection(res.elements, {
      filter,
      maxTags: 25,
    });

    setGeoJson(map, fc);

    const cLng = roundCoord(center[0]);
    const cLat = roundCoord(center[1]);
    setStatus(
      `Found ${fc.features.length} ${filter.value} within ${Math.round(radiusMeters)}m @ ${cLat}, ${cLng}. Click map to search elsewhere.`,
    );
  } catch (error) {
    // Keep previous data on errors; only update status.
    if ((error as Error)?.name === "AbortError") {
      setStatus("Cancelled.");
      return;
    }
    console.error("Overpass request failed:", error);
    setStatus(
      "Overpass request failed (rate limit / timeout). Try a smaller radius or click again.",
    );
  } finally {
    window.clearTimeout(timeoutId);
    abortController = null;
  }
}

function setLabelVisibility(map: Map, show: boolean) {
  if (!map.getLayer(LABEL_LAYER_ID)) return;
  map.setLayoutProperty(
    LABEL_LAYER_ID,
    "visibility",
    show ? "visible" : "none",
  );
}

function syncMoveRefresh(map: Map, enabled: boolean) {
  if (enabled) {
    if (moveEndHandler) return;
    moveEndHandler = () => {
      currentCenter = map.getCenter().toArray() as LngLat;
      scheduleFetch(map, 450);
    };
    map.on("moveend", moveEndHandler);
    return;
  }

  if (moveEndHandler) {
    map.off("moveend", moveEndHandler);
    moveEndHandler = null;
  }
}

function formatTitle(
  props: Record<string, unknown> | null | undefined,
): string {
  if (!props) return "OSM feature";
  const name = typeof props.name === "string" ? props.name.trim() : "";
  if (name) return name;
  const kind = typeof props.kind === "string" ? props.kind.trim() : "";
  if (kind) return kind;
  const t = typeof props.osm_type === "string" ? props.osm_type : "feature";
  const id = typeof props.osm_id === "number" ? String(props.osm_id) : "";
  return id ? `${t} ${id}` : "OSM feature";
}

function buildPopupDom(props: Record<string, unknown>) {
  const root = document.createElement("div");
  root.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace";
  root.style.fontSize = "12px";
  root.style.maxWidth = "320px";

  const title = document.createElement("div");
  title.textContent = formatTitle(props);
  title.style.fontWeight = "800";
  title.style.marginBottom = "8px";
  root.appendChild(title);

  const list = document.createElement("div");
  list.style.display = "grid";
  list.style.gridTemplateColumns = "auto 1fr";
  list.style.gap = "4px 10px";

  const entries = Object.entries(props)
    .filter(([k, v]) => k !== "name" && typeof v === "string" && v.trim())
    .slice(0, 14);

  for (const [k, v] of entries) {
    const keyEl = document.createElement("div");
    keyEl.textContent = k;
    keyEl.style.opacity = "0.7";
    const valEl = document.createElement("div");
    valEl.textContent = v as string;
    list.append(keyEl, valEl);
  }

  if (entries.length > 0) {
    root.appendChild(list);
  }

  return root;
}

export const overpassPoiOverlayPattern: Pattern = {
  id: "overpass-poi-overlay",
  name: "Overpass POI Overlay",
  category: "navigation",
  description:
    "Query OpenStreetMap features via Overpass API and render nearby POIs. Click map to set the search center.",
  controls: [
    {
      id: "category",
      label: "Category",
      type: "select",
      defaultValue: "amenity=cafe",
      options: CATEGORY_OPTIONS,
    },
    {
      id: "radiusMeters",
      label: "Radius (m)",
      type: "slider",
      defaultValue: 800,
      min: 100,
      max: 5000,
      step: 50,
    },
    {
      id: "maxResults",
      label: "Max Results",
      type: "slider",
      defaultValue: 100,
      min: 10,
      max: 250,
      step: 10,
    },
    {
      id: "showLabels",
      label: "Show Labels",
      type: "toggle",
      defaultValue: false,
    },
    {
      id: "autoRefreshOnMove",
      label: "Auto Refresh on Move",
      type: "toggle",
      defaultValue: false,
    },
  ],

  setup(map: Map, controls: Record<string, unknown>) {
    currentControls = controls;
    currentCenter = DEFAULT_CENTER;
    lastFetchKey = "";

    ensureStatusPanel();
    setStatus("Click map to search OpenStreetMap POIs via Overpass.");

    map.flyTo({ center: DEFAULT_CENTER, zoom: 13, duration: 900 });

    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });

    map.addLayer({
      id: CIRCLE_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": 6,
        "circle-color": "#c85a2a",
        "circle-opacity": 0.85,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff",
      },
    });

    map.addLayer({
      id: LABEL_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      layout: {
        "text-field": [
          "coalesce",
          ["get", "name"],
          ["get", "brand"],
          ["get", "operator"],
          ["get", "kind"],
        ],
        "text-size": 12,
        "text-offset": [0, 1.1],
        "text-anchor": "top",
        "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
        visibility: controls.showLabels ? "visible" : "none",
      },
      paint: {
        "text-color": "#1f2937",
        "text-halo-color": "#fff",
        "text-halo-width": 1.5,
      },
    });

    popup = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: "340px",
    });

    poiClickHandler = (e) => {
      const feature = e.features?.[0];
      if (!feature) return;

      const coords = (
        feature.geometry as GeoJSON.Point
      ).coordinates.slice() as [number, number];
      const props = (feature.properties as Record<string, unknown>) ?? {};

      popup?.setLngLat(coords).setDOMContent(buildPopupDom(props)).addTo(map);
    };
    map.on("click", CIRCLE_LAYER_ID, poiClickHandler);

    mouseEnterHandler = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    map.on("mouseenter", CIRCLE_LAYER_ID, mouseEnterHandler);

    mouseLeaveHandler = () => {
      map.getCanvas().style.cursor = "crosshair";
    };
    map.on("mouseleave", CIRCLE_LAYER_ID, mouseLeaveHandler);

    map.getCanvas().style.cursor = "crosshair";

    clickHandler = (e) => {
      const hits = map.queryRenderedFeatures(e.point, {
        layers: [CIRCLE_LAYER_ID],
      });
      if (hits.length > 0) return;

      currentCenter = [e.lngLat.lng, e.lngLat.lat] as LngLat;
      scheduleFetch(map, 0);
    };
    map.on("click", clickHandler);

    syncMoveRefresh(map, Boolean(controls.autoRefreshOnMove));

    scheduleFetch(map, 0);
  },

  cleanup(map: Map) {
    cancelPendingWork();
    lastFetchKey = "";
    currentCenter = null;
    currentControls = {};

    if (clickHandler) {
      map.off("click", clickHandler);
      clickHandler = null;
    }

    syncMoveRefresh(map, false);

    if (poiClickHandler) {
      map.off("click", CIRCLE_LAYER_ID, poiClickHandler);
      poiClickHandler = null;
    }

    if (mouseEnterHandler) {
      map.off("mouseenter", CIRCLE_LAYER_ID, mouseEnterHandler);
      mouseEnterHandler = null;
    }
    if (mouseLeaveHandler) {
      map.off("mouseleave", CIRCLE_LAYER_ID, mouseLeaveHandler);
      mouseLeaveHandler = null;
    }

    popup?.remove();
    popup = null;

    map.getCanvas().style.cursor = "";

    if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID);
    if (map.getLayer(CIRCLE_LAYER_ID)) map.removeLayer(CIRCLE_LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);

    if (statusPanel?.parentNode) {
      statusPanel.parentNode.removeChild(statusPanel);
      statusPanel = null;
    }
    statusMessage = null;
  },

  update(map: Map, controls: Record<string, unknown>) {
    if (!map.getLayer(CIRCLE_LAYER_ID)) return;

    currentControls = controls;
    setLabelVisibility(map, Boolean(controls.showLabels));
    syncMoveRefresh(map, Boolean(controls.autoRefreshOnMove));

    // Only refetch when the key changes; doFetch will short-circuit otherwise.
    scheduleFetch(map, 300);
  },

  snippet: `// Overpass POI Overlay (OpenStreetMap)
import { buildOverpassQuery, fetchOverpass, overpassElementsToFeatureCollection } from "./providers/osm/overpass";

const endpoint = import.meta.env.VITE_OVERPASS_ENDPOINT || "https://overpass.kumi.systems/api/interpreter";
const center = [10.7522, 59.9139];
const filter = { key: "amenity", value: "cafe" };

const query = buildOverpassQuery({
  filter,
  center,
  radiusMeters: 800,
  maxResults: 100
});

const res = await fetchOverpass({ endpoint, query });
const geojson = overpassElementsToFeatureCollection(res.elements, { filter });

map.addSource("overpass", { type: "geojson", data: geojson });
map.addLayer({
  id: "overpass-pois",
  type: "circle",
  source: "overpass",
  paint: { "circle-color": "#c85a2a", "circle-radius": 6 }
});`,
};

