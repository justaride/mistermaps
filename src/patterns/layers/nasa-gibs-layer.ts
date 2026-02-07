import type { Map } from "mapbox-gl";

export type NasaGibsProduct =
  | "MODIS_Terra_CorrectedReflectance_TrueColor"
  | "MODIS_Aqua_CorrectedReflectance_TrueColor";

type ProductConfig = {
  id: NasaGibsProduct;
  matrixSet: string;
  format: "jpg" | "jpeg" | "png";
  maxZoom: number;
};

const GIBS_BASE_URL = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";

const PRODUCTS: Record<NasaGibsProduct, ProductConfig> = {
  MODIS_Terra_CorrectedReflectance_TrueColor: {
    id: "MODIS_Terra_CorrectedReflectance_TrueColor",
    matrixSet: "GoogleMapsCompatible_Level9",
    format: "jpg",
    maxZoom: 9,
  },
  MODIS_Aqua_CorrectedReflectance_TrueColor: {
    id: "MODIS_Aqua_CorrectedReflectance_TrueColor",
    matrixSet: "GoogleMapsCompatible_Level9",
    format: "jpg",
    maxZoom: 9,
  },
};

export type NasaGibsLayerOptions = {
  sourceId: string;
  layerId: string;
  product: NasaGibsProduct;
  date: string;
  opacity?: number;
  beforeId?: string;
};

export function addNasaGibsRasterLayer(map: Map, options: NasaGibsLayerOptions) {
  const config = PRODUCTS[options.product];
  const tileUrl = buildNasaGibsTileUrl({
    product: config.id,
    date: options.date,
    matrixSet: config.matrixSet,
    format: config.format,
  });

  removeNasaGibsRasterLayer(map, options.sourceId, options.layerId);

  map.addSource(options.sourceId, {
    type: "raster",
    tiles: [tileUrl],
    tileSize: 256,
    maxzoom: config.maxZoom,
    attribution: "NASA GIBS",
  });

  map.addLayer(
    {
      id: options.layerId,
      type: "raster",
      source: options.sourceId,
      paint: {
        "raster-opacity": clamp(options.opacity, 0, 1, 1),
      },
    },
    options.beforeId,
  );
}

export function removeNasaGibsRasterLayer(
  map: Map,
  sourceId: string,
  layerId: string,
) {
  if (map.getLayer(layerId)) {
    map.removeLayer(layerId);
  }
  if (map.getSource(sourceId)) {
    map.removeSource(sourceId);
  }
}

export function buildNasaGibsTileUrl(options: {
  product: NasaGibsProduct;
  date: string;
  matrixSet: string;
  format: "jpg" | "jpeg" | "png";
}) {
  return `${GIBS_BASE_URL}/${options.product}/default/${options.date}/${options.matrixSet}/{z}/{y}/{x}.${options.format}`;
}

export function getUtcDateDaysAgo(daysAgo: number) {
  const now = new Date();
  const utcDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  utcDate.setUTCDate(utcDate.getUTCDate() - Math.max(0, daysAgo));
  return utcDate.toISOString().slice(0, 10);
}

export function findFirstSymbolLayer(map: Map): string | undefined {
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

export function clamp(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}
