import type { Map } from "mapbox-gl";
import type { Pattern } from "../../types";

let layerPanel: HTMLDivElement | null = null;

export const layerExplorerPattern: Pattern = {
  id: "layer-explorer",
  name: "Layer Explorer",
  category: "layers",
  description:
    "Explore and toggle all layers in the map style. Learn how Mapbox layers are structured.",
  controls: [
    {
      id: "showLabels",
      label: "Show Label Layers",
      type: "toggle",
      defaultValue: true,
    },
    {
      id: "showRoads",
      label: "Show Road Layers",
      type: "toggle",
      defaultValue: true,
    },
    {
      id: "showLanduse",
      label: "Show Land Use",
      type: "toggle",
      defaultValue: true,
    },
    {
      id: "showWater",
      label: "Show Water",
      type: "toggle",
      defaultValue: true,
    },
  ],

  setup(map: Map, controls: Record<string, unknown>) {
    createLayerPanel(map);
    applyLayerVisibility(map, controls);
  },

  cleanup(map: Map) {
    if (layerPanel && layerPanel.parentNode) {
      layerPanel.parentNode.removeChild(layerPanel);
      layerPanel = null;
    }

    const layers = map.getStyle()?.layers || [];
    layers.forEach((layer) => {
      try {
        map.setLayoutProperty(layer.id, "visibility", "visible");
      } catch {
        // Layer may not support visibility
      }
    });
  },

  update(map: Map, controls: Record<string, unknown>) {
    applyLayerVisibility(map, controls);
  },

  snippet: `// Layer Explorer - Understanding Mapbox Layers
//
// LAYER TYPES IN MAPBOX GL JS:
//
// 1. BACKGROUND - Base color of the map
//    map.addLayer({ id: 'bg', type: 'background', paint: { 'background-color': '#f0f0f0' }})
//
// 2. FILL - Polygons (buildings, parks, water bodies)
//    map.addLayer({ id: 'parks', type: 'fill', source: 'parks',
//      paint: { 'fill-color': '#22c55e', 'fill-opacity': 0.5 }})
//
// 3. LINE - Roads, borders, paths
//    map.addLayer({ id: 'roads', type: 'line', source: 'roads',
//      paint: { 'line-color': '#888', 'line-width': 2 }})
//
// 4. SYMBOL - Labels and icons
//    map.addLayer({ id: 'labels', type: 'symbol', source: 'places',
//      layout: { 'text-field': ['get', 'name'], 'text-size': 14 }})
//
// 5. CIRCLE - Point data as circles
//    map.addLayer({ id: 'points', type: 'circle', source: 'points',
//      paint: { 'circle-radius': 8, 'circle-color': '#3b82f6' }})
//
// 6. FILL-EXTRUSION - 3D buildings
//    map.addLayer({ id: 'buildings-3d', type: 'fill-extrusion', source: 'buildings',
//      paint: { 'fill-extrusion-height': ['get', 'height'] }})
//
// 7. HEATMAP - Density visualization
//    map.addLayer({ id: 'heat', type: 'heatmap', source: 'points',
//      paint: { 'heatmap-radius': 20 }})
//
// 8. RASTER - Image tiles (satellite, terrain)
//    map.addLayer({ id: 'satellite', type: 'raster', source: 'satellite' })
//
// LAYER ORDER:
// Layers are drawn in order. Later layers appear on top.
// Use beforeId to insert layers at specific positions:
//    map.addLayer(myLayer, 'existing-layer-id')
//
// GETTING ALL LAYERS:
const layers = map.getStyle().layers;
console.log('Total layers:', layers.length);

// Group by type:
const byType = layers.reduce((acc, layer) => {
  acc[layer.type] = (acc[layer.type] || 0) + 1;
  return acc;
}, {});
console.log('Layers by type:', byType);

// Toggle layer visibility:
map.setLayoutProperty('layer-id', 'visibility', 'none'); // hide
map.setLayoutProperty('layer-id', 'visibility', 'visible'); // show

// Check if layer exists:
if (map.getLayer('my-layer')) {
  // layer exists
}`,
};

function createLayerPanel(map: Map) {
  if (layerPanel) return;

  const layers = map.getStyle()?.layers || [];
  const byType = layers.reduce(
    (acc, layer) => {
      acc[layer.type] = (acc[layer.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  layerPanel = document.createElement("div");
  layerPanel.className = "panel";
  layerPanel.style.cssText = `
    position: absolute;
    top: 100px;
    right: 16px;
    z-index: 10;
    padding: 16px;
    max-width: 260px;
    font-size: 13px;
  `;

  layerPanel.innerHTML = `
    <h4 style="margin: 0 0 12px; font-size: 14px; color: var(--text-primary);">
      Layer Statistics
    </h4>
    <div style="color: var(--text-secondary); line-height: 1.6;">
      <div><strong>Total Layers:</strong> ${layers.length}</div>
      <div style="margin-top: 8px; font-weight: 600;">By Type:</div>
      ${Object.entries(byType)
        .sort((a, b) => b[1] - a[1])
        .map(
          ([type, count]) => `
        <div style="display: flex; justify-content: space-between; padding: 2px 0;">
          <span>${type}</span>
          <span style="color: var(--text-primary);">${count}</span>
        </div>
      `,
        )
        .join("")}
    </div>
    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--panel-border); font-size: 11px; color: var(--text-secondary);">
      Use controls to toggle layer groups. Check Code Viewer for layer concepts.
    </div>
  `;

  document.body.appendChild(layerPanel);
}

function applyLayerVisibility(map: Map, controls: Record<string, unknown>) {
  const layers = map.getStyle()?.layers || [];

  layers.forEach((layer) => {
    const id = layer.id.toLowerCase();
    let visible = true;

    if (!controls.showLabels && layer.type === "symbol") {
      visible = false;
    }
    if (
      !controls.showRoads &&
      (id.includes("road") || id.includes("street") || id.includes("path"))
    ) {
      visible = false;
    }
    if (
      !controls.showLanduse &&
      (id.includes("land") || id.includes("park") || id.includes("building"))
    ) {
      visible = false;
    }
    if (
      !controls.showWater &&
      (id.includes("water") || id.includes("river") || id.includes("lake"))
    ) {
      visible = false;
    }

    try {
      map.setLayoutProperty(
        layer.id,
        "visibility",
        visible ? "visible" : "none",
      );
    } catch {
      // Some layers don't support visibility
    }
  });
}
