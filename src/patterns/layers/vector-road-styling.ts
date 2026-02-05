import type {
  ExpressionSpecification,
  FilterSpecification,
  Map,
} from "mapbox-gl";
import type { Pattern } from "../../types";

const SOURCE_ID = "composite";
const SOURCE_LAYER = "road";

const CASING_LAYER_ID = "vector-road-styling-casing";
const ROADS_LAYER_ID = "vector-road-styling-roads";

let panel: HTMLDivElement | null = null;

export const vectorRoadStylingPattern: Pattern = {
  id: "vector-road-styling",
  name: "Vector Road Styling",
  category: "layers",
  description:
    "Restyle vector-tile roads with match + interpolate expressions on the base style’s composite source.",
  controls: [
    {
      id: "colorMode",
      label: "Color Mode",
      type: "select",
      defaultValue: "class",
      options: [
        { label: "By Class", value: "class" },
        { label: "Single Color", value: "single" },
      ],
    },
    {
      id: "roadColor",
      label: "Road Color",
      type: "color",
      defaultValue: "#c85a2a",
    },
    {
      id: "opacity",
      label: "Opacity",
      type: "slider",
      defaultValue: 0.85,
      min: 0,
      max: 1,
      step: 0.05,
    },
    {
      id: "widthMultiplier",
      label: "Width Multiplier",
      type: "slider",
      defaultValue: 1.15,
      min: 0.5,
      max: 2.5,
      step: 0.05,
    },
    {
      id: "showMajor",
      label: "Major Roads",
      type: "toggle",
      defaultValue: true,
    },
    {
      id: "showMinor",
      label: "Minor Streets",
      type: "toggle",
      defaultValue: false,
    },
    {
      id: "showPaths",
      label: "Paths/Tracks",
      type: "toggle",
      defaultValue: false,
    },
    {
      id: "showCasing",
      label: "Show Casing",
      type: "toggle",
      defaultValue: true,
    },
    {
      id: "casingColor",
      label: "Casing Color",
      type: "color",
      defaultValue: "#3d3530",
    },
    {
      id: "casingOpacity",
      label: "Casing Opacity",
      type: "slider",
      defaultValue: 0.9,
      min: 0,
      max: 1,
      step: 0.05,
    },
    {
      id: "showPanel",
      label: "Show Info Panel",
      type: "toggle",
      defaultValue: true,
    },
  ],

  setup(map: Map, controls: Record<string, unknown>) {
    map.easeTo({
      center: [10.7522, 59.9139], // Oslo
      zoom: 12.8,
      pitch: 0,
      bearing: 0,
      duration: 900,
    });

    createPanel();
    setPanelVisibility(controls.showPanel as boolean);

    if (!map.getSource(SOURCE_ID)) {
      updatePanelMessage(
        "No 'composite' source found in this style. Try a Mapbox base style (light/dark).",
      );
      return;
    }

    const beforeId = findFirstSymbolLayer(map);

    map.addLayer(
      {
        id: CASING_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        "source-layer": SOURCE_LAYER,
        filter: getRoadFilter(controls),
        layout: {
          visibility: controls.showCasing ? "visible" : "none",
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": controls.casingColor as string,
          "line-width": getCasingWidthExpr(controls),
          "line-opacity": clamp01(controls.casingOpacity as number, 0.9),
        },
      },
      beforeId,
    );

    map.addLayer(
      {
        id: ROADS_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        "source-layer": SOURCE_LAYER,
        filter: getRoadFilter(controls),
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": getRoadColorExpr(controls),
          "line-width": getRoadWidthExpr(controls),
          "line-opacity": clamp01(controls.opacity as number, 0.85),
        },
      },
      beforeId,
    );

    updatePanelMessage(getPanelSummary(controls));
  },

  cleanup(map: Map) {
    if (panel?.parentNode) {
      panel.parentNode.removeChild(panel);
      panel = null;
    }

    if (map.getLayer(ROADS_LAYER_ID)) map.removeLayer(ROADS_LAYER_ID);
    if (map.getLayer(CASING_LAYER_ID)) map.removeLayer(CASING_LAYER_ID);
  },

  update(map: Map, controls: Record<string, unknown>) {
    setPanelVisibility(controls.showPanel as boolean);
    updatePanelMessage(getPanelSummary(controls));

    if (!map.getLayer(ROADS_LAYER_ID)) return;

    map.setFilter(ROADS_LAYER_ID, getRoadFilter(controls));
    map.setPaintProperty(ROADS_LAYER_ID, "line-color", getRoadColorExpr(controls));
    map.setPaintProperty(ROADS_LAYER_ID, "line-width", getRoadWidthExpr(controls));
    map.setPaintProperty(ROADS_LAYER_ID, "line-opacity", clamp01(controls.opacity as number, 0.85));

    if (map.getLayer(CASING_LAYER_ID)) {
      map.setFilter(CASING_LAYER_ID, getRoadFilter(controls));
      map.setLayoutProperty(
        CASING_LAYER_ID,
        "visibility",
        controls.showCasing ? "visible" : "none",
      );
      map.setPaintProperty(
        CASING_LAYER_ID,
        "line-color",
        controls.casingColor as string,
      );
      map.setPaintProperty(
        CASING_LAYER_ID,
        "line-width",
        getCasingWidthExpr(controls),
      );
      map.setPaintProperty(
        CASING_LAYER_ID,
        "line-opacity",
        clamp01(controls.casingOpacity as number, 0.9),
      );
    }
  },

  snippet: `// Vector Road Styling
// Restyle the base map’s vector-tile roads:
// source='composite', source-layer='road'

const beforeId = map.getStyle().layers?.find(l => l.type === 'symbol')?.id;

map.addLayer({
  id: 'roads-demo',
  type: 'line',
  source: 'composite',
  'source-layer': 'road',
  filter: ['in', 'class', 'motorway', 'primary', 'secondary', 'street'],
  paint: {
    'line-color': [
      'match', ['get', 'class'],
      'motorway', '#d4a847',
      'primary',  '#c85a2a',
      'secondary','#6b8f71',
      '#3d3530'
    ],
    'line-width': [
      'interpolate', ['linear'], ['zoom'],
      10, 0.5,
      14, 3,
      18, 12
    ],
    'line-opacity': 0.9
  }
}, beforeId);`,
};

