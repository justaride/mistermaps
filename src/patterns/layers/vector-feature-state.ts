import type {
  ExpressionSpecification,
  FilterSpecification,
  Map,
  MapLayerMouseEvent,
  MapMouseEvent,
} from "mapbox-gl";
import type { Pattern } from "../../types";

const SOURCE_ID = "composite";
const SOURCE_LAYER = "building";

const BUILDINGS_LAYER_ID = "vector-feature-state-buildings";
const OUTLINE_LAYER_ID = "vector-feature-state-outline";

let panel: HTMLDivElement | null = null;
let hoveredId: number | string | null = null;
let selectedId: number | string | null = null;
let hoveredLabel: string | null = null;
let selectedLabel: string | null = null;

let mouseMoveHandler: ((e: MapLayerMouseEvent) => void) | null = null;
let mouseLeaveHandler: (() => void) | null = null;
let layerClickHandler: ((e: MapLayerMouseEvent) => void) | null = null;
let mapClickHandler: ((e: MapMouseEvent) => void) | null = null;

export const vectorFeatureStatePattern: Pattern = {
  id: "vector-feature-state",
  name: "Vector Feature State",
  category: "layers",
  description:
    "Hover/select real vector-tile buildings using feature-state on the base style’s composite source.",
  controls: [
    {
      id: "baseColor",
      label: "Base Color",
      type: "color",
      defaultValue: "#6b8f71",
    },
    {
      id: "hoverColor",
      label: "Hover Color",
      type: "color",
      defaultValue: "#c85a2a",
    },
    {
      id: "selectedColor",
      label: "Selected Color",
      type: "color",
      defaultValue: "#d4a847",
    },
    {
      id: "opacity",
      label: "Opacity",
      type: "slider",
      defaultValue: 0.8,
      min: 0,
      max: 1,
      step: 0.05,
    },
    {
      id: "heightMultiplier",
      label: "Height Multiplier",
      type: "slider",
      defaultValue: 1.1,
      min: 0,
      max: 3,
      step: 0.1,
    },
    {
      id: "pitch",
      label: "Pitch",
      type: "slider",
      defaultValue: 60,
      min: 0,
      max: 80,
      step: 1,
    },
    {
      id: "extrudeOnly",
      label: "Extrude Only",
      type: "toggle",
      defaultValue: true,
    },
    {
      id: "showOutline",
      label: "Show Outline",
      type: "toggle",
      defaultValue: true,
    },
    {
      id: "showPanel",
      label: "Show Info Panel",
      type: "toggle",
      defaultValue: true,
    },
  ],

  setup(map: Map, controls: Record<string, unknown>) {
    resetState();

    map.easeTo({
      center: [10.7522, 59.9139], // Oslo
      zoom: 15.5,
      pitch: controls.pitch as number,
      bearing: -18,
      duration: 1000,
    });

    if (!map.getSource(SOURCE_ID)) {
      createPanel();
      setPanelVisibility(true);
      updatePanelMessage(
        "No 'composite' source found in this style. Try a Mapbox base style (light/dark).",
      );
      return;
    }

    const beforeId = findFirstSymbolLayer(map);

    map.addLayer(
      {
        id: BUILDINGS_LAYER_ID,
        type: "fill-extrusion",
        source: SOURCE_ID,
        "source-layer": SOURCE_LAYER,
        filter: getBuildingFilter(controls.extrudeOnly as boolean),
        minzoom: 14,
        paint: {
          "fill-extrusion-color": getColorExpr(controls),
          "fill-extrusion-height": getHeightExpr(controls),
          "fill-extrusion-base": getBaseExpr(controls),
          "fill-extrusion-opacity": getOpacityExpr(controls),
        },
      },
      beforeId,
    );

    map.addLayer(
      {
        id: OUTLINE_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        "source-layer": SOURCE_LAYER,
        filter: getBuildingFilter(controls.extrudeOnly as boolean),
        layout: {
          visibility: controls.showOutline ? "visible" : "none",
        },
        paint: {
          "line-color": "#3d3530",
          "line-width": getOutlineWidthExpr(),
          "line-opacity": 0.85,
        },
      },
      beforeId,
    );

    createPanel();
    setPanelVisibility(controls.showPanel as boolean);
    updatePanelMessage("Hover a building, click to select. Click empty map to clear.");
    updatePanelFields();

    mouseMoveHandler = (e) => {
      const feature = e.features?.[0];
      if (!feature || feature.id === undefined || feature.id === null) return;

      const id = feature.id as number | string;
      if (hoveredId === id) return;

      if (hoveredId !== null) {
        map.removeFeatureState(
          { source: SOURCE_ID, sourceLayer: SOURCE_LAYER, id: hoveredId },
          "hover",
        );
      }

      hoveredId = id;
      hoveredLabel = describeBuilding(feature.properties);
      map.setFeatureState(
        { source: SOURCE_ID, sourceLayer: SOURCE_LAYER, id },
        { hover: true },
      );
      map.getCanvas().style.cursor = "pointer";
      updatePanelFields();
    };
    map.on("mousemove", BUILDINGS_LAYER_ID, mouseMoveHandler);

    mouseLeaveHandler = () => {
      if (hoveredId !== null) {
        map.removeFeatureState(
          { source: SOURCE_ID, sourceLayer: SOURCE_LAYER, id: hoveredId },
          "hover",
        );
      }
      hoveredId = null;
      hoveredLabel = null;
      map.getCanvas().style.cursor = "";
      updatePanelFields();
    };
    map.on("mouseleave", BUILDINGS_LAYER_ID, mouseLeaveHandler);

    layerClickHandler = (e) => {
      const feature = e.features?.[0];
      if (!feature || feature.id === undefined || feature.id === null) return;

      const id = feature.id as number | string;
      if (selectedId === id) return;

      if (selectedId !== null) {
        map.removeFeatureState(
          { source: SOURCE_ID, sourceLayer: SOURCE_LAYER, id: selectedId },
          "selected",
        );
      }

      selectedId = id;
      selectedLabel = describeBuilding(feature.properties);
      map.setFeatureState(
        { source: SOURCE_ID, sourceLayer: SOURCE_LAYER, id },
        { selected: true },
      );
      updatePanelFields();
    };
    map.on("click", BUILDINGS_LAYER_ID, layerClickHandler);

    mapClickHandler = (e) => {
      if (!map.getLayer(BUILDINGS_LAYER_ID) || !map.getSource(SOURCE_ID)) return;

      const features = map.queryRenderedFeatures(e.point, {
        layers: [BUILDINGS_LAYER_ID],
      });
      if (features.length > 0) return;

      if (selectedId !== null) {
        map.removeFeatureState(
          { source: SOURCE_ID, sourceLayer: SOURCE_LAYER, id: selectedId },
          "selected",
        );
        selectedId = null;
        selectedLabel = null;
        updatePanelFields();
      }
    };
    map.on("click", mapClickHandler);
  },

  cleanup(map: Map) {
    if (mouseMoveHandler) {
      map.off("mousemove", BUILDINGS_LAYER_ID, mouseMoveHandler);
      mouseMoveHandler = null;
    }
    if (mouseLeaveHandler) {
      map.off("mouseleave", BUILDINGS_LAYER_ID, mouseLeaveHandler);
      mouseLeaveHandler = null;
    }
    if (layerClickHandler) {
      map.off("click", BUILDINGS_LAYER_ID, layerClickHandler);
      layerClickHandler = null;
    }
    if (mapClickHandler) {
      map.off("click", mapClickHandler);
      mapClickHandler = null;
    }

    if (hoveredId !== null) {
      try {
        map.removeFeatureState(
          { source: SOURCE_ID, sourceLayer: SOURCE_LAYER, id: hoveredId },
          "hover",
        );
      } catch {
        // ignore
      }
    }
    if (selectedId !== null) {
      try {
        map.removeFeatureState(
          { source: SOURCE_ID, sourceLayer: SOURCE_LAYER, id: selectedId },
          "selected",
        );
      } catch {
        // ignore
      }
    }

    map.getCanvas().style.cursor = "";
    resetState();

    if (panel?.parentNode) {
      panel.parentNode.removeChild(panel);
      panel = null;
    }

    if (map.getLayer(OUTLINE_LAYER_ID)) map.removeLayer(OUTLINE_LAYER_ID);
    if (map.getLayer(BUILDINGS_LAYER_ID)) map.removeLayer(BUILDINGS_LAYER_ID);

    map.easeTo({
      pitch: 0,
      bearing: 0,
      duration: 500,
    });
  },

  update(map: Map, controls: Record<string, unknown>) {
    setPanelVisibility(controls.showPanel as boolean);

    map.easeTo({
      pitch: controls.pitch as number,
      duration: 0,
    });

    if (!map.getLayer(BUILDINGS_LAYER_ID)) return;

    map.setPaintProperty(
      BUILDINGS_LAYER_ID,
      "fill-extrusion-color",
      getColorExpr(controls),
    );
    map.setPaintProperty(
      BUILDINGS_LAYER_ID,
      "fill-extrusion-opacity",
      getOpacityExpr(controls),
    );
    map.setPaintProperty(
      BUILDINGS_LAYER_ID,
      "fill-extrusion-height",
      getHeightExpr(controls),
    );
    map.setPaintProperty(
      BUILDINGS_LAYER_ID,
      "fill-extrusion-base",
      getBaseExpr(controls),
    );
    map.setFilter(
      BUILDINGS_LAYER_ID,
      getBuildingFilter(controls.extrudeOnly as boolean),
    );

    if (map.getLayer(OUTLINE_LAYER_ID)) {
      map.setLayoutProperty(
        OUTLINE_LAYER_ID,
        "visibility",
        controls.showOutline ? "visible" : "none",
      );
      map.setFilter(
        OUTLINE_LAYER_ID,
        getBuildingFilter(controls.extrudeOnly as boolean),
      );
    }
  },

  snippet: `// Vector Feature State (Buildings)
// Uses the base style’s vector tiles: source='composite', source-layer='building'
// Works best when features have a stable feature.id.

map.addLayer({
  id: 'buildings-interactive',
  type: 'fill-extrusion',
  source: 'composite',
  'source-layer': 'building',
  filter: ['==', 'extrude', 'true'],
  paint: {
    'fill-extrusion-color': [
      'case',
      ['boolean', ['feature-state', 'selected'], false], '#d4a847',
      ['boolean', ['feature-state', 'hover'], false], '#c85a2a',
      '#6b8f71'
    ],
    'fill-extrusion-height': ['*', ['coalesce', ['get', 'height'], 20], 1.1],
    'fill-extrusion-opacity': 0.85
  }
}, labelLayerId);

let hoveredId = null;
let selectedId = null;

map.on('mousemove', 'buildings-interactive', (e) => {
  const f = e.features?.[0];
  if (!f?.id) return;

  if (hoveredId !== null) {
    map.removeFeatureState({ source: 'composite', sourceLayer: 'building', id: hoveredId }, 'hover');
  }

  hoveredId = f.id;
  map.setFeatureState({ source: 'composite', sourceLayer: 'building', id: hoveredId }, { hover: true });
});

map.on('mouseleave', 'buildings-interactive', () => {
  if (hoveredId !== null) {
    map.removeFeatureState({ source: 'composite', sourceLayer: 'building', id: hoveredId }, 'hover');
  }
  hoveredId = null;
});

map.on('click', 'buildings-interactive', (e) => {
  const f = e.features?.[0];
  if (!f?.id) return;

  if (selectedId !== null) {
    map.removeFeatureState({ source: 'composite', sourceLayer: 'building', id: selectedId }, 'selected');
  }
  selectedId = f.id;
  map.setFeatureState({ source: 'composite', sourceLayer: 'building', id: selectedId }, { selected: true });
});`,
};

