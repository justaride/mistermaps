import type { Map as MapboxMap } from "mapbox-gl";
import type { Map as MapLibreMap } from "maplibre-gl";

export type AnyMap = MapboxMap | MapLibreMap;

// Mapbox GL and MapLibre GL have largely compatible runtime APIs, but their TS
// types diverge enough that unioning them can make common overloads unusable.
// These helpers keep the call sites typed without impacting runtime behavior.
export function once(map: AnyMap, type: string, cb: () => void): void {
  (map as unknown as { once: (t: string, cb: () => void) => void }).once(type, cb);
}

export function getSource(map: AnyMap, id: string): unknown {
  return (map as unknown as { getSource: (id: string) => unknown }).getSource(id);
}
