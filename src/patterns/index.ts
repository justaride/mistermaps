import type { Pattern } from "../types";
import { heatmapPattern, choroplethPattern } from "./data-viz";
import { routeDisplayPattern, distanceMeasurementPattern } from "./navigation";
import { clusteredMarkersPattern, customPopupsPattern } from "./markers";
import { geojsonOverlayPattern, buildings3DPattern } from "./layers";

export const patterns: Pattern[] = [
  heatmapPattern,
  choroplethPattern,
  routeDisplayPattern,
  distanceMeasurementPattern,
  clusteredMarkersPattern,
  customPopupsPattern,
  geojsonOverlayPattern,
  buildings3DPattern,
];