function resetState() {
  hoveredId = null;
  selectedId = null;
  hoveredLabel = null;
  selectedLabel = null;
}

function createPanel() {
  if (panel) return;

  panel = document.createElement("div");
  panel.className = "panel";
  panel.id = "vector-feature-state-panel";
  panel.style.cssText = `
    position: absolute;
    top: 100px;
    right: 16px;
    z-index: 10;
    padding: 16px;
    max-width: 300px;
    font-size: 12px;
  `;

  panel.innerHTML = `
    <h4 style="margin: 0 0 10px; font-size: 14px;">Vector Feature State</h4>
    <div id="vector-feature-state-message" style="color: var(--text-secondary); line-height: 1.5; margin-bottom: 12px;">
      —
    </div>

    <div style="display: grid; gap: 10px;">
      <div>
        <div style="font-weight: 600; margin-bottom: 2px;">Hover</div>
        <div id="vector-feature-state-hover" style="color: var(--text-secondary);">—</div>
      </div>
      <div>
        <div style="font-weight: 600; margin-bottom: 2px;">Selected</div>
        <div id="vector-feature-state-selected" style="color: var(--text-secondary);">—</div>
      </div>
    </div>

    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--panel-border); color: var(--text-secondary);">
      Source: <code style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">composite</code><br/>
      Layer: <code style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">building</code>
    </div>
  `;

  document.body.appendChild(panel);
}

