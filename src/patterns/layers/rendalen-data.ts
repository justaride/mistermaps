import type { Map } from "mapbox-gl";
import type { ControlValues, Pattern } from "../../types";

const KOMMUNE_SOURCE = "rendalen-kommune";
const KOMMUNE_FILL = "rendalen-kommune-fill";
const KOMMUNE_LINE = "rendalen-kommune-line";
const NATURE_SOURCE = "rendalen-nature";
const NATURE_LAYER = "rendalen-nature-layer";
const WATER_SOURCE = "rendalen-water";
const WATER_LAYER = "rendalen-water-layer";
const WATER_LINE = "rendalen-water-layer-line";
const TRAILS_SOURCE = "rendalen-trails";
const TRAILS_LAYER = "rendalen-trails-layer";

const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

type LoadContext = {
  signal: AbortSignal;
  statusPanel: HTMLDivElement | null;
  mapContainer: HTMLElement;
  loaded: number;
  failed: string[];
  total: number;
};

export const rendalenDataPattern: Pattern = {
  id: "rendalen-data",
  name: "Rendalen Data",
  category: "layers",
  description: "All Norwegian public data for Rendalen Kommune loaded live.",
  controls: [
    {
      id: "showBoundary",
      label: "Kommune Boundary",
      type: "toggle",
      defaultValue: true,
    },
    {
      id: "showNature",
      label: "Nature Reserves",
      type: "toggle",
      defaultValue: true,
    },
    {
      id: "showWater",
      label: "Water Bodies",
      type: "toggle",
      defaultValue: true,
    },
    {
      id: "showTrails",
      label: "Hiking Trails",
      type: "toggle",
      defaultValue: true,
    },
  ],

  async setup(map: Map, controls: ControlValues) {
    const controller = new AbortController();
    const ctx: LoadContext = {
      signal: controller.signal,
      statusPanel: null,
      mapContainer: map.getContainer(),
      loaded: 0,
      failed: [],
      total: 4,
    };

    createStatusPanel(ctx);
    updateStatus(ctx, "Loading data (0/4)...");

    (map as unknown as Record<string, unknown>).__rendalenCtx = ctx;
    (map as unknown as Record<string, unknown>).__rendalenAbort = controller;

    map.flyTo({
      center: [11.0, 61.83],
      zoom: 9,
      duration: 1500,
    });

    await Promise.all([
      loadKommuneBoundary(map, ctx),
      loadNatureReserves(map, ctx),
      loadWaterBodies(map, ctx),
      loadTrails(map, ctx),
    ]);

    if (!ctx.signal.aborted) {
      if (ctx.failed.length === 0) {
        updateStatus(ctx, "All data loaded!");
      } else {
        const failedStr = ctx.failed.join(", ");
        updateStatus(
          ctx,
          `Loaded ${ctx.loaded}/${ctx.total} sources (${failedStr} failed)`,
        );
      }
      setTimeout(() => updateStatus(ctx, ""), 3000);
    }

    applyVisibility(map, controls);
  },

  cleanup(map: Map) {
    const controller = (map as unknown as Record<string, unknown>)
      .__rendalenAbort as AbortController | undefined;
    if (controller) {
      controller.abort();
      (map as unknown as Record<string, unknown>).__rendalenAbort = undefined;
    }

    const ctx = (map as unknown as Record<string, unknown>).__rendalenCtx as
      | LoadContext
      | undefined;
    if (ctx?.statusPanel?.parentNode) {
      ctx.statusPanel.parentNode.removeChild(ctx.statusPanel);
    }
    (map as unknown as Record<string, unknown>).__rendalenCtx = undefined;

    [
      KOMMUNE_FILL,
      KOMMUNE_LINE,
      NATURE_LAYER,
      WATER_LAYER,
      WATER_LINE,
      TRAILS_LAYER,
    ].forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    });

    [KOMMUNE_SOURCE, NATURE_SOURCE, WATER_SOURCE, TRAILS_SOURCE].forEach(
      (id) => {
        if (map.getSource(id)) map.removeSource(id);
      },
    );
  },

  update(map: Map, controls: ControlValues) {
    applyVisibility(map, controls);
  },

  snippet: `// RENDALEN KOMMUNE - ALL PUBLIC DATA
// ===================================

// 1. KOMMUNE BOUNDARY (Geonorge)
const kommuneResponse = await fetch(
  'https://ws.geonorge.no/kommuneinfo/v1/kommuner/3424/omrade'
);
const kommuneData = await kommuneResponse.json();

map.addSource('kommune', { type: 'geojson', data: kommuneData });
map.addLayer({
  id: 'kommune-boundary',
  type: 'line',
  source: 'kommune',
  paint: { 'line-color': '#ef4444', 'line-width': 3 }
});

// 2. NATURE RESERVES (Miljødirektoratet ArcGIS)
const natureUrl = 'https://kart.miljodirektoratet.no/arcgis/rest/services/vern/MapServer/0/query?' +
  'where=1%3D1&geometry={"xmin":10.5,"ymin":61.5,"xmax":11.8,"ymax":62.3,' +
  '"spatialReference":{"wkid":4326}}&geometryType=esriGeometryEnvelope' +
  '&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&f=geojson&outSR=4326';

const natureData = await fetch(natureUrl).then(r => r.json());
map.addSource('nature', { type: 'geojson', data: natureData });
map.addLayer({
  id: 'nature-reserves',
  type: 'fill',
  source: 'nature',
  paint: { 'fill-color': '#22c55e', 'fill-opacity': 0.3 }
});

// 3. WATER BODIES (NVE lakes + rivers)
// bbox: 10.5,61.5 to 11.8,62.3
const lakesUrl = 'https://kart.nve.no/enterprise/rest/services/Innsjodatabase2/MapServer/5/query?...';
const riversUrl = 'https://kart.nve.no/enterprise/rest/services/Elvenett1/MapServer/2/query?...';

// 4. HIKING TRAILS (Geonorge WFS + GML parsing)
const trailsUrl = 'https://wfs.geonorge.no/skwms1/wfs.turogfriluftsruter?' +
  'service=WFS&version=2.0.0&request=GetFeature' +
  '&typeName=app:Fotrute&srsName=EPSG:4326' +
  '&bbox=10.5,61.5,11.8,62.3,EPSG:4326&count=50';

// KEY NORWEGIAN DATA APIS:
// - Geonorge WFS: wfs.geonorge.no
// - Naturbase: kart.naturbase.no
// - Kartverket: ws.geonorge.no
// - Kommune info: ws.geonorge.no/kommuneinfo/v1/`,
};

