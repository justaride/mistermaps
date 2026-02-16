import type { Map } from "mapbox-gl";
import type { ControlValues, Pattern } from "../../types";

type DebugFlag =
  | "showTileBoundaries"
  | "showCollisionBoxes"
  | "showPadding"
  | "showOverdrawInspector"
  | "showTerrainWireframe";

type DebuggableMap = Map & Partial<Record<DebugFlag, boolean>>;

let panel: HTMLDivElement | null = null;

export const vectorDebugToolsPattern: Pattern = {
  id: "vector-debug-tools",
  name: "Vector Debug Tools",
  category: "layers",
  description:
    "Developer overlays for vector tiles: tile boundaries, label collision boxes, padding, and overdraw.",
  controls: [
    {
      id: "showTileBoundaries",
      label: "Tile Boundaries",
      type: "toggle",
      defaultValue: true,
    },
    {
      id: "showCollisionBoxes",
      label: "Collision Boxes",
      type: "toggle",
      defaultValue: false,
    },
    {
      id: "showOverdrawInspector",
      label: "Overdraw",
      type: "toggle",
      defaultValue: false,
    },
    {
      id: "showPadding",
      label: "Padding (Debug)",
      type: "toggle",
      defaultValue: false,
    },
    {
      id: "showTerrainWireframe",
      label: "Terrain Wireframe",
      type: "toggle",
      defaultValue: false,
    },
    {
      id: "showPanel",
      label: "Show Info Panel",
      type: "toggle",
      defaultValue: true,
    },
  ],

  setup(map: Map, controls: ControlValues) {
    map.easeTo({
      center: [10.7522, 59.9139], // Oslo
      zoom: 12.5,
      duration: 900,
    });

    createPanel();
    setPanelVisibility(controls.showPanel as boolean);
    updatePanel(map);

    applyDebugFlags(map, controls);
  },

  cleanup(map: Map) {
    clearDebugFlags(map);

    if (panel?.parentNode) {
      panel.parentNode.removeChild(panel);
      panel = null;
    }
  },

  update(map: Map, controls: ControlValues) {
    setPanelVisibility(controls.showPanel as boolean);
    updatePanel(map);
    applyDebugFlags(map, controls);
  },

  snippet: `// Vector Debug Tools
// These are Mapbox GL debug overlays (useful for style dev & performance):

map.showTileBoundaries = true;       // draw tile borders
map.showCollisionBoxes = true;       // label placement + collisions
map.showOverdrawInspector = true;    // highlights overdraw (GPU work)
map.showPadding = true;             // padding debug (if used)
map.showTerrainWireframe = true;    // terrain mesh wireframe (if terrain is enabled)`,
};

function applyDebugFlags(map: Map, controls: ControlValues) {
  const debugMap = map as DebuggableMap;
  debugMap.showTileBoundaries = Boolean(controls.showTileBoundaries);
  debugMap.showCollisionBoxes = Boolean(controls.showCollisionBoxes);
  debugMap.showOverdrawInspector = Boolean(controls.showOverdrawInspector);
  debugMap.showPadding = Boolean(controls.showPadding);
  debugMap.showTerrainWireframe = Boolean(controls.showTerrainWireframe);
}

function clearDebugFlags(map: Map) {
  const debugMap = map as DebuggableMap;
  debugMap.showTileBoundaries = false;
  debugMap.showCollisionBoxes = false;
  debugMap.showOverdrawInspector = false;
  debugMap.showPadding = false;
  debugMap.showTerrainWireframe = false;
}

function createPanel() {
  if (panel) return;

  panel = document.createElement("div");
  panel.className = "panel";
  panel.id = "vector-debug-tools-panel";
  panel.style.cssText = `
    position: absolute;
    top: 100px;
    right: 16px;
    z-index: 10;
    padding: 16px;
    max-width: 320px;
    font-size: 12px;
  `;

  panel.innerHTML = `
    <h4 style="margin: 0 0 10px; font-size: 14px;">Vector Debug Tools</h4>
    <div style="color: var(--text-secondary); line-height: 1.5; margin-bottom: 12px;">
      Use the toggles to reveal how vector tiles are drawn and where performance can go.
    </div>

    <div style="display: grid; gap: 10px;">
      <div>
        <div style="font-weight: 600; margin-bottom: 2px;">View</div>
        <div id="vector-debug-tools-view" style="color: var(--text-secondary);">—</div>
      </div>
      <div>
        <div style="font-weight: 600; margin-bottom: 2px;">Tip</div>
        <div style="color: var(--text-secondary);">
          Collision boxes are most useful on label-heavy zoom levels (12–16). Overdraw can spike on dense 3D + shadows.
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(panel);
}

function setPanelVisibility(visible: boolean) {
  if (!panel) return;
  panel.style.display = visible ? "block" : "none";
}

function updatePanel(map: Map) {
  if (!panel) return;

  const el = document.getElementById("vector-debug-tools-view");
  if (!el) return;

  const c = map.getCenter();
  el.textContent = `zoom ${map.getZoom().toFixed(2)} · ${c.lng.toFixed(4)}, ${c.lat.toFixed(4)}`;
}

