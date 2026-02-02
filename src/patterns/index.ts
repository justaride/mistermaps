import type { Pattern } from "../types";
import {
  buildings3DPattern,
  geojsonOverlayPattern,
  layerBasicsPattern,
  layerExplorerPattern,
  layerInspectorPattern,
  rendalenDataPattern,
} from "./layers";

export const patterns: Pattern[] = [
  rendalenDataPattern,
  layerInspectorPattern,
  layerExplorerPattern,
  layerBasicsPattern,
  geojsonOverlayPattern,
  buildings3DPattern,
];