function setPanelVisibility(visible: boolean) {
  if (!panel) return;
  panel.style.display = visible ? "block" : "none";
}

function updatePanelMessage(message: string) {
  if (!panel) return;
  const el = document.getElementById("vector-feature-state-message");
  if (!el) return;
  el.textContent = message;
}

function updatePanelFields() {
  if (!panel) return;

  const hoverEl = document.getElementById("vector-feature-state-hover");
  const selectedEl = document.getElementById("vector-feature-state-selected");

  if (hoverEl) hoverEl.textContent = hoveredId ? `${hoveredLabel} (id: ${hoveredId})` : "—";
  if (selectedEl)
    selectedEl.textContent = selectedId
      ? `${selectedLabel} (id: ${selectedId})`
      : "—";
}

function describeBuilding(properties: unknown): string {
  const p = (properties || {}) as Record<string, unknown>;

  const name =
    (typeof p.name === "string" && p.name) ||
    (typeof p.name_en === "string" && p.name_en) ||
    (typeof p.type === "string" && p.type) ||
    (typeof p.class === "string" && p.class) ||
    "Building";

  const height =
    typeof p.height === "number"
      ? p.height
      : typeof p.height === "string"
        ? Number.parseFloat(p.height)
        : Number.NaN;

  return Number.isFinite(height) ? `${name} · ${Math.round(height)} m` : name;
}

