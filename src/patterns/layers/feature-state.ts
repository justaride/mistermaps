import type {
  ExpressionSpecification,
  Map,
  MapLayerMouseEvent,
  MapMouseEvent,
} from "mapbox-gl";
import type { Pattern } from "../../types";

const SOURCE_ID = "feature-state-source";
const FILL_LAYER_ID = "feature-state-fill";
const OUTLINE_LAYER_ID = "feature-state-outline";
const LABEL_LAYER_ID = "feature-state-labels";

let infoPanel: HTMLDivElement | null = null;
let hoveredId: number | string | null = null;
let hoveredName: string | null = null;
let selectedId: number | string | null = null;
let selectedName: string | null = null;

let mouseMoveHandler: ((e: MapLayerMouseEvent) => void) | null = null;
let mouseLeaveHandler: (() => void) | null = null;
let layerClickHandler: ((e: MapLayerMouseEvent) => void) | null = null;
let mapClickHandler: ((e: MapMouseEvent) => void) | null = null;

export const featureStatePattern: Pattern = {
  id: "feature-state",
  name: "Feature State",
  category: "layers",
  description:
    "Use feature-state for hover + click selection without mutating your source data.",
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
      id: "showOutline",
      label: "Show Outline",
      type: "toggle",
      defaultValue: true,
    },
    {
      id: "showLabels",
      label: "Show Labels",
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

    map.flyTo({
      center: [11.0, 61.83],
      zoom: 10.5,
      duration: 900,
    });

    const areas = createSampleAreas();
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: areas,
    });

    map.addLayer({
      id: FILL_LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      paint: {
        "fill-color": getFillColorExpr(controls),
        "fill-opacity": getFillOpacityExpr(),
      },
    });

    map.addLayer({
      id: OUTLINE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      layout: {
        visibility: controls.showOutline ? "visible" : "none",
      },
      paint: {
        "line-color": "#3d3530",
        "line-width": getOutlineWidthExpr(),
        "line-opacity": 0.85,
      },
    });

    map.addLayer({
      id: LABEL_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      layout: {
        visibility: controls.showLabels ? "visible" : "none",
        "text-field": ["get", "name"],
        "text-size": 13,
        "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
        "text-allow-overlap": false,
      },
      paint: {
        "text-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          "#1f2937",
          ["boolean", ["feature-state", "hover"], false],
          "#111827",
          "#2c2c2c",
        ],
        "text-halo-color": "#fff",
        "text-halo-width": 1.5,
      },
    });

    createInfoPanel();
    setPanelVisibility(controls.showPanel as boolean);
    updateInfoPanel();

    mouseMoveHandler = (e) => {
      const feature = e.features?.[0];
      if (!feature || feature.id === undefined || feature.id === null) return;

      const id = feature.id as number | string;
      if (hoveredId === id) return;

      if (hoveredId !== null) {
        map.setFeatureState(
          { source: SOURCE_ID, id: hoveredId },
          { hover: false },
        );
      }

      hoveredId = id;
      hoveredName = (feature.properties?.name as string | undefined) || null;
      map.setFeatureState({ source: SOURCE_ID, id }, { hover: true });
      map.getCanvas().style.cursor = "pointer";
      updateInfoPanel();
    };
    map.on("mousemove", FILL_LAYER_ID, mouseMoveHandler);

    mouseLeaveHandler = () => {
      if (hoveredId !== null) {
        map.setFeatureState(
          { source: SOURCE_ID, id: hoveredId },
          { hover: false },
        );
      }
      hoveredId = null;
      hoveredName = null;
      map.getCanvas().style.cursor = "";
      updateInfoPanel();
    };
    map.on("mouseleave", FILL_LAYER_ID, mouseLeaveHandler);

    layerClickHandler = (e) => {
      const feature = e.features?.[0];
      if (!feature || feature.id === undefined || feature.id === null) return;
      const id = feature.id as number | string;

      if (selectedId === id) return;

      if (selectedId !== null) {
        map.setFeatureState(
          { source: SOURCE_ID, id: selectedId },
          { selected: false },
        );
      }

      selectedId = id;
      selectedName = (feature.properties?.name as string | undefined) || null;
      map.setFeatureState({ source: SOURCE_ID, id }, { selected: true });
      updateInfoPanel();
    };
    map.on("click", FILL_LAYER_ID, layerClickHandler);

    mapClickHandler = (e) => {
      if (!map.getLayer(FILL_LAYER_ID) || !map.getSource(SOURCE_ID)) return;

      const features = map.queryRenderedFeatures(e.point, {
        layers: [FILL_LAYER_ID],
      });
      if (features.length > 0) return;

      if (selectedId !== null) {
        map.setFeatureState(
          { source: SOURCE_ID, id: selectedId },
          { selected: false },
        );
        selectedId = null;
        selectedName = null;
        updateInfoPanel();
      }
    };
    map.on("click", mapClickHandler);

    map.fitBounds(
      [
        [10.7, 61.65],
        [11.4, 62.0],
      ],
      { padding: 40 },
    );
  },

  cleanup(map: Map) {
    if (mouseMoveHandler) {
      map.off("mousemove", FILL_LAYER_ID, mouseMoveHandler);
      mouseMoveHandler = null;
    }
    if (mouseLeaveHandler) {
      map.off("mouseleave", FILL_LAYER_ID, mouseLeaveHandler);
      mouseLeaveHandler = null;
    }
    if (layerClickHandler) {
      map.off("click", FILL_LAYER_ID, layerClickHandler);
      layerClickHandler = null;
    }
    if (mapClickHandler) {
      map.off("click", mapClickHandler);
      mapClickHandler = null;
    }

    map.getCanvas().style.cursor = "";
    resetState();

    if (infoPanel?.parentNode) {
      infoPanel.parentNode.removeChild(infoPanel);
      infoPanel = null;
    }

    if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID);
    if (map.getLayer(OUTLINE_LAYER_ID)) map.removeLayer(OUTLINE_LAYER_ID);
    if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  },

  update(map: Map, controls: Record<string, unknown>) {
    if (!map.getLayer(FILL_LAYER_ID)) return;

    map.setPaintProperty(FILL_LAYER_ID, "fill-color", getFillColorExpr(controls));

    if (map.getLayer(OUTLINE_LAYER_ID)) {
      map.setLayoutProperty(
        OUTLINE_LAYER_ID,
        "visibility",
        controls.showOutline ? "visible" : "none",
      );
    }

    if (map.getLayer(LABEL_LAYER_ID)) {
      map.setLayoutProperty(
        LABEL_LAYER_ID,
        "visibility",
        controls.showLabels ? "visible" : "none",
      );
    }

    setPanelVisibility(controls.showPanel as boolean);
  },

  snippet: `// Feature State (Hover + Select)
// Feature state lives in the renderer (fast + ephemeral).
// It does NOT mutate your GeoJSON data.

map.addSource('areas', {
  type: 'geojson',
  data: areasGeoJSON  // features must have a stable feature.id
});

map.addLayer({
  id: 'areas-fill',
  type: 'fill',
  source: 'areas',
  paint: {
    'fill-color': [
      'case',
      ['boolean', ['feature-state', 'selected'], false], '#d4a847',
      ['boolean', ['feature-state', 'hover'], false], '#c85a2a',
      '#6b8f71'
    ]
  }
});

let hoveredId = null;
let selectedId = null;

map.on('mousemove', 'areas-fill', (e) => {
  const f = e.features?.[0];
  if (!f?.id) return;

  if (hoveredId !== null) {
    map.setFeatureState({ source: 'areas', id: hoveredId }, { hover: false });
  }
  hoveredId = f.id;
  map.setFeatureState({ source: 'areas', id: hoveredId }, { hover: true });
});

map.on('mouseleave', 'areas-fill', () => {
  if (hoveredId !== null) {
    map.setFeatureState({ source: 'areas', id: hoveredId }, { hover: false });
  }
  hoveredId = null;
});

map.on('click', 'areas-fill', (e) => {
  const f = e.features?.[0];
  if (!f?.id) return;

  if (selectedId !== null) {
    map.setFeatureState({ source: 'areas', id: selectedId }, { selected: false });
  }
  selectedId = f.id;
  map.setFeatureState({ source: 'areas', id: selectedId }, { selected: true });
});`,
};

