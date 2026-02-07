import type { Map } from "mapbox-gl";
import type { Pattern } from "../../types";
import {
  addNasaGibsRasterLayer,
  clamp,
  findFirstSymbolLayer,
  getUtcDateDaysAgo,
  type NasaGibsProduct,
  removeNasaGibsRasterLayer,
} from "./nasa-gibs-layer";

const SOURCE_ID = "nasa-gibs-source";
const LAYER_ID = "nasa-gibs-layer";

let appliedProduct: NasaGibsProduct | null = null;
let appliedDaysBack: number | null = null;

export const nasaGibsTrueColorPattern: Pattern = {
  id: "nasa-gibs-true-color",
  name: "NASA GIBS True Color",
  category: "layers",
  description:
    "Overlay daily NASA GIBS MODIS true-color imagery with adjustable opacity and day offset.",
  controls: [
    {
      id: "product",
      label: "Sensor",
      type: "select",
      defaultValue: "terra",
      options: [
        { label: "MODIS Terra", value: "terra" },
        { label: "MODIS Aqua", value: "aqua" },
      ],
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
      id: "daysBack",
      label: "Days Back (UTC)",
      type: "slider",
      defaultValue: 1,
      min: 0,
      max: 7,
      step: 1,
    },
  ],

  setup(map: Map, controls: Record<string, unknown>) {
    map.easeTo({
      center: [11.0, 61.83],
      zoom: 4,
      pitch: 0,
      bearing: 0,
      duration: 900,
    });

    applyLayer(map, controls);
  },

  cleanup(map: Map) {
    removeNasaGibsRasterLayer(map, SOURCE_ID, LAYER_ID);
    appliedProduct = null;
    appliedDaysBack = null;
  },

  update(map: Map, controls: Record<string, unknown>) {
    if (!map.getLayer(LAYER_ID)) {
      applyLayer(map, controls);
      return;
    }

    const opacity = clamp(controls.opacity, 0, 1, 0.85);
    map.setPaintProperty(LAYER_ID, "raster-opacity", opacity);

    const nextProduct = toProduct(controls.product);
    const nextDaysBack = toDaysBack(controls.daysBack);

    if (nextProduct !== appliedProduct || nextDaysBack !== appliedDaysBack) {
      applyLayer(map, controls);
    }
  },

  snippet: `// NASA GIBS (Global Imagery Browse Services)
// Add MODIS true-color tiles as a raster overlay.

const product = 'MODIS_Terra_CorrectedReflectance_TrueColor';
const date = '2026-02-06'; // YYYY-MM-DD (UTC)

map.addSource('nasa-gibs', {
  type: 'raster',
  tiles: [
    \`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/\${product}/default/\${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg\`
  ],
  tileSize: 256,
  maxzoom: 9,
  attribution: 'NASA GIBS'
});

map.addLayer({
  id: 'nasa-gibs-layer',
  type: 'raster',
  source: 'nasa-gibs',
  paint: {
    'raster-opacity': 0.85
  }
}, map.getStyle().layers?.find(l => l.type === 'symbol')?.id);`,
};

function applyLayer(map: Map, controls: Record<string, unknown>) {
  const product = toProduct(controls.product);
  const daysBack = toDaysBack(controls.daysBack);
  const date = getUtcDateDaysAgo(daysBack);
  const opacity = clamp(controls.opacity, 0, 1, 0.85);
  const beforeId = findFirstSymbolLayer(map);

  addNasaGibsRasterLayer(map, {
    sourceId: SOURCE_ID,
    layerId: LAYER_ID,
    product,
    date,
    opacity,
    beforeId,
  });

  appliedProduct = product;
  appliedDaysBack = daysBack;
}

function toProduct(value: unknown): NasaGibsProduct {
  return value === "aqua"
    ? "MODIS_Aqua_CorrectedReflectance_TrueColor"
    : "MODIS_Terra_CorrectedReflectance_TrueColor";
}

function toDaysBack(value: unknown) {
  const safe = clamp(value, 0, 7, 1);
  return Math.round(safe);
}