function findFirstSymbolLayer(map: Map): string | undefined {
  const layers = map.getStyle()?.layers;
  if (!layers) return undefined;

  for (const layer of layers) {
    if (
      layer.type === "symbol" &&
      "layout" in layer &&
      layer.layout &&
      "text-field" in layer.layout
    ) {
      return layer.id;
    }
  }
  return undefined;
}

function getBuildingFilter(extrudeOnly: boolean): FilterSpecification {
  return extrudeOnly
    ? ["==", "extrude", "true"]
    : ["==", "$type", "Polygon"];
}

function getColorExpr(controls: Record<string, unknown>): ExpressionSpecification {
  return [
    "case",
    ["boolean", ["feature-state", "selected"], false],
    controls.selectedColor as string,
    ["boolean", ["feature-state", "hover"], false],
    controls.hoverColor as string,
    controls.baseColor as string,
  ] as ExpressionSpecification;
}

function getOpacityExpr(controls: Record<string, unknown>): ExpressionSpecification {
  const baseOpacity = Math.min(1, Math.max(0, (controls.opacity as number) ?? 0.8));
  return [
    "*",
    baseOpacity,
    [
      "case",
      ["boolean", ["feature-state", "selected"], false],
      1,
      ["boolean", ["feature-state", "hover"], false],
      0.88,
      0.7,
    ],
  ] as ExpressionSpecification;
}

function getHeightExpr(controls: Record<string, unknown>): ExpressionSpecification {
  const mul = (controls.heightMultiplier as number) ?? 1;
  return [
    "*",
    ["coalesce", ["get", "height"], 18],
    mul,
    [
      "case",
      ["boolean", ["feature-state", "selected"], false],
      1.35,
      1,
    ],
  ] as ExpressionSpecification;
}

function getBaseExpr(controls: Record<string, unknown>): ExpressionSpecification {
  const mul = (controls.heightMultiplier as number) ?? 1;
  return [
    "*",
    ["coalesce", ["get", "min_height"], 0],
    mul,
  ] as ExpressionSpecification;
}

function getOutlineWidthExpr(): ExpressionSpecification {
  return [
    "case",
    ["boolean", ["feature-state", "selected"], false],
    2.5,
    ["boolean", ["feature-state", "hover"], false],
    2,
    1,
  ] as ExpressionSpecification;
}
