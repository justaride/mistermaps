export type MapEngine = "mapbox" | "maplibre";

export async function loadMapboxGL() {
  type MapboxImport = typeof import("mapbox-gl");
  type MapboxGL = MapboxImport extends { default: infer D } ? D : MapboxImport;
  const mod = await import("mapbox-gl");
  return ((mod as unknown as { default?: MapboxGL }).default ??
    (mod as unknown as MapboxGL)) as MapboxGL;
}

export async function loadMapLibreGL() {
  type MapLibreImport = typeof import("maplibre-gl");
  type MapLibreGL = MapLibreImport extends { default: infer D } ? D : MapLibreImport;
  const mod = await import("maplibre-gl");
  return ((mod as unknown as { default?: MapLibreGL }).default ??
    (mod as unknown as MapLibreGL)) as MapLibreGL;
}
