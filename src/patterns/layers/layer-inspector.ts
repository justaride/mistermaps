import type { Map, MapMouseEvent } from "mapbox-gl";
import type { Pattern } from "../../types";

let infoPanel: HTMLDivElement | null = null;

export const layerInspectorPattern: Pattern = {
  id: "layer-inspector",
  name: "Layer Inspector",
  category: "layers",
  description:
    "Inspect available layers in current view. Click map features to see their data.",
  controls: [
    {
      id: "showInfo",
      label: "Show Layer Info",
      type: "toggle",
      defaultValue: true,
    },
  ],

  setup(map: Map) {
    map.flyTo({
      center: [11.0, 61.83],
      zoom: 12,
      duration: 1000,
    });

    createInfoPanel(map);

    map.on("click", handleMapClick);
    map.on("mousemove", handleMouseMove);
  },

  cleanup(map: Map) {
    map.off("click", handleMapClick);
    map.off("mousemove", handleMouseMove);

    if (infoPanel && infoPanel.parentNode) {
      infoPanel.parentNode.removeChild(infoPanel);
      infoPanel = null;
    }

    map.getCanvas().style.cursor = "";
  },

  update() {},

  snippet: `// WHAT DATA IS AVAILABLE FOR RENDALEN KOMMUNE?
// =============================================

// 1. MAPBOX BASE LAYERS (included in style)
// -----------------------------------------
// These come with Mapbox styles automatically:
// - Roads (even small forest roads in Norway)
// - Water bodies (Sølensjøen, rivers, streams)
// - Terrain/contours
// - Place names
// - Land use (forests, etc.)
// - Administrative boundaries

// Check what's at a location:
map.on('click', (e) => {
  const features = map.queryRenderedFeatures(e.point);
  console.log('Features at click:', features);

  features.forEach(f => {
    console.log('Layer:', f.layer.id);
    console.log('Type:', f.layer.type);
    console.log('Properties:', f.properties);
  });
});

// 2. NORWEGIAN PUBLIC DATA SOURCES
// --------------------------------
// Free GeoJSON/WMS you can add:

// Kartverket (Norwegian Mapping Authority):
// https://kartkatalog.geonorge.no/
// - Administrative boundaries
// - Property boundaries (matrikkel)
// - Place names
// - Topographic data

// Example - Add kommune boundary:
fetch('https://ws.geonorge.no/kommuneinfo/v1/kommuner/3424/omrade')
  .then(r => r.json())
  .then(data => {
    map.addSource('rendalen-boundary', {
      type: 'geojson',
      data: data
    });
    map.addLayer({
      id: 'rendalen-outline',
      type: 'line',
      source: 'rendalen-boundary',
      paint: { 'line-color': '#ff0000', 'line-width': 3 }
    });
  });

// 3. MUNICIPALITY CODE
// --------------------
// Rendalen kommune = 3424 (new) / 0432 (old)
// Use this code to fetch data from Norwegian APIs

// 4. AVAILABLE APIs
// -----------------
// Geonorge WMS services:
// - Topographic maps
// - Aerial photos
// - Historical maps
// - Avalanche zones
// - Protected areas

// SSB (Statistics Norway):
// - Population data
// - Demographics
// - Land use statistics

// Miljødirektoratet:
// - Nature reserves
// - Protected species
// - Environmental data`,
};