function applyVisibility(map: Map, controls: ControlValues) {
  const setVisible = (id: string, visible: boolean) => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    }
  };

  setVisible(KOMMUNE_FILL, controls.showBoundary as boolean);
  setVisible(KOMMUNE_LINE, controls.showBoundary as boolean);
  setVisible(NATURE_LAYER, controls.showNature as boolean);
  setVisible(WATER_LAYER, controls.showWater as boolean);
  setVisible(WATER_LINE, controls.showWater as boolean);
  setVisible(TRAILS_LAYER, controls.showTrails as boolean);
}

function createStatusPanel(ctx: LoadContext) {
  if (ctx.statusPanel) return;

  ctx.statusPanel = document.createElement("div");
  ctx.statusPanel.className = "panel";
  ctx.statusPanel.style.cssText = `
    position: absolute;
    bottom: 24px;
    right: 16px;
    z-index: 10;
    padding: 12px 16px;
    font-size: 13px;
  `;
  ctx.mapContainer.appendChild(ctx.statusPanel);
}

function updateStatus(ctx: LoadContext, message: string) {
  if (ctx.statusPanel) {
    ctx.statusPanel.innerHTML = message;
    ctx.statusPanel.style.display = message ? "block" : "none";
  }
}

function markLoaded(ctx: LoadContext, name: string, success: boolean) {
  if (success) {
    ctx.loaded++;
  } else {
    ctx.failed.push(name);
  }
  if (!ctx.signal.aborted) {
    const done = ctx.loaded + ctx.failed.length;
    if (done < ctx.total) {
      updateStatus(ctx, `Loading data (${done}/${ctx.total})...`);
    }
  }
}

