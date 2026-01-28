import type { Pattern } from "../types";
import { heatmapPattern, choroplethPattern } from "./data-viz";
import { routeDisplayPattern, distanceMeasurementPattern } from "./navigation";
import { clusteredMarkersPattern, customPopupsPattern } from "./markers";
import {
  layerBasicsPattern,
  geojsonOverlayPattern,
  buildings3DPattern,
  layerExplorerPattern,
  layerInspectorPattern,
} from "./layers";

export const patterns: Pattern[] = [
  heatmapPattern,
  choroplethPattern,
  routeDisplayPattern,
  distanceMeasurementPattern,
  clusteredMarkersPattern,
  customPopupsPattern,
  layerBasicsPattern,
  geojsonOverlayPattern,
  buildings3DPattern,
  layerExplorerPattern,
  layerInspectorPattern,
];
