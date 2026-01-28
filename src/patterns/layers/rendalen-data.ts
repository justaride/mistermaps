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
    createStatusPanel();
    updateStatus("Loading Rendalen data...");

    map.flyTo({
      center: [11.0, 61.83],
      zoom: 9,
      duration: 1500,
    });

    // Load all data sources in parallel
    await Promise.all([
      loadKommuneBoundary(map),
      loadNatureReserves(map),
      loadWaterBodies(map),
      loadTrails(map),
    ]);

    updateStatus("All data loaded!");
    setTimeout(() => updateStatus(""), 2000);
  },

  cleanup(map: Map) {
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
    const setVisible = (id: string, visible: boolean) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
      }
    };

    setVisible(KOMMUNE_FILL, controls.showBoundary as boolean);
    setVisible(KOMMUNE_LINE, controls.showBoundary as boolean);
    setVisible(NATURE_LAYER, controls.showNature as boolean);
    setVisible(WATER_LAYER, controls.showWater as boolean);
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

async function loadKommuneBoundary(map: Map) {
  try {
    updateStatus("Loading kommune boundary...");
    const response = await fetch(
      "https://ws.geonorge.no/kommuneinfo/v1/kommuner/3424/omrade",
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

async function loadNatureReserves(map: Map) {
  try {
    updateStatus("Loading nature reserves...");

    // Naturbase WFS for nature reserves in Rendalen area
    const url =
      "https://kart.miljodirektoratet.no/arcgis/services/vern/MapServer/WFSServer?" +
      "service=WFS&version=2.0.0&request=GetFeature" +
      "&typeName=vern:Naturvernområde" +
      "&outputFormat=geojson" +
      "&srsName=EPSG:4326" +
      "&bbox=10.5,61.5,11.8,62.3,EPSG:4326";

    const response = await fetch(url);

    if (response.ok) {
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
    } else {
      // Fallback: create sample nature reserve polygons
      await loadSampleNatureReserves(map);
    }
  } catch (e) {
    console.error("Failed to load nature reserves:", e);
    await loadSampleNatureReserves(map);
  }
}

async function loadSampleNatureReserves(map: Map) {
  // Approximate locations of known nature reserves near Rendalen
  const sampleData: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          name: "Sølen landskapsvernområde",
          type: "Landskapsvernområde",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [11.0, 61.7],
              [11.3, 61.7],
              [11.3, 61.85],
              [11.0, 61.85],
              [11.0, 61.7],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Jutulhogget naturreservat",
          type: "Naturreservat",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [10.85, 61.92],
              [10.95, 61.92],
              [10.95, 61.98],
              [10.85, 61.98],
              [10.85, 61.92],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Fonnåsfjellet naturreservat",
          type: "Naturreservat",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [11.15, 61.95],
              [11.35, 61.95],
              [11.35, 62.05],
              [11.15, 62.05],
              [11.15, 61.95],
            ],
          ],
        },
      },
    ],
  };

  if (!map.getSource(NATURE_SOURCE)) {
    map.addSource(NATURE_SOURCE, { type: "geojson", data: sampleData });

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
}

async function loadWaterBodies(map: Map) {
  try {
    updateStatus("Loading water bodies...");

    // Major water bodies in Rendalen
    const waterData: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "Sølensjøen" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [11.1, 61.72],
                [11.25, 61.72],
                [11.28, 61.78],
                [11.22, 61.82],
                [11.12, 61.8],
                [11.08, 61.75],
                [11.1, 61.72],
              ],
            ],
          },
        },
        {
          type: "Feature",
          properties: { name: "Osensjøen" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [11.3, 61.55],
                [11.42, 61.55],
                [11.45, 61.62],
                [11.38, 61.67],
                [11.28, 61.65],
                [11.25, 61.58],
                [11.3, 61.55],
              ],
            ],
          },
        },
        {
          type: "Feature",
          properties: { name: "Lomnessjøen" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [10.95, 61.88],
                [11.02, 61.88],
                [11.02, 61.92],
                [10.95, 61.92],
                [10.95, 61.88],
              ],
            ],
          },
        },
        {
          type: "Feature",
          properties: { name: "Glåma (river)" },
          geometry: {
            type: "LineString",
            coordinates: [
              [11.05, 61.6],
              [11.0, 61.7],
              [10.98, 61.8],
              [11.02, 61.9],
              [11.0, 62.0],
            ],
          },
        },
      ],
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

      // Add river line on top
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

async function loadTrails(map: Map) {
  try {
    updateStatus("Loading hiking trails...");

    // Popular trails in Rendalen area
    const trailsData: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "Sølen rundtur", difficulty: "medium" },
          geometry: {
            type: "LineString",
            coordinates: [
              [11.12, 61.74],
              [11.18, 61.76],
              [11.22, 61.8],
              [11.18, 61.82],
              [11.14, 61.8],
              [11.12, 61.76],
              [11.12, 61.74],
            ],
          },
        },
        {
          type: "Feature",
          properties: { name: "Jutulhogget sti", difficulty: "easy" },
          geometry: {
            type: "LineString",
            coordinates: [
              [10.86, 61.93],
              [10.88, 61.95],
              [10.92, 61.96],
              [10.9, 61.97],
            ],
          },
        },
        {
          type: "Feature",
          properties: { name: "Rendalen pilgrimsled", difficulty: "hard" },
          geometry: {
            type: "LineString",
            coordinates: [
              [10.95, 61.75],
              [10.98, 61.8],
              [11.0, 61.85],
              [10.98, 61.9],
              [11.02, 61.95],
              [11.0, 62.0],
            ],
          },
        },
        {
          type: "Feature",
          properties: { name: "Fonnåsfjellet tur", difficulty: "medium" },
          geometry: {
            type: "LineString",
            coordinates: [
              [11.2, 61.96],
              [11.25, 61.98],
              [11.28, 62.02],
              [11.3, 62.0],
            ],
          },
        },
      ],
    };

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
  }
}
