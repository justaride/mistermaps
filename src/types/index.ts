import type { Map } from "mapbox-gl";

export type PatternId =
  | "heatmap"
  | "choropleth"
  | "route-display"
  | "distance-measurement"
  | "clustered-markers"
  | "custom-popups"
  | "geojson-overlay"
  | "3d-buildings";

export type PatternCategory = "data-viz" | "navigation" | "markers" | "layers";

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
  setup: (map: Map, controls: Record<string, unknown>) => void;
  cleanup: (map: Map) => void;
  update: (map: Map, controls: Record<string, unknown>) => void;
  snippet: string;
};

export type Theme = "light" | "dark";

export type AppState = {
  activePattern: PatternId;
  theme: Theme;
  controlValues: Record<string, unknown>;
  codeViewerOpen: boolean;
};
