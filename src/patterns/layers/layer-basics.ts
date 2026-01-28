import type { Map } from "mapbox-gl";
import type { Pattern } from "../../types";

const CIRCLE_SOURCE = "basics-circles";
const CIRCLE_LAYER = "basics-circles-layer";
const POLYGON_SOURCE = "basics-polygon";
const POLYGON_LAYER = "basics-polygon-layer";
const LINE_SOURCE = "basics-line";
const LINE_LAYER = "basics-line-layer";
const LABEL_SOURCE = "basics-labels";
const LABEL_LAYER = "basics-labels-layer";

export const layerBasicsPattern: Pattern = {
  id: "layer-basics",
  name: "Layer Basics",
  category: "layers",
  description:
    "Learn layers step by step. Toggle each layer to see how they stack.",
  controls: [
    {
      id: "showPolygon",
      label: "1. Polygon (Area)",
      type: "toggle",
      defaultValue: true,
    },
    {
      id: "showLine",
      label: "2. Line (Path)",
      type: "toggle",
      defaultValue: true,
    },
    {
      id: "showCircles",
      label: "3. Circles (Points)",
      type: "toggle",
      defaultValue: true,
    },
    {
      id: "showLabels",
      label: "4. Labels (Text)",
      type: "toggle",
      defaultValue: true,
    },
  ],

  setup(map: Map) {
    map.flyTo({
      center: [11.0, 61.83],
      zoom: 11,
      duration: 1000,
    });

    // LAYER 1: Polygon (filled area)
    map.addSource(POLYGON_SOURCE, {
      type: "geojson",
      data: {
        type: "Feature",
        properties: { name: "My Area" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [10.9, 61.78],
              [11.1, 61.78],
              [11.1, 61.88],
              [10.9, 61.88],
              [10.9, 61.78],
            ],
          ],
        },
      },
    });

    map.addLayer({
      id: POLYGON_LAYER,
      type: "fill", // <-- Layer type: fill = colored area
      source: POLYGON_SOURCE,
      paint: {
        "fill-color": "#22c55e", // Green
        "fill-opacity": 0.4,
      },
    });

    // LAYER 2: Line (path/route)
    map.addSource(LINE_SOURCE, {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: [
            [10.92, 61.8],
            [10.98, 61.83],
            [11.05, 61.82],
            [11.08, 61.86],
          ],
        },
      },
    });

    map.addLayer({
      id: LINE_LAYER,
      type: "line", // <-- Layer type: line = path
      source: LINE_SOURCE,
      paint: {
        "line-color": "#3b82f6", // Blue
        "line-width": 4,
      },
    });

    // LAYER 3: Circles (points)
    map.addSource(CIRCLE_SOURCE, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { name: "Start" },
            geometry: { type: "Point", coordinates: [10.92, 61.8] },
          },
          {
            type: "Feature",
            properties: { name: "Middle" },
            geometry: { type: "Point", coordinates: [10.98, 61.83] },
          },
          {
            type: "Feature",
            properties: { name: "End" },
            geometry: { type: "Point", coordinates: [11.08, 61.86] },
          },
        ],
      },
    });

    map.addLayer({
      id: CIRCLE_LAYER,
      type: "circle", // <-- Layer type: circle = points
      source: CIRCLE_SOURCE,
      paint: {
        "circle-radius": 10,
        "circle-color": "#ef4444", // Red
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff",
      },
    });

    // LAYER 4: Labels (text)
    map.addSource(LABEL_SOURCE, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { name: "Start" },
            geometry: { type: "Point", coordinates: [10.92, 61.8] },
          },
          {
            type: "Feature",
            properties: { name: "Middle" },
            geometry: { type: "Point", coordinates: [10.98, 61.83] },
          },
          {
            type: "Feature",
            properties: { name: "End" },
            geometry: { type: "Point", coordinates: [11.08, 61.86] },
          },
        ],
      },
    });

    map.addLayer({
      id: LABEL_LAYER,
      type: "symbol", // <-- Layer type: symbol = text/icons
      source: LABEL_SOURCE,
      layout: {
        "text-field": ["get", "name"], // Get "name" from properties
        "text-size": 14,
        "text-offset": [0, 1.5], // Push text below point
      },
      paint: {
        "text-color": "#1f2937",
        "text-halo-color": "#fff",
        "text-halo-width": 2,
      },
    });
  },

  cleanup(map: Map) {
    [LABEL_LAYER, CIRCLE_LAYER, LINE_LAYER, POLYGON_LAYER].forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    [LABEL_SOURCE, CIRCLE_SOURCE, LINE_SOURCE, POLYGON_SOURCE].forEach((id) => {
      if (map.getSource(id)) map.removeSource(id);
    });
  },

  update(map: Map, controls: Record<string, unknown>) {
    const setVisible = (layerId: string, visible: boolean) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(
          layerId,
          "visibility",
          visible ? "visible" : "none",
        );
      }
    };

    setVisible(POLYGON_LAYER, controls.showPolygon as boolean);
    setVisible(LINE_LAYER, controls.showLine as boolean);
    setVisible(CIRCLE_LAYER, controls.showCircles as boolean);
    setVisible(LABEL_LAYER, controls.showLabels as boolean);
  },

  snippet: `// LAYERS EXPLAINED SIMPLY
// ========================
// A layer = how to DRAW your data on the map
// You need: 1) Data (source)  2) Style (layer)

// STEP 1: Add your data as a "source"
map.addSource('my-points', {
  type: 'geojson',
  data: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'My Place' },      // Custom data
        geometry: {
          type: 'Point',                        // Shape type
          coordinates: [11.0, 61.83]            // [longitude, latitude]
        }
      }
    ]
  }
});

// STEP 2: Add a "layer" to display it
map.addLayer({
  id: 'my-layer',           // Unique name
  type: 'circle',           // How to draw it (see types below)
  source: 'my-points',      // Which data to use
  paint: {                  // Styling
    'circle-radius': 10,
    'circle-color': 'red'
  }
});

// LAYER TYPES - Pick based on your data:
// ----------------------------------------
// 'circle'  → Points as dots        (locations, markers)
// 'symbol'  → Points as text/icons  (labels, custom markers)
// 'line'    → Lines as strokes      (roads, routes, paths)
// 'fill'    → Polygons as areas     (regions, buildings, parks)

// COMMON ACTIONS:
// ---------------
// Hide a layer:
map.setLayoutProperty('my-layer', 'visibility', 'none');

// Show a layer:
map.setLayoutProperty('my-layer', 'visibility', 'visible');

// Change a style:
map.setPaintProperty('my-layer', 'circle-color', 'blue');

// Remove completely:
map.removeLayer('my-layer');
map.removeSource('my-points');

// THE KEY INSIGHT:
// Source = your data (WHERE things are)
// Layer = how to draw it (HOW it looks)
// One source can have multiple layers!`,
};
