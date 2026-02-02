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

export const patterns: Pattern[] = [
  rendalenDataPattern,
  layerInspectorPattern,
  layerExplorerPattern,
  layerBasicsPattern,
  geojsonOverlayPattern,
  buildings3DPattern,
  heatmapPattern,
  choroplethPattern,
  clusteredMarkersPattern,
  customPopupsPattern,
  routeDisplayPattern,
  distanceMeasurementPattern,
];
