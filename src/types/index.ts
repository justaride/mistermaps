import type { Map } from "mapbox-gl";

export type PatternId =
  | "rendalen-data"
  | "layer-inspector"
  | "layer-explorer"
  | "layer-basics"
  | "geojson-overlay"
  | "3d-buildings"
  | "feature-state"
  | "vector-feature-state"
  | "vector-road-styling"
  | "vector-debug-tools"
  | "terrain-hillshade"
  | "nasa-gibs-true-color"
  | "choropleth"
  | "heatmap"
  | "geolocation"
  | "route-display"
  | "distance-measurement"
  | "area-measurement"
  | "animated-route"
  | "isochrones"
  | "clustered-markers"
  | "custom-popups"
  | "pulsing-dot";

export type PatternCategory = "layers" | "data-viz" | "markers" | "navigation";

export type ControlType = "slider" | "toggle" | "select" | "color";

export type ControlConfig = {
  id: string;
  label: string;
  type: ControlType;
  defaultValue: number | boolean | string;
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: string }[];
};

export type Pattern = {
  id: PatternId;
  name: string;
  category: PatternCategory;
  description: string;
  controls: ControlConfig[];
  setup: (map: Map, controls: Record<string, unknown>) => void | Promise<void>;
  cleanup: (map: Map) => void;
  update: (map: Map, controls: Record<string, unknown>) => void;
  snippet: string;
};

export type CatalogEntry = {
  patternId: PatternId | "maplibre";
  name: string;
  description: string;
  capabilities: string[];
  category: PatternCategory | "providers";
  provider: "mapbox" | "maplibre";
};

export type Theme = "light" | "dark";

export type AppState = {
  activePattern: PatternId;
  theme: Theme;
  controlValues: Record<string, unknown>;
  codeViewerOpen: boolean;
};
