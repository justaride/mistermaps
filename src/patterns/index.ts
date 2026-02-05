import type { Pattern } from "../types";
import { heatmapPattern, choroplethPattern } from "./data-viz";
import {
  buildings3DPattern,
  featureStatePattern,
  geojsonOverlayPattern,
  layerBasicsPattern,
  layerExplorerPattern,
  layerInspectorPattern,
  rendalenDataPattern,
  terrainHillshadePattern,
  vectorDebugToolsPattern,
  vectorFeatureStatePattern,
  vectorRoadStylingPattern,
} from "./layers";
import {
  clusteredMarkersPattern,
  customPopupsPattern,
  pulsingDotPattern,
} from "./markers";
import {
  routeDisplayPattern,
  distanceMeasurementPattern,
  geolocationPattern,
  areaMeasurementPattern,
  animatedRoutePattern,
} from "./navigation";

export { rendalenDataPattern };

export const catalogPatterns: Pattern[] = [
  layerBasicsPattern,
  layerInspectorPattern,
  layerExplorerPattern,
  geojsonOverlayPattern,
  buildings3DPattern,
  featureStatePattern,
  vectorFeatureStatePattern,
  vectorRoadStylingPattern,
  vectorDebugToolsPattern,
  terrainHillshadePattern,
  heatmapPattern,
  choroplethPattern,
  clusteredMarkersPattern,
  customPopupsPattern,
  pulsingDotPattern,
  geolocationPattern,
  areaMeasurementPattern,
  animatedRoutePattern,
  routeDisplayPattern,
  distanceMeasurementPattern,
];

export const patterns: Pattern[] = [rendalenDataPattern, ...catalogPatterns];
