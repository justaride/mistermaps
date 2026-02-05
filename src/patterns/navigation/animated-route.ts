import type { ExpressionSpecification, Map } from "mapbox-gl";
import type { Pattern } from "../../types";

const SOURCE_ID = "animated-route-source";
const BASE_LAYER_ID = "animated-route-base";
const HIGHLIGHT_LAYER_ID = "animated-route-highlight";

let currentControls: Record<string, unknown> = {};
let animationFrameId: number | null = null;
let lastTimeMs = 0;
let progress = 0;

export const animatedRoutePattern: Pattern = {
  id: "animated-route",
  name: "Animated Route",
  category: "navigation",
  description:
    "Animate a moving highlight along a line using line-gradient and line-progress.",
  controls: [
    {
      id: "speed",
      label: "Speed (loops/sec)",
      type: "slider",
      defaultValue: 0.3,
      min: 0,
      max: 1.5,
      step: 0.05,
    },
    {
      id: "paused",
      label: "Paused",
      type: "toggle",
      defaultValue: false,
    },
    {
      id: "lineWidth",
      label: "Line Width",
      type: "slider",
      defaultValue: 4,
      min: 1,
      max: 12,
      step: 1,
    },
    {
      id: "baseColor",
      label: "Base Color",
      type: "color",
      defaultValue: "#3b82f6",
    },
    {
      id: "highlightColor",
      label: "Highlight Color",
      type: "color",
      defaultValue: "#f97316",
    },
    {
      id: "highlightLength",
      label: "Highlight Length",
      type: "slider",
      defaultValue: 0.1,
      min: 0.02,
      max: 0.25,
      step: 0.01,
    },
  ],

  setup(map: Map, controls: Record<string, unknown>) {
    currentControls = controls;

    const route = createSampleRoute();

    map.addSource(SOURCE_ID, {
      type: "geojson",
      lineMetrics: true,
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: route,
        },
      },
    });

    map.addLayer({
      id: BASE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": controls.baseColor as string,
        "line-width": controls.lineWidth as number,
        "line-opacity": 0.55,
      },
    });

    map.addLayer({
      id: HIGHLIGHT_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-width": (controls.lineWidth as number) + 2,
        "line-opacity": 1,
        "line-blur": 0.8,
        "line-gradient": buildGradient(0),
      },
    });

    map.fitBounds(getBounds(route), { padding: 60 });

    startAnimation(map);
  },

  cleanup(map: Map) {
    stopAnimation();

    if (map.getLayer(HIGHLIGHT_LAYER_ID)) map.removeLayer(HIGHLIGHT_LAYER_ID);
    if (map.getLayer(BASE_LAYER_ID)) map.removeLayer(BASE_LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);

    currentControls = {};
    lastTimeMs = 0;
    progress = 0;
  },

  update(map: Map, controls: Record<string, unknown>) {
    if (!map.getLayer(BASE_LAYER_ID)) return;

    currentControls = controls;

    map.setPaintProperty(BASE_LAYER_ID, "line-color", controls.baseColor as string);
    map.setPaintProperty(BASE_LAYER_ID, "line-width", controls.lineWidth as number);
    map.setPaintProperty(
      HIGHLIGHT_LAYER_ID,
      "line-width",
      (controls.lineWidth as number) + 2,
    );

    // Apply immediately (animation loop will keep updating too).
    map.setPaintProperty(HIGHLIGHT_LAYER_ID, "line-gradient", buildGradient(progress));
  },

  snippet: `// Animated Route (line-gradient)
// Requires: GeoJSON source with lineMetrics: true
map.addSource('route', {
  type: 'geojson',
  lineMetrics: true,
  data: { type: 'Feature', geometry: { type: 'LineString', coordinates: route } }
});

map.addLayer({
  id: 'route-highlight',
  type: 'line',
  source: 'route',
  paint: {
    'line-width': 6,
    'line-gradient': [
      'interpolate', ['linear'], ['line-progress'],
      0.0, 'rgba(0,0,0,0)',
      0.45, 'rgba(0,0,0,0)',
      0.50, '#f97316',
      0.55, 'rgba(0,0,0,0)',
      1.0, 'rgba(0,0,0,0)'
    ]
  }
});`,
};

function startAnimation(map: Map) {
  stopAnimation();
  lastTimeMs = performance.now();
  progress = 0;

  const tick = (now: number) => {
    if (!map.getLayer(HIGHLIGHT_LAYER_ID)) return;

    const dtMs = Math.min(50, Math.max(0, now - lastTimeMs));
    lastTimeMs = now;

    const paused = currentControls.paused as boolean;
    const speed = (currentControls.speed as number) || 0;
    if (!paused && speed > 0) {
      progress = (progress + (dtMs / 1000) * speed) % 1;
    }

    map.setPaintProperty(HIGHLIGHT_LAYER_ID, "line-gradient", buildGradient(progress));

    animationFrameId = requestAnimationFrame(tick);
  };

  animationFrameId = requestAnimationFrame(tick);
}

function stopAnimation() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

function buildGradient(center: number): ExpressionSpecification {
  const highlight = (currentControls.highlightColor as string) || "#f97316";
  const len = Math.min(
    0.35,
    Math.max(0.01, (currentControls.highlightLength as number) || 0.1),
  );

  const left = Math.max(0, center - len);
  const right = Math.min(1, center + len);
  const transparent = "rgba(0, 0, 0, 0)";

  return [
    "interpolate",
    ["linear"],
    ["line-progress"],
    0,
    transparent,
    left,
    transparent,
    center,
    highlight,
    right,
    transparent,
    1,
    transparent,
  ] as unknown as ExpressionSpecification;
}

function createSampleRoute(): [number, number][] {
  return [
    [11.02, 61.78],
    [10.98, 61.8],
    [10.93, 61.83],
    [10.96, 61.86],
    [11.02, 61.88],
    [11.07, 61.9],
    [11.12, 61.91],
  ];
}

function getBounds(
  coords: [number, number][],
): [[number, number], [number, number]] {
  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}