function resetState() {
  hoveredId = null;
  hoveredName = null;
  selectedId = null;
  selectedName = null;
}

function createInfoPanel() {
  if (infoPanel) return;

  infoPanel = document.createElement("div");
  infoPanel.className = "panel";
  infoPanel.id = "feature-state-panel";
  infoPanel.style.cssText = `
    position: absolute;
    top: 100px;
    right: 16px;
    z-index: 10;
    padding: 16px;
    max-width: 280px;
    font-size: 12px;
  `;

  infoPanel.innerHTML = `
    <h4 style="margin: 0 0 10px; font-size: 14px;">Feature State</h4>
    <div style="color: var(--text-secondary); line-height: 1.5;">
      Hover a region to highlight, click to select.<br />
      Click empty map to clear selection.
    </div>

    <div style="margin-top: 12px; display: grid; gap: 10px;">
      <div>
        <div style="font-weight: 600; margin-bottom: 2px;">Hover</div>
        <div id="feature-state-hover" style="color: var(--text-secondary);">—</div>
      </div>
      <div>
        <div style="font-weight: 600; margin-bottom: 2px;">Selected</div>
        <div id="feature-state-selected" style="color: var(--text-secondary);">—</div>
      </div>
    </div>

    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--panel-border); color: var(--text-secondary);">
      Uses <code style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">setFeatureState</code>
      and style expressions like <code style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">['feature-state', 'hover']</code>.
    </div>
  `;

  document.body.appendChild(infoPanel);
}

