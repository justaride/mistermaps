import type { ComponentType } from "react";
import type { Map, Map as MapboxMap } from "mapbox-gl";

export type PatternId =
  | "rendalen-data"
  | "property-filtering"
  | "streaming-updates"
  | "layer-inspector"
  | "layer-explorer"
  | "layer-basics"
  | "fill-patterns"
  | "hover-tooltips"
  | "raster-overlay"
  | "image-overlay"
  | "map-compare-swipe"
  | "terrain-exaggeration"
  | "symbol-labels-icons"
  | "line-decorations"
  | "geojson-overlay"
  | "3d-buildings"
  | "feature-state"
  | "vector-feature-state"
  | "vector-road-styling"
  | "vector-debug-tools"
  | "terrain-hillshade"
  | "nasa-gibs-true-color"
  | "style-switcher"
  | "style-loader"
  | "choropleth"
  | "heatmap"
  | "geolocation"
  | "geocoding-search"
  | "reverse-geocoding"
  | "overpass-poi-overlay"
  | "route-display"
  | "distance-measurement"
  | "area-measurement"
  | "animated-route"
  | "isochrones"
  | "clustered-markers"
  | "custom-popups"
  | "pulsing-dot"
  | "export-image-print";

export type PatternCategory = "layers" | "data-viz" | "markers" | "navigation";

export type LayerSubcategory =
  | "basemaps"
  | "fundamentals"
  | "vector-tiles"
  | "raster-3d"
  | "data-import";

export type NavigationSubcategory =
  | "routing"
  | "measurement"
  | "location-analysis";

export type Subcategory = LayerSubcategory | NavigationSubcategory;

export type CatalogTag =
  | "interactive"
  | "3d"
  | "vector"
  | "raster"
  | "animation"
  | "geojson"
  | "turf"
  | "open-source"
  | "api-required"
  | "no-key";

export type ControlType =
  | "slider"
  | "toggle"
  | "select"
  | "color"
  | "text"
  | "textarea"
  | "button";

export type ControlValue = string | number | boolean;
export type ControlValues = Record<string, ControlValue>;

type ControlConfigBase<TType extends ControlType, TValue extends ControlValue> = {
  id: string;
  label: string;
  type: TType;
  defaultValue: TValue;
};

export type SliderControlConfig = ControlConfigBase<"slider", number> & {
  min: number;
  max: number;
  step: number;
};

export type ToggleControlConfig = ControlConfigBase<"toggle", boolean>;

export type SelectControlConfig = ControlConfigBase<"select", string> & {
  options: { label: string; value: string }[];
};

export type ColorControlConfig = ControlConfigBase<"color", string>;

export type TextControlConfig = ControlConfigBase<"text", string>;

export type TextareaControlConfig = ControlConfigBase<"textarea", string>;

export type ButtonControlConfig = ControlConfigBase<"button", ControlValue>;

export type ControlConfig =
  | SliderControlConfig
  | ToggleControlConfig
  | SelectControlConfig
  | ColorControlConfig
  | TextControlConfig
  | TextareaControlConfig
  | ButtonControlConfig;

export type Pattern = {
  id: PatternId;
  name: string;
  category: PatternCategory;
  description: string;
  controls: ControlConfig[];
  setup: (map: Map, controls: ControlValues) => void | Promise<void>;
  cleanup: (map: Map) => void;
  update: (map: Map, controls: ControlValues) => void;
  view?: ComponentType<PatternViewProps>;
  // Some patterns render their own in-map search UI; disable the global SearchBox to avoid duplication.
  disableGlobalSearch?: boolean;
  snippet: string;
};

export type PatternViewProps = {
  theme: Theme;
  values: ControlValues;
  onChange: (controlId: string, value: ControlValue) => void;
  onPrimaryMapReady?: (map: MapboxMap) => void;
};

export type CatalogEntry = {
  patternId: PatternId | "maplibre";
  name: string;
  description: string;
  capabilities: string[];
  category: PatternCategory;
  subcategory?: Subcategory;
  tags: CatalogTag[];
  provider: "mapbox" | "maplibre";
  workbenchCompatible?: boolean;
};

export type Theme = "light" | "dark";

export type AppState = {
  activePattern: PatternId;
  theme: Theme;
  controlValues: ControlValues;
  codeViewerOpen: boolean;
};
