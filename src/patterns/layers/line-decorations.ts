import type { ExpressionSpecification, Map } from "mapbox-gl";
import type { ControlValues, Pattern } from "../../types";

const SOURCE_ID = "mm-line-decorations-source";
const LINE_LAYER_ID = "mm-line-decorations-line";
const ARROWS_LAYER_ID = "mm-line-decorations-arrows";

type Mode = "dashed" | "gradient" | "arrows";

// Curvy-ish sample line around Oslo.
const ROUTE: [number, number][] = [
  [10.676, 59.903],
  [10.688, 59.907],
  [10.702, 59.912],
  [10.716, 59.916],
  [10.731, 59.92],
  [10.748, 59.923],
  [10.763, 59.925],
  [10.776, 59.927],
  [10.79, 59.932],
  [10.804, 59.938],
  [10.812, 59.944],
  [10.817, 59.949],
  [10.815, 59.954],
  [10.807, 59.958],
  [10.796, 59.96],
  [10.783, 59.958],
  [10.769, 59.954],
  [10.756, 59.949],
  [10.741, 59.944],
  [10.726, 59.94],
  [10.712, 59.935],
  [10.698, 59.928],
  [10.686, 59.918],
  [10.676, 59.903],
];

export const lineDecorationsPattern: Pattern = {
  id: "line-decorations",
  name: "Line Decorations",
  category: "layers",
  description: "Dashes, gradients, and directional arrows for route/path lines.",
  controls: [
    {
      id: "styleMode",
      label: "Mode",
      type: "select",
      defaultValue: "gradient",
      options: [
        { label: "Gradient", value: "gradient" },
        { label: "Dashed", value: "dashed" },
        { label: "Directional arrows", value: "arrows" },
      ],
    },
    {
      id: "lineWidth",
      label: "Line width",
      type: "slider",
      defaultValue: 6,
      min: 1,
      max: 16,
      step: 1,
    },
    {
      id: "colorA",
      label: "Color A",
      type: "color",
      defaultValue: "#5b8fa8",
    },
    {
      id: "colorB",
      label: "Color B (gradient)",
      type: "color",
      defaultValue: "#c85a2a",
    },
    {
      id: "dashOn",
      label: "Dash on",
      type: "slider",
      defaultValue: 2,
      min: 1,
      max: 6,
      step: 0.5,
    },
    {
      id: "dashOff",
      label: "Dash off",
      type: "slider",
      defaultValue: 2,
      min: 1,
      max: 6,
      step: 0.5,
    },
    {
      id: "arrowEnabled",
      label: "Arrows enabled",
      type: "toggle",
      defaultValue: true,
    },
    {
      id: "arrowSize",
      label: "Arrow size",
      type: "slider",
      defaultValue: 14,
      min: 10,
      max: 24,
      step: 1,
    },
    {
      id: "arrowSpacing",
      label: "Arrow spacing",
      type: "slider",
      defaultValue: 90,
      min: 40,
      max: 200,
      step: 10,
    },
    {
      id: "arrowColor",
      label: "Arrow color",
      type: "color",
      defaultValue: "#2c2c2c",
    },
    {
      id: "arrowHaloWidth",
      label: "Arrow halo width",
      type: "slider",
      defaultValue: 1.5,
      min: 0,
      max: 4,
      step: 0.5,
    },
    {
      id: "arrowHaloColor",
      label: "Arrow halo color",
      type: "color",
      defaultValue: "#f7f5f0",
    },
  ],

  setup(map: Map, controls: ControlValues) {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      lineMetrics: true,
      data: {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: ROUTE },
      },
    });

    map.addLayer({
      id: LINE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-width": clampNumber(controls.lineWidth, 1, 16, 6),
        "line-color": (controls.colorA as string) ?? "#5b8fa8",
        "line-opacity": 0.95,
        "line-dasharray": [1, 0],
      },
    });

    // Directional arrows using text along the line; avoids sprite/icon deps.
    map.addLayer({
      id: ARROWS_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      layout: {
        visibility: "none",
        "symbol-placement": "line",
        "symbol-spacing": clampNumber(controls.arrowSpacing, 40, 200, 90),
        "text-field": ">",
        "text-size": clampNumber(controls.arrowSize, 10, 24, 14),
        "text-allow-overlap": true,
        "text-keep-upright": false,
      },
      paint: {
        "text-color": (controls.arrowColor as string) ?? "#2c2c2c",
        "text-halo-color": (controls.arrowHaloColor as string) ?? "#f7f5f0",
        "text-halo-width": clampNumber(controls.arrowHaloWidth, 0, 4, 1.5),
      },
    });

    map.fitBounds(getBounds(ROUTE), { padding: 60 });

    applyMode(map, controls);
  },

  cleanup(map: Map) {
    if (map.getLayer(ARROWS_LAYER_ID)) map.removeLayer(ARROWS_LAYER_ID);
    if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  },

  update(map: Map, controls: ControlValues) {
    if (!map.getLayer(LINE_LAYER_ID)) return;

    map.setPaintProperty(
      LINE_LAYER_ID,
      "line-width",
      clampNumber(controls.lineWidth, 1, 16, 6),
    );

    applyMode(map, controls);

    if (map.getLayer(ARROWS_LAYER_ID)) {
      map.setLayoutProperty(
        ARROWS_LAYER_ID,
        "symbol-spacing",
        clampNumber(controls.arrowSpacing, 40, 200, 90),
      );
      map.setLayoutProperty(
        ARROWS_LAYER_ID,
        "text-size",
        clampNumber(controls.arrowSize, 10, 24, 14),
      );
      map.setPaintProperty(
        ARROWS_LAYER_ID,
        "text-color",
        (controls.arrowColor as string) ?? "#2c2c2c",
      );
      map.setPaintProperty(
        ARROWS_LAYER_ID,
        "text-halo-color",
        (controls.arrowHaloColor as string) ?? "#f7f5f0",
      );
      map.setPaintProperty(
        ARROWS_LAYER_ID,
        "text-halo-width",
        clampNumber(controls.arrowHaloWidth, 0, 4, 1.5),
      );
    }
  },

  snippet: `// Line decorations: dashed, gradient, arrows
// 1) Dashed: line-dasharray
// 2) Gradient: lineMetrics + line-progress + line-gradient
// 3) Arrows: symbol-placement: line, with a text glyph ('>')

map.addSource('route', {
  type: 'geojson',
  lineMetrics: true, // required for ['line-progress']
  data: routeLineGeoJson
});

// Base line layer
map.addLayer({
  id: 'route-line',
  type: 'line',
  source: 'route',
  paint: {
    'line-width': 6,
    'line-color': '#5b8fa8',
    // dashed mode
    'line-dasharray': [2, 2]
  }
});

// gradient mode (replaces line-color visually)
map.setPaintProperty('route-line', 'line-gradient', [
  'interpolate', ['linear'], ['line-progress'],
  0, '#5b8fa8',
  1, '#c85a2a'
]);

// arrows mode (no sprite icons needed)
map.addLayer({
  id: 'route-arrows',
  type: 'symbol',
  source: 'route',
  layout: {
    'symbol-placement': 'line',
    'symbol-spacing': 90,
    'text-field': '>',
    'text-size': 14,
    'text-keep-upright': false
  }
});`,
};