function setPanelVisibility(visible: boolean) {
  if (!infoPanel) return;
  infoPanel.style.display = visible ? "block" : "none";
}

function updateInfoPanel() {
  if (!infoPanel) return;

  const hoverEl = document.getElementById("feature-state-hover");
  const selectedEl = document.getElementById("feature-state-selected");

  if (hoverEl) {
    const value = hoveredName
      ? `${hoveredName}${hoveredId !== null ? ` (id: ${hoveredId})` : ""}`
      : "—";
    hoverEl.textContent = value;
  }

  if (selectedEl) {
    const value = selectedName
      ? `${selectedName}${selectedId !== null ? ` (id: ${selectedId})` : ""}`
      : "—";
    selectedEl.textContent = value;
  }
}

function getFillColorExpr(
  controls: Record<string, unknown>,
): ExpressionSpecification {
  return [
    "case",
    ["boolean", ["feature-state", "selected"], false],
    controls.selectedColor as string,
    ["boolean", ["feature-state", "hover"], false],
    controls.hoverColor as string,
    controls.baseColor as string,
  ] as ExpressionSpecification;
}

function getFillOpacityExpr(): ExpressionSpecification {
  return [
    "case",
    ["boolean", ["feature-state", "selected"], false],
    0.7,
    ["boolean", ["feature-state", "hover"], false],
    0.55,
    0.35,
  ] as ExpressionSpecification;
}

function getOutlineWidthExpr(): ExpressionSpecification {
  return [
    "case",
    ["boolean", ["feature-state", "selected"], false],
    3,
    ["boolean", ["feature-state", "hover"], false],
    2,
    1,
  ] as ExpressionSpecification;
}

function createSampleAreas(): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: 1,
        properties: { name: "Bergset" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [10.95, 61.8],
              [11.1, 61.8],
              [11.1, 61.87],
              [10.95, 61.87],
              [10.95, 61.8],
            ],
          ],
        },
      },
      {
        type: "Feature",
        id: 2,
        properties: { name: "Otnes" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [11.1, 61.78],
              [11.25, 61.78],
              [11.25, 61.85],
              [11.1, 61.85],
              [11.1, 61.78],
            ],
          ],
        },
      },
      {
        type: "Feature",
        id: 3,
        properties: { name: "Sjøli" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [10.85, 61.72],
              [11.0, 61.72],
              [11.0, 61.8],
              [10.85, 61.8],
              [10.85, 61.72],
            ],
          ],
        },
      },
      {
        type: "Feature",
        id: 4,
        properties: { name: "Øvre Rendal" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [10.9, 61.87],
              [11.1, 61.87],
              [11.1, 61.95],
              [10.9, 61.95],
              [10.9, 61.87],
            ],
          ],
        },
      },
      {
        type: "Feature",
        id: 5,
        properties: { name: "Elvål" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [11.0, 61.68],
              [11.15, 61.68],
              [11.15, 61.75],
              [11.0, 61.75],
              [11.0, 61.68],
            ],
          ],
        },
      },
    ],
  };
}
