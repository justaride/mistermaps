import type { Map } from "mapbox-gl";
import type { Pattern } from "../../types";

const KOMMUNE_SOURCE = "rendalen-kommune";
const KOMMUNE_FILL = "rendalen-kommune-fill";
const KOMMUNE_LINE = "rendalen-kommune-line";
const NATURE_SOURCE = "rendalen-nature";
const NATURE_LAYER = "rendalen-nature-layer";
const WATER_SOURCE = "rendalen-water";
const WATER_LAYER = "rendalen-water-layer";
const TRAILS_SOURCE = "rendalen-trails";
const TRAILS_LAYER = "rendalen-trails-layer";

let statusPanel: HTMLDivElement | null = null;
let abortController: AbortController | null = null;

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

  async setup(map: Map) {
    abortController = new AbortController();
    const { signal } = abortController;

    createStatusPanel();
    updateStatus("Loading Rendalen data...");

    map.flyTo({
      center: [11.0, 61.83],
      zoom: 9,
      duration: 1500,
    });

    await Promise.all([
      loadKommuneBoundary(map, signal),
      loadNatureReserves(map, signal),
      loadWaterBodies(map, signal),
      loadTrails(map, signal),
    ]);

    if (!signal.aborted) {
      updateStatus("All data loaded!");
      setTimeout(() => updateStatus(""), 2000);
    }
  },

  cleanup(map: Map) {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }

    // Remove layers
    [
      KOMMUNE_FILL,
      KOMMUNE_LINE,
      NATURE_LAYER,
      WATER_LAYER,
      WATER_LAYER + "-line",
      TRAILS_LAYER,
    ].forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    });

    // Remove sources
    [KOMMUNE_SOURCE, NATURE_SOURCE, WATER_SOURCE, TRAILS_SOURCE].forEach(
      (id) => {
        if (map.getSource(id)) map.removeSource(id);
      },
    );

    if (statusPanel?.parentNode) {
      statusPanel.parentNode.removeChild(statusPanel);
      statusPanel = null;
    }
  },

  update(map: Map, controls: Record<string, unknown>) {
    if (import.meta.env.DEV) {
      console.log("[rendalen update]", controls);
    }
    const setVisible = (id: string, visible: boolean) => {
      const exists = !!map.getLayer(id);
      if (import.meta.env.DEV) {
        console.log(`[setVisible] ${id}: exists=${exists}, visible=${visible}`);
      }
      if (exists) {
        map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
      }
    };

    setVisible(KOMMUNE_FILL, controls.showBoundary as boolean);
    setVisible(KOMMUNE_LINE, controls.showBoundary as boolean);
    setVisible(NATURE_LAYER, controls.showNature as boolean);
    setVisible(WATER_LAYER, controls.showWater as boolean);
    setVisible(WATER_LAYER + "-line", controls.showWater as boolean);
    setVisible(TRAILS_LAYER, controls.showTrails as boolean);
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

// 2. NATURE RESERVES (Miljødirektoratet WFS)
// Using simplified bbox query for Rendalen area
const natureUrl = 'https://kart.naturbase.no/wfs?' +
  'service=WFS&version=2.0.0&request=GetFeature' +
  '&typeName=naturbase:naturvernomraade' +
  '&outputFormat=application/json' +
  '&bbox=10.5,61.5,11.5,62.2,EPSG:4326';

const natureData = await fetch(natureUrl).then(r => r.json());
map.addSource('nature', { type: 'geojson', data: natureData });
map.addLayer({
  id: 'nature-reserves',
  type: 'fill',
  source: 'nature',
  paint: { 'fill-color': '#22c55e', 'fill-opacity': 0.3 }
});

// 3. WATER BODIES
// Using Kartverket N50 data via WFS
const waterUrl = 'https://wfs.geonorge.no/skwms1/wfs.n50?' +
  'service=WFS&version=2.0.0&request=GetFeature' +
  '&typeName=n50:Innsjø' +
  '&outputFormat=application/json' +
  '&bbox=10.5,61.5,11.5,62.2';

// 4. HIKING TRAILS
// Via UT.no or Kartverket
const trailsUrl = 'https://wfs.geonorge.no/skwms1/wfs.n50?' +
  'service=WFS&version=2.0.0&request=GetFeature' +
  '&typeName=n50:Sti' +
  '&outputFormat=application/json' +
  '&bbox=10.5,61.5,11.5,62.2';

// KEY NORWEGIAN DATA APIS:
// - Geonorge WFS: wfs.geonorge.no
// - Naturbase: kart.naturbase.no
// - Kartverket: ws.geonorge.no
// - Kommune info: ws.geonorge.no/kommuneinfo/v1/`,
};

