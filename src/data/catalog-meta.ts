import type { CatalogTag, PatternCategory, Subcategory } from "../types";

export const CATEGORY_META: Record<
  PatternCategory,
  { label: string; color: string; icon: string }
> = {
  layers: { label: "Layers", color: "topo", icon: "Layers" },
  "data-viz": { label: "Data Viz", color: "accent", icon: "BarChart3" },
  markers: { label: "Markers", color: "warn", icon: "MapPin" },
  navigation: { label: "Navigation", color: "water", icon: "Navigation" },
};

export const SUBCATEGORY_LABELS: Record<Subcategory, string> = {
  basemaps: "Basemaps & Styling",
  fundamentals: "Fundamentals",
  "vector-tiles": "Vector Tiles",
  "raster-3d": "Raster & 3D",
  "data-import": "Data Import",
  routing: "Routing",
  measurement: "Measurement",
  "location-analysis": "Location & Analysis",
};

export const TAG_LABELS: Record<CatalogTag, string> = {
  interactive: "Interactive",
  "3d": "3D",
  vector: "Vector",
  raster: "Raster",
  animation: "Animation",
  geojson: "GeoJSON",
  turf: "Turf.js",
  "open-source": "Open Source",
  "api-required": "API Required",
  "no-key": "No Key",
};