function applyMode(map: Map, controls: ControlValues) {
  const mode = toMode(controls.styleMode);
  const colorA = (controls.colorA as string) ?? "#5b8fa8";
  const colorB = (controls.colorB as string) ?? "#c85a2a";

  // Default: solid line, no arrows.
  map.setPaintProperty(LINE_LAYER_ID, "line-color", colorA);
  map.setPaintProperty(LINE_LAYER_ID, "line-dasharray", [1, 0]);
  // Clear any previous gradient. Mapbox accepts null here, but typings don't.
  map.setPaintProperty(LINE_LAYER_ID, "line-gradient", undefined as never);

  const arrowsVisible = mode === "arrows" && Boolean(controls.arrowEnabled);
  if (map.getLayer(ARROWS_LAYER_ID)) {
    map.setLayoutProperty(
      ARROWS_LAYER_ID,
      "visibility",
      arrowsVisible ? "visible" : "none",
    );
  }

  if (mode === "dashed") {
    const on = clampNumber(controls.dashOn, 1, 6, 2);
    const off = clampNumber(controls.dashOff, 1, 6, 2);
    map.setPaintProperty(LINE_LAYER_ID, "line-dasharray", [on, off]);
    return;
  }

  if (mode === "gradient") {
    map.setPaintProperty(
      LINE_LAYER_ID,
      "line-gradient",
      buildGradient(colorA, colorB),
    );
  }
}

function buildGradient(a: string, b: string): ExpressionSpecification {
  return ["interpolate", ["linear"], ["line-progress"], 0, a, 1, b];
}

function toMode(value: unknown): Mode {
  return value === "dashed" || value === "arrows" ? value : "gradient";
}

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function getBounds(coords: [number, number][]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [x, y] of coords) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return [
    [minX, minY],
    [maxX, maxY],
  ] as [[number, number], [number, number]];
}
