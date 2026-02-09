import type { Pattern, PatternId } from "../types";

type PatternLoader = () => Promise<Pattern>;

const patternLoaders: Record<PatternId, PatternLoader> = {
  "style-switcher": async () =>
    (await import("./layers/style-switcher")).styleSwitcherPattern,
  "style-loader": async () =>
    (await import("./layers/style-loader")).styleLoaderPattern,
  "rendalen-data": async () =>
    (await import("./layers/rendalen-data")).rendalenDataPattern,
  "layer-inspector": async () =>
    (await import("./layers/layer-inspector")).layerInspectorPattern,
  "layer-explorer": async () =>
    (await import("./layers/layer-explorer")).layerExplorerPattern,
  "layer-basics": async () =>
    (await import("./layers/layer-basics")).layerBasicsPattern,
  "hover-tooltips": async () =>
    (await import("./layers/hover-tooltips")).hoverTooltipsPattern,
  "symbol-labels-icons": async () =>
    (await import("./layers/symbol-labels-icons")).symbolLabelsIconsPattern,
  "line-decorations": async () =>
    (await import("./layers/line-decorations")).lineDecorationsPattern,
  "raster-overlay": async () =>
    (await import("./layers/raster-overlay")).rasterOverlayPattern,
  "image-overlay": async () =>
    (await import("./layers/image-overlay")).imageOverlayPattern,
  "map-compare-swipe": async () =>
    (await import("./layers/map-compare-swipe")).mapCompareSwipePattern,
  "geojson-overlay": async () =>
    (await import("./layers/geojson-overlay")).geojsonOverlayPattern,
  "3d-buildings": async () =>
    (await import("./layers/buildings-3d")).buildings3DPattern,
  "feature-state": async () =>
    (await import("./layers/feature-state")).featureStatePattern,
  "vector-feature-state": async () =>
    (await import("./layers/vector-feature-state")).vectorFeatureStatePattern,
  "vector-road-styling": async () =>
    (await import("./layers/vector-road-styling")).vectorRoadStylingPattern,
  "vector-debug-tools": async () =>
    (await import("./layers/vector-debug-tools")).vectorDebugToolsPattern,
  "terrain-hillshade": async () =>
    (await import("./layers/terrain-hillshade")).terrainHillshadePattern,
  "terrain-exaggeration": async () =>
    (await import("./layers/terrain-exaggeration")).terrainExaggerationPattern,
  "nasa-gibs-true-color": async () =>
    (await import("./layers/nasa-gibs")).nasaGibsTrueColorPattern,
  choropleth: async () =>
    (await import("./data-viz/choropleth")).choroplethPattern,
  heatmap: async () => (await import("./data-viz/heatmap")).heatmapPattern,
  geolocation: async () =>
    (await import("./navigation/geolocation")).geolocationPattern,
  "geocoding-search": async () =>
    (await import("./navigation/geocoding-search")).geocodingSearchPattern,
  "overpass-poi-overlay": async () =>
    (await import("./navigation/overpass-poi-overlay"))
      .overpassPoiOverlayPattern,
  "route-display": async () =>
    (await import("./navigation/route-display")).routeDisplayPattern,
  "distance-measurement": async () =>
    (await import("./navigation/distance-measurement"))
      .distanceMeasurementPattern,
  "area-measurement": async () =>
    (await import("./navigation/area-measurement")).areaMeasurementPattern,
  "animated-route": async () =>
    (await import("./navigation/animated-route")).animatedRoutePattern,
  isochrones: async () =>
    (await import("./navigation/isochrones")).isochronesPattern,
  "clustered-markers": async () =>
    (await import("./markers/clustered-markers")).clusteredMarkersPattern,
  "custom-popups": async () =>
    (await import("./markers/custom-popups")).customPopupsPattern,
  "pulsing-dot": async () =>
    (await import("./markers/pulsing-dot")).pulsingDotPattern,
};

export async function loadPatternById(id: string): Promise<Pattern | null> {
  if (!Object.prototype.hasOwnProperty.call(patternLoaders, id)) {
    return null;
  }

  return patternLoaders[id as PatternId]();
}