async function loadKommuneBoundary(map: Map, ctx: LoadContext) {
  try {
    const response = await fetch(
      "https://ws.geonorge.no/kommuneinfo/v1/kommuner/3424/omrade",
      { signal: ctx.signal },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!map.getSource(KOMMUNE_SOURCE)) {
      map.addSource(KOMMUNE_SOURCE, { type: "geojson", data });

      map.addLayer({
        id: KOMMUNE_FILL,
        type: "fill",
        source: KOMMUNE_SOURCE,
        paint: {
          "fill-color": "#3b82f6",
          "fill-opacity": 0.1,
        },
      });

      map.addLayer({
        id: KOMMUNE_LINE,
        type: "line",
        source: KOMMUNE_SOURCE,
        paint: {
          "line-color": "#ef4444",
          "line-width": 3,
          "line-dasharray": [2, 1],
        },
      });
    }

    markLoaded(ctx, "boundary", true);
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    console.error("Failed to load kommune boundary:", e);

    if (!map.getSource(KOMMUNE_SOURCE)) {
      map.addSource(KOMMUNE_SOURCE, { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: KOMMUNE_FILL,
        type: "fill",
        source: KOMMUNE_SOURCE,
        paint: { "fill-color": "#3b82f6", "fill-opacity": 0.1 },
      });
      map.addLayer({
        id: KOMMUNE_LINE,
        type: "line",
        source: KOMMUNE_SOURCE,
        paint: {
          "line-color": "#ef4444",
          "line-width": 3,
          "line-dasharray": [2, 1],
        },
      });
    }

    markLoaded(ctx, "boundary", false);
  }
}

async function loadNatureReserves(map: Map, ctx: LoadContext) {
  try {
    const geometry = JSON.stringify({
      xmin: 10.5,
      ymin: 61.5,
      xmax: 11.8,
      ymax: 62.3,
      spatialReference: { wkid: 4326 },
    });

    const url =
      "https://kart.miljodirektoratet.no/arcgis/rest/services/vern/MapServer/0/query?" +
      "where=1%3D1" +
      "&geometry=" +
      encodeURIComponent(geometry) +
      "&geometryType=esriGeometryEnvelope" +
      "&inSR=4326" +
      "&spatialRel=esriSpatialRelIntersects" +
      "&outFields=*" +
      "&f=geojson" +
      "&outSR=4326";

    const response = await fetch(url, { signal: ctx.signal });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const hasFeatures = data.features && data.features.length > 0;

    if (!map.getSource(NATURE_SOURCE)) {
      map.addSource(NATURE_SOURCE, {
        type: "geojson",
        data: hasFeatures ? data : EMPTY_FC,
      });

      map.addLayer({
        id: NATURE_LAYER,
        type: "fill",
        source: NATURE_SOURCE,
        paint: {
          "fill-color": "#22c55e",
          "fill-opacity": 0.4,
          "fill-outline-color": "#15803d",
        },
      });
    }

    markLoaded(ctx, "nature", true);
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    console.error("Failed to load nature reserves:", e);

    if (!map.getSource(NATURE_SOURCE)) {
      map.addSource(NATURE_SOURCE, { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: NATURE_LAYER,
        type: "fill",
        source: NATURE_SOURCE,
        paint: {
          "fill-color": "#22c55e",
          "fill-opacity": 0.4,
          "fill-outline-color": "#15803d",
        },
      });
    }

    markLoaded(ctx, "nature", false);
  }
}