function createInfoPanel(map: Map) {
  if (infoPanel) return;

  const layers = map.getStyle()?.layers || [];
  const sources = map.getStyle()?.sources || {};

  const layerTypes = layers.reduce(
    (acc, layer) => {
      acc[layer.type] = (acc[layer.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  infoPanel = document.createElement("div");
  infoPanel.className = "panel";
  infoPanel.id = "layer-inspector-panel";
  infoPanel.style.cssText = `
    position: absolute;
    top: 100px;
    right: 16px;
    z-index: 10;
    padding: 16px;
    max-width: 300px;
    max-height: 70vh;
    overflow-y: auto;
    font-size: 12px;
  `;

  infoPanel.innerHTML = `
    <h4 style="margin: 0 0 12px; font-size: 14px;">Rendalen Data Sources</h4>

    <div style="margin-bottom: 16px;">
      <div style="font-weight: 600; margin-bottom: 4px;">Mapbox Style Layers</div>
      <div style="color: var(--text-secondary);">
        ${Object.entries(layerTypes)
          .map(([type, count]) => `${type}: ${count}`)
          .join(" · ")}
      </div>
      <div style="margin-top: 4px; color: var(--text-secondary);">
        Total: ${layers.length} layers from ${Object.keys(sources).length} sources
      </div>
    </div>

    <div style="margin-bottom: 16px;">
      <div style="font-weight: 600; margin-bottom: 4px;">Norwegian Public Data</div>
      <div style="color: var(--text-secondary); line-height: 1.5;">
        <div>• <a href="https://kartkatalog.geonorge.no/" target="_blank" style="color: var(--accent);">Geonorge</a> - Maps & geodata</div>
        <div>• <a href="https://www.kartverket.no/" target="_blank" style="color: var(--accent);">Kartverket</a> - Boundaries</div>
        <div>• <a href="https://kart.naturbase.no/" target="_blank" style="color: var(--accent);">Naturbase</a> - Nature data</div>
        <div>• <a href="https://www.ssb.no/kart" target="_blank" style="color: var(--accent);">SSB</a> - Statistics</div>
      </div>
    </div>

    <div style="margin-bottom: 16px;">
      <div style="font-weight: 600; margin-bottom: 4px;">Rendalen Info</div>
      <div style="color: var(--text-secondary);">
        Kommune code: 3424<br>
        Fylke: Innlandet
      </div>
    </div>

    <div style="border-top: 1px solid var(--panel-border); padding-top: 12px;">
      <div style="font-weight: 600; margin-bottom: 4px;">Click Map to Inspect</div>
      <div id="click-info" style="color: var(--text-secondary);">
        Click anywhere to see features...
      </div>
    </div>
  `;

  document.body.appendChild(infoPanel);
}

function handleMapClick(e: MapMouseEvent & { target: Map }) {
  const map = e.target;
  const features = map.queryRenderedFeatures(e.point);

  const clickInfo = document.getElementById("click-info");
  if (!clickInfo) return;

  if (features.length === 0) {
    clickInfo.innerHTML = "No features at this location";
    return;
  }

  const uniqueLayers = [
    ...new Set(features.map((f) => f.layer?.id).filter(Boolean)),
  ];
  const sample = features.filter((f) => f.layer).slice(0, 5);

  clickInfo.innerHTML = `
    <div style="margin-bottom: 8px;"><strong>${features.length} features found</strong></div>
    <div style="margin-bottom: 8px;">Layers: ${uniqueLayers.slice(0, 5).join(", ")}${uniqueLayers.length > 5 ? "..." : ""}</div>
    ${sample
      .map(
        (f) => `
      <div style="background: var(--panel-border); padding: 6px; margin: 4px 0; border-radius: 4px;">
        <div style="font-weight: 500;">${f.layer?.id || "unknown"}</div>
        <div style="font-size: 11px; color: var(--text-secondary);">
          Type: ${f.layer?.type || "unknown"}<br>
          ${f.properties?.name ? `Name: ${f.properties.name}<br>` : ""}
          ${f.properties?.class ? `Class: ${f.properties.class}` : ""}
        </div>
      </div>
    `,
      )
      .join("")}
  `;
}

function handleMouseMove(e: MapMouseEvent & { target: Map }) {
  const map = e.target;
  const features = map.queryRenderedFeatures(e.point);
  map.getCanvas().style.cursor = features.length > 0 ? "pointer" : "";
}