function createStatusPanel() {
  if (statusPanel) return;

  statusPanel = document.createElement("div");
  statusPanel.className = "panel";
  statusPanel.style.cssText = `
    position: absolute;
    bottom: 24px;
    right: 16px;
    z-index: 10;
    padding: 12px 16px;
    font-size: 13px;
  `;
  document.body.appendChild(statusPanel);
}

function updateStatus(message: string) {
  if (statusPanel) {
    statusPanel.innerHTML = message;
    statusPanel.style.display = message ? "block" : "none";
  }
}

async function loadKommuneBoundary(map: Map, signal: AbortSignal) {
  try {
    updateStatus("Loading kommune boundary...");
    const response = await fetch(
      "https://ws.geonorge.no/kommuneinfo/v1/kommuner/3424/omrade",
      { signal },
    );
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
  } catch (e) {
    console.error("Failed to load kommune boundary:", e);
  }
}

async function loadNatureReserves(map: Map, signal: AbortSignal) {
  try {
    updateStatus("Loading nature reserves...");

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

    const response = await fetch(url, { signal });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (
      data.features &&
      data.features.length > 0 &&
      !map.getSource(NATURE_SOURCE)
    ) {
      map.addSource(NATURE_SOURCE, { type: "geojson", data });

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
  } catch (e) {
    console.error("Failed to load nature reserves:", e);
  }
}

async function loadWaterBodies(map: Map, signal: AbortSignal) {
  try {
    updateStatus("Loading water bodies...");

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
      fetch(lakesUrl, { signal }),
      fetch(riversUrl, { signal }),
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
        id: WATER_LAYER + "-line",
        type: "line",
        source: WATER_SOURCE,
        filter: ["==", "$type", "LineString"],
        paint: {
          "line-color": "#0284c7",
          "line-width": 3,
        },
      });
    }
  } catch (e) {
    console.error("Failed to load water bodies:", e);
  }
}

async function loadTrails(map: Map, signal: AbortSignal) {
  try {
    updateStatus("Loading hiking trails...");

    const wfsUrl =
      "https://wfs.geonorge.no/skwms1/wfs.turogfriluftsruter?" +
      "service=WFS&version=2.0.0&request=GetFeature" +
      "&typeName=app:Fotrute&srsName=EPSG:4326" +
      "&bbox=10.5,61.5,11.8,62.3,EPSG:4326&count=50";

    const response = await fetch(wfsUrl, { signal });
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
  } catch (e) {
    console.error("Failed to load trails:", e);
    if (!map.getSource(TRAILS_SOURCE)) {
      map.addSource(TRAILS_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
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
  }
}

function parseGmlToGeoJson(gmlText: string): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(gmlText, "text/xml");

  const members = doc.querySelectorAll("member");

  members.forEach((member) => {
    const nameEl = member.querySelector("rutenavn");
    const name = nameEl?.textContent || "Unknown trail";

    const posListEl = member.querySelector("posList");
    if (!posListEl?.textContent) return;

    const coords = parsePosList(posListEl.textContent);
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

function parsePosList(posList: string): [number, number][] {
  const values = posList.trim().split(/\s+/).map(Number);
  const coords: [number, number][] = [];

  for (let i = 0; i < values.length - 1; i += 2) {
    const lat = values[i];
    const lon = values[i + 1];
    if (!isNaN(lon) && !isNaN(lat)) {
      coords.push([lon, lat]);
    }
  }

  return coords;
}