function createPanel() {
  if (panel) return;

  panel = document.createElement("div");
  panel.className = "panel";
  panel.id = "vector-road-styling-panel";
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
    <h4 style="margin: 0 0 10px; font-size: 14px;">Vector Road Styling</h4>
    <div id="vector-road-styling-message" style="color: var(--text-secondary); line-height: 1.5;">
      —
    </div>
    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--panel-border); color: var(--text-secondary);">
      Source: <code style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">composite</code><br/>
      Layer: <code style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">road</code>
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
  const el = document.getElementById("vector-road-styling-message");
  if (!el) return;
  el.textContent = message;
}

function getPanelSummary(controls: Record<string, unknown>): string {
  const major = Boolean(controls.showMajor);
  const minor = Boolean(controls.showMinor);
  const paths = Boolean(controls.showPaths);

  const buckets: string[] = [];
  if (major) buckets.push("major roads");
  if (minor) buckets.push("minor streets");
  if (paths) buckets.push("paths");

  const mode = controls.colorMode === "single" ? "single color" : "by class";
  const shown = buckets.length > 0 ? buckets.join(" + ") : "nothing (enable a toggle)";
  return `Mode: ${mode}. Showing: ${shown}.`;
}

function clamp01(value: number, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

function clamp(value: number, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function getRoadFilter(controls: Record<string, unknown>): FilterSpecification {
  const classes: string[] = [];

  if (controls.showMajor) {
    classes.push(
      "motorway",
      "motorway_link",
      "trunk",
      "trunk_link",
      "primary",
      "primary_link",
      "secondary",
      "secondary_link",
      "tertiary",
      "tertiary_link",
    );
  }

  if (controls.showMinor) {
    classes.push("street", "street_limited", "service", "road");
  }

  if (controls.showPaths) {
    classes.push("path", "pedestrian", "track", "cycleway");
  }

  if (classes.length === 0) {
    return ["==", "class", "__none__"];
  }

  return ["in", "class", ...classes] as unknown as FilterSpecification;
}

function getRoadColorExpr(controls: Record<string, unknown>): ExpressionSpecification {
  if (controls.colorMode === "single") {
    return ["literal", controls.roadColor as string] as ExpressionSpecification;
  }

  return [
    "match",
    ["get", "class"],
    "motorway",
    "#d4a847",
    "motorway_link",
    "#d4a847",
    "trunk",
    "#d4a847",
    "trunk_link",
    "#d4a847",
    "primary",
    "#c85a2a",
    "primary_link",
    "#c85a2a",
    "secondary",
    "#6b8f71",
    "secondary_link",
    "#6b8f71",
    "tertiary",
    "#5b8fa8",
    "tertiary_link",
    "#5b8fa8",
    "street",
    "#3d3530",
    "street_limited",
    "#3d3530",
    "service",
    "#3d3530",
    "road",
    "#3d3530",
    "path",
    "#a08f7d",
    "pedestrian",
    "#a08f7d",
    "track",
    "#a08f7d",
    "cycleway",
    "#a08f7d",
    "#3d3530",
  ] as ExpressionSpecification;
}

function getRoadWidthExpr(controls: Record<string, unknown>): ExpressionSpecification {
  const mul = clamp(controls.widthMultiplier as number, 0.5, 2.5, 1.15);
  return [
    "*",
    mul,
    [
      "match",
      ["get", "class"],
      "motorway",
      1.5,
      "motorway_link",
      1.25,
      "trunk",
      1.4,
      "trunk_link",
      1.2,
      "primary",
      1.15,
      "primary_link",
      1.05,
      "secondary",
      1,
      "secondary_link",
      0.95,
      "tertiary",
      0.9,
      "tertiary_link",
      0.85,
      "street",
      0.75,
      "street_limited",
      0.7,
      "service",
      0.6,
      "road",
      0.7,
      "path",
      0.45,
      "pedestrian",
      0.5,
      "track",
      0.5,
      "cycleway",
      0.5,
      0.7,
    ],
    [
      "interpolate",
      ["linear"],
      ["zoom"],
      10,
      0.5,
      12,
      1.2,
      14,
      3.0,
      16,
      6.0,
      18,
      12.0,
    ],
  ] as ExpressionSpecification;
}

function getCasingWidthExpr(controls: Record<string, unknown>): ExpressionSpecification {
  return ["+", getRoadWidthExpr(controls), 2] as ExpressionSpecification;
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
