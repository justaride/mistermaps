import type { Pattern } from "../types";
import { heatmapPattern, choroplethPattern } from "./data-viz";
import {
  buildings3DPattern,
  featureStatePattern,
  geojsonOverlayPattern,
  hoverTooltipsPattern,
  imageOverlayPattern,
  layerBasicsPattern,
  layerExplorerPattern,
  layerInspectorPattern,
  lineDecorationsPattern,
  mapCompareSwipePattern,
  nasaGibsTrueColorPattern,
  rasterOverlayPattern,
  rendalenDataPattern,
  symbolLabelsIconsPattern,
  terrainExaggerationPattern,
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
  isochronesPattern,
  overpassPoiOverlayPattern,
} from "./navigation";

export { rendalenDataPattern };

export const catalogPatterns: Pattern[] = [
  layerBasicsPattern,
  layerInspectorPattern,
  layerExplorerPattern,
  hoverTooltipsPattern,
  symbolLabelsIconsPattern,
  lineDecorationsPattern,
  mapCompareSwipePattern,
  rasterOverlayPattern,
  imageOverlayPattern,
  geojsonOverlayPattern,
  buildings3DPattern,
  featureStatePattern,
  vectorFeatureStatePattern,
  vectorRoadStylingPattern,
  nasaGibsTrueColorPattern,
  vectorDebugToolsPattern,
  terrainExaggerationPattern,
  terrainHillshadePattern,
  heatmapPattern,
  choroplethPattern,
  clusteredMarkersPattern,
  customPopupsPattern,
  pulsingDotPattern,
  geolocationPattern,
  overpassPoiOverlayPattern,
  areaMeasurementPattern,
  animatedRoutePattern,
  routeDisplayPattern,
  distanceMeasurementPattern,
  isochronesPattern,
];

export const patterns: Pattern[] = [rendalenDataPattern, ...catalogPatterns];
