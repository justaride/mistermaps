import type { Pattern } from "../types";
import { heatmapPattern, choroplethPattern } from "./data-viz";
import {
  buildings3DPattern,
  geojsonOverlayPattern,
  layerBasicsPattern,
  layerExplorerPattern,
  layerInspectorPattern,
  rendalenDataPattern,
} from "./layers";
import { clusteredMarkersPattern, customPopupsPattern } from "./markers";
import { routeDisplayPattern, distanceMeasurementPattern } from "./navigation";

export { rendalenDataPattern };

export const catalogPatterns: Pattern[] = [
  layerBasicsPattern,
  layerInspectorPattern,
  layerExplorerPattern,
  geojsonOverlayPattern,
  buildings3DPattern,
  heatmapPattern,
  choroplethPattern,
  clusteredMarkersPattern,
  customPopupsPattern,
  routeDisplayPattern,
  distanceMeasurementPattern,
];

export const patterns: Pattern[] = [rendalenDataPattern, ...catalogPatterns];