async function loadWaterBodies(map: Map, ctx: LoadContext) {
  try {
    const bbox = encodeURIComponent(
      JSON.stringify({
        xmin: 10.5,
        ymin: 61.5,
        xmax: 11.8,
        ymax: 62.3,
        spatialReference: { wkid: 4326 },
      }),
    );

    const lakesUrl =
      `https://kart.nve.no/enterprise/rest/services/Innsjodatabase2/MapServer/5/query?` +
      `where=1%3D1&geometry=${bbox}&geometryType=esriGeometryEnvelope&inSR=4326&` +
      `spatialRel=esriSpatialRelIntersects&outFields=vatnLnr,navn&f=geojson&outSR=4326`;

    const riversUrl =
      `https://kart.nve.no/enterprise/rest/services/Elvenett1/MapServer/2/query?` +
      `where=1%3D1&geometry=${bbox}&geometryType=esriGeometryEnvelope&inSR=4326&` +
      `spatialRel=esriSpatialRelIntersects&outFields=elvId,navn&f=geojson&outSR=4326`;

    const [lakesResponse, riversResponse] = await Promise.all([
      fetch(lakesUrl, { signal: ctx.signal }),
      fetch(riversUrl, { signal: ctx.signal }),
    ]);

    const lakesData = lakesResponse.ok ? await lakesResponse.json() : null;
    const riversData = riversResponse.ok ? await riversResponse.json() : null;

    const combinedFeatures: GeoJSON.Feature[] = [];

    if (lakesData?.features) {
      combinedFeatures.push(...lakesData.features);
    }
    if (riversData?.features) {
      combinedFeatures.push(...riversData.features);
    }

    const waterData: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: combinedFeatures,
    };

    if (!map.getSource(WATER_SOURCE)) {
      map.addSource(WATER_SOURCE, { type: "geojson", data: waterData });

      map.addLayer({
        id: WATER_LAYER,
        type: "fill",
        source: WATER_SOURCE,
        filter: ["==", "$type", "Polygon"],
        paint: {
          "fill-color": "#0ea5e9",
          "fill-opacity": 0.5,
        },
      });

      map.addLayer({
        id: WATER_LINE,
        type: "line",
        source: WATER_SOURCE,
        filter: ["==", "$type", "LineString"],
        paint: {
          "line-color": "#0284c7",
          "line-width": 3,
        },
      });
    }

    markLoaded(ctx, "water", true);
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    console.error("Failed to load water bodies:", e);

    if (!map.getSource(WATER_SOURCE)) {
      map.addSource(WATER_SOURCE, { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: WATER_LAYER,
        type: "fill",
        source: WATER_SOURCE,
        filter: ["==", "$type", "Polygon"],
        paint: { "fill-color": "#0ea5e9", "fill-opacity": 0.5 },
      });
      map.addLayer({
        id: WATER_LINE,
        type: "line",
        source: WATER_SOURCE,
        filter: ["==", "$type", "LineString"],
        paint: { "line-color": "#0284c7", "line-width": 3 },
      });
    }

    markLoaded(ctx, "water", false);
  }
}

async function loadTrails(map: Map, ctx: LoadContext) {
  try {
    const wfsUrl =
      "https://wfs.geonorge.no/skwms1/wfs.turogfriluftsruter?" +
      "service=WFS&version=2.0.0&request=GetFeature" +
      "&typeName=app:Fotrute&srsName=EPSG:4326" +
      "&bbox=10.5,61.5,11.8,62.3,EPSG:4326&count=50";

    const response = await fetch(wfsUrl, { signal: ctx.signal });
    if (!response.ok) {
      throw new Error(`WFS request failed: ${response.status}`);
    }

    const gmlText = await response.text();
    const trailsData = parseGmlToGeoJson(gmlText);

    if (!map.getSource(TRAILS_SOURCE)) {
      map.addSource(TRAILS_SOURCE, { type: "geojson", data: trailsData });

      map.addLayer({
        id: TRAILS_LAYER,
        type: "line",
        source: TRAILS_SOURCE,
        paint: {
          "line-color": "#f97316",
          "line-width": 2,
          "line-dasharray": [2, 1],
        },
      });
    }

    markLoaded(ctx, "trails", true);
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    console.error("Failed to load trails:", e);

    if (!map.getSource(TRAILS_SOURCE)) {
      map.addSource(TRAILS_SOURCE, {
        type: "geojson",
        data: EMPTY_FC,
      });
      map.addLayer({
        id: TRAILS_LAYER,
        type: "line",
        source: TRAILS_SOURCE,
        paint: {
          "line-color": "#f97316",
          "line-width": 2,
          "line-dasharray": [2, 1],
        },
      });
    }

    markLoaded(ctx, "trails", false);
  }
}

