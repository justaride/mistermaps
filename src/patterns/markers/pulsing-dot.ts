import type { Map, StyleImageInterface } from "mapbox-gl";
import type { ControlValues, Pattern } from "../../types";

const SOURCE_ID = "pulsing-dot-source";
const SYMBOL_LAYER_ID = "pulsing-dot-layer";
const LABEL_LAYER_ID = "pulsing-dot-labels";
const IMAGE_ID = "mm-pulsing-dot";

const IMAGE_SIZE = 64;

let currentControls: ControlValues = {};
let imageMap: Map | null = null;
let imageCanvas: HTMLCanvasElement | null = null;
let imageContext: CanvasRenderingContext2D | null = null;

export const pulsingDotPattern: Pattern = {
  id: "pulsing-dot",
  name: "Pulsing Dot",
  category: "markers",
  description:
    "Animated marker using a custom StyleImageInterface (canvas + map.triggerRepaint).",
  controls: [
    {
      id: "speed",
      label: "Speed (loops/sec)",
      type: "slider",
      defaultValue: 1,
      min: 0,
      max: 3,
      step: 0.05,
    },
    {
      id: "paused",
      label: "Paused",
      type: "toggle",
      defaultValue: false,
    },
    {
      id: "dotRadius",
      label: "Dot Radius",
      type: "slider",
      defaultValue: 8,
      min: 3,
      max: 12,
      step: 1,
    },
    {
      id: "iconSize",
      label: "Icon Size",
      type: "slider",
      defaultValue: 0.9,
      min: 0.4,
      max: 1.5,
      step: 0.05,
    },
    {
      id: "dotColor",
      label: "Dot Color",
      type: "color",
      defaultValue: "#0ea5e9",
    },
    {
      id: "pulseColor",
      label: "Pulse Color",
      type: "color",
      defaultValue: "#5b8fa8",
    },
    {
      id: "showLabels",
      label: "Show Labels",
      type: "toggle",
      defaultValue: false,
    },
  ],

  setup(map: Map, controls: ControlValues) {
    currentControls = controls;

    ensurePulsingImage(map);

    const points = getSamplePoints();

    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: points.map((p) => ({
          type: "Feature",
          properties: { name: p.name },
          geometry: { type: "Point", coordinates: p.coordinates },
        })),
      },
    });

    map.addLayer({
      id: SYMBOL_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      layout: {
        "icon-image": IMAGE_ID,
        "icon-size": controls.iconSize as number,
        "icon-allow-overlap": true,
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
        "text-offset": [0, 1.4],
        "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
      },
      paint: {
        "text-color": "#1f2937",
        "text-halo-color": "#ffffff",
        "text-halo-width": 2,
      },
    });

    map.fitBounds(getBounds(points.map((p) => p.coordinates)), { padding: 60 });
  },

  cleanup(map: Map) {
    if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID);
    if (map.getLayer(SYMBOL_LAYER_ID)) map.removeLayer(SYMBOL_LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);

    if (map.hasImage(IMAGE_ID)) map.removeImage(IMAGE_ID);

    currentControls = {};
    imageMap = null;
    imageCanvas = null;
    imageContext = null;
  },

  update(map: Map, controls: ControlValues) {
    if (!map.getLayer(SYMBOL_LAYER_ID)) return;

    currentControls = controls;

    map.setLayoutProperty(
      SYMBOL_LAYER_ID,
      "icon-size",
      controls.iconSize as number,
    );
    map.setLayoutProperty(
      LABEL_LAYER_ID,
      "visibility",
      controls.showLabels ? "visible" : "none",
    );

    // Ensure a repaint so paused/colors/size changes show immediately.
    map.triggerRepaint();
  },

  snippet: `// Pulsing Dot (StyleImageInterface)
const size = 64;

const pulsingDot = {
  width: size,
  height: size,
  data: new Uint8Array(size * size * 4),
  onAdd(map) {
    this.map = map;
    this.canvas = document.createElement('canvas');
    this.canvas.width = size;
    this.canvas.height = size;
    this.ctx = this.canvas.getContext('2d');
  },
  render() {
    const t = (performance.now() / 1000) % 1;
    const ctx = this.ctx;
    const r = 8;
    const outer = r + t * (r * 2.6 - r);

    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, outer, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(91, 143, 168,' + (0.45 * (1 - t)) + ')';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    ctx.fillStyle = '#0ea5e9';
    ctx.fill();

    this.data = ctx.getImageData(0, 0, size, size).data;
    this.map.triggerRepaint();
    return true;
  }
};

map.addImage('pulsing-dot', pulsingDot);
map.addSource('points', { type: 'geojson', data: pointsGeoJSON });
map.addLayer({
  id: 'points',
  type: 'symbol',
  source: 'points',
  layout: { 'icon-image': 'pulsing-dot', 'icon-allow-overlap': true }
});`,
};

function ensurePulsingImage(map: Map) {
  if (map.hasImage(IMAGE_ID)) return;

  const image: StyleImageInterface = {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    data: new Uint8Array(IMAGE_SIZE * IMAGE_SIZE * 4),
    onAdd(m) {
      imageMap = m as unknown as Map;
      imageCanvas = document.createElement("canvas");
      imageCanvas.width = IMAGE_SIZE;
      imageCanvas.height = IMAGE_SIZE;
      imageContext = imageCanvas.getContext("2d");
    },
    render() {
      if (!imageCanvas || !imageContext) return false;

      const size = IMAGE_SIZE;
      const cx = size / 2;
      const cy = size / 2;

      const speed = (currentControls.speed as number) ?? 1;
      const paused = (currentControls.paused as boolean) ?? false;
      const dotRadius = (currentControls.dotRadius as number) ?? 8;
      const dotColor = (currentControls.dotColor as string) ?? "#0ea5e9";
      const pulseColor = (currentControls.pulseColor as string) ?? "#5b8fa8";

      const t = paused || speed <= 0 ? 0 : ((performance.now() / 1000) * speed) % 1;
      const maxRadius = Math.min(cx, dotRadius * 2.6);
      const outerRadius = dotRadius + t * (maxRadius - dotRadius);

      imageContext.clearRect(0, 0, size, size);

      const pulseRgb = hexToRgb(pulseColor);
      const pulseAlpha = 0.45 * (1 - t);
      imageContext.beginPath();
      imageContext.arc(cx, cy, outerRadius, 0, Math.PI * 2);
      imageContext.fillStyle = pulseRgb
        ? `rgba(${pulseRgb.r}, ${pulseRgb.g}, ${pulseRgb.b}, ${pulseAlpha})`
        : `rgba(0, 0, 0, ${pulseAlpha})`;
      imageContext.fill();

      imageContext.beginPath();
      imageContext.arc(cx, cy, dotRadius, 0, Math.PI * 2);
      imageContext.fillStyle = dotColor;
      imageContext.fill();
      imageContext.lineWidth = 2;
      imageContext.strokeStyle = "#ffffff";
      imageContext.stroke();

      const imageData = imageContext.getImageData(0, 0, size, size);
      this.data = imageData.data;

      if (!paused && speed > 0) {
        imageMap?.triggerRepaint();
      }

      return true;
    },
  };

  map.addImage(IMAGE_ID, image, { pixelRatio: 2 });
}

type SamplePoint = {
  name: string;
  coordinates: [number, number];
};

function getSamplePoints(): SamplePoint[] {
  return [
    { name: "Bergset", coordinates: [11.0, 61.83] },
    { name: "Jutulhogget", coordinates: [10.88, 61.95] },
    { name: "Sølensjøen", coordinates: [11.15, 61.78] },
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

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.trim().replace(/^#/, "");
  const normalized =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned;
  if (normalized.length !== 6) return null;

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;

  return { r, g, b };
}