function parseGmlToGeoJson(gmlText: string): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(gmlText, "text/xml");

  const members = Array.from(doc.getElementsByTagNameNS("*", "member"));

  members.forEach((member) => {
    const nameEl = member.getElementsByTagNameNS("*", "rutenavn")[0];
    const name = nameEl?.textContent?.trim() || "Unknown trail";

    const posListEl = member.getElementsByTagNameNS("*", "posList")[0];
    let coords: [number, number][] = [];

    if (posListEl?.textContent) {
      const dim = Number(posListEl.getAttribute("srsDimension")) || 2;
      coords = parsePosList(posListEl.textContent, dim, {
        minLon: 10.5,
        minLat: 61.5,
        maxLon: 11.8,
        maxLat: 62.3,
      });
    } else {
      const posEls = member.getElementsByTagNameNS("*", "pos");
      if (posEls.length > 0) {
        coords = parsePosElements(posEls, {
          minLon: 10.5,
          minLat: 61.5,
          maxLon: 11.8,
          maxLat: 62.3,
        });
      }
    }

    if (coords.length < 2) return;

    features.push({
      type: "Feature",
      properties: { name },
      geometry: {
        type: "LineString",
        coordinates: coords,
      },
    });
  });

  return { type: "FeatureCollection", features };
}

function parsePosElements(
  posEls: HTMLCollectionOf<Element>,
  expectedBbox?: {
    minLon: number;
    minLat: number;
    maxLon: number;
    maxLat: number;
  },
): [number, number][] {
  const coords: [number, number][] = [];
  const inBbox = (lon: number, lat: number) => {
    if (!expectedBbox) return true;
    return (
      lon >= expectedBbox.minLon &&
      lon <= expectedBbox.maxLon &&
      lat >= expectedBbox.minLat &&
      lat <= expectedBbox.maxLat
    );
  };

  let swapAxisOrder = false;
  if (expectedBbox && posEls.length > 0) {
    let normalScore = 0;
    let swappedScore = 0;
    const samples = Math.min(posEls.length, 10);
    for (let i = 0; i < samples; i++) {
      const parts = posEls[i].textContent?.trim().split(/\s+/).map(Number);
      if (!parts || parts.length < 2) continue;
      if (inBbox(parts[0], parts[1])) normalScore++;
      if (inBbox(parts[1], parts[0])) swappedScore++;
    }
    swapAxisOrder = swappedScore >= normalScore;
  }

  for (let i = 0; i < posEls.length; i++) {
    const parts = posEls[i].textContent?.trim().split(/\s+/).map(Number);
    if (!parts || parts.length < 2) continue;
    if (!Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) continue;
    const lon = swapAxisOrder ? parts[1] : parts[0];
    const lat = swapAxisOrder ? parts[0] : parts[1];
    coords.push([lon, lat]);
  }

  return coords;
}

function parsePosList(
  posList: string,
  dim: number,
  expectedBbox?: {
    minLon: number;
    minLat: number;
    maxLon: number;
    maxLat: number;
  },
): [number, number][] {
  const values = posList.trim().split(/\s+/).map(Number);
  const coords: [number, number][] = [];

  const inBbox = (lon: number, lat: number) => {
    if (!expectedBbox) return true;
    return (
      lon >= expectedBbox.minLon &&
      lon <= expectedBbox.maxLon &&
      lat >= expectedBbox.minLat &&
      lat <= expectedBbox.maxLat
    );
  };

  const tupleCount = Math.floor(values.length / dim);
  let swapAxisOrder = false;
  if (expectedBbox && tupleCount >= 1) {
    let normalScore = 0;
    let swappedScore = 0;
    const samples = Math.min(tupleCount, 10);
    for (let i = 0; i < samples; i++) {
      const a = values[i * dim];
      const b = values[i * dim + 1];
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      if (inBbox(a, b)) normalScore++;
      if (inBbox(b, a)) swappedScore++;
    }
    swapAxisOrder = swappedScore >= normalScore;
  }

  for (let i = 0; i < values.length - (dim - 1); i += dim) {
    const a = values[i];
    const b = values[i + 1];
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;

    const lon = swapAxisOrder ? b : a;
    const lat = swapAxisOrder ? a : b;
    coords.push([lon, lat]);
  }

  return coords;
}
