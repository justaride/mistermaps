import type { Map } from "mapbox-gl";
import type { Pattern } from "../../types";

const LAYER_ID = "3d-buildings";

export const buildings3DPattern: Pattern = {
  id: "3d-buildings",
  name: "3D Buildings",
  category: "layers",
  description:
    "Display extruded 3D building footprints. Tilt the map to see the effect.",
  controls: [
    {
      id: "extrusion",
      label: "Extrusion Multiplier",
      type: "slider",
      defaultValue: 1,
      min: 0.5,
      max: 3,
      step: 0.1,
    },
    {
      id: "buildingColor",
      label: "Building Color",
      type: "color",
      defaultValue: "#aaaaaa",
    },
    {
      id: "opacity",
      label: "Opacity",
      type: "slider",
      defaultValue: 0.8,
      min: 0,
      max: 1,
      step: 0.1,
    },
  ],

  setup(map: Map, controls: Record<string, unknown>) {
    map.easeTo({
      center: [11.0, 61.83],
      zoom: 14,
      pitch: 60,
      bearing: -17.6,
      duration: 1000,
    });

    const labelLayerId = findFirstSymbolLayer(map);

    map.addLayer(
      {
        id: LAYER_ID,
        source: "composite",
        "source-layer": "building",
        filter: ["==", "extrude", "true"],
        type: "fill-extrusion",
        minzoom: 14,
        paint: {
          "fill-extrusion-color": controls.buildingColor as string,
          "fill-extrusion-height": [
            "*",
            ["get", "height"],
            controls.extrusion as number,
          ],
          "fill-extrusion-base": [
            "*",
            ["get", "min_height"],
            controls.extrusion as number,
          ],
          "fill-extrusion-opacity": controls.opacity as number,
        },
      },
      labelLayerId,
    );
  },

  cleanup(map: Map) {
    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);

    map.easeTo({
      pitch: 0,
      bearing: 0,
      duration: 500,
    });
  },

  update(map: Map, controls: Record<string, unknown>) {
    if (!map.getLayer(LAYER_ID)) return;

    map.setPaintProperty(
      LAYER_ID,
      "fill-extrusion-color",
      controls.buildingColor as string,
    );
    map.setPaintProperty(LAYER_ID, "fill-extrusion-height", [
      "*",
      ["get", "height"],
      controls.extrusion as number,
    ]);
    map.setPaintProperty(LAYER_ID, "fill-extrusion-base", [
      "*",
      ["get", "min_height"],
      controls.extrusion as number,
    ]);
    map.setPaintProperty(
      LAYER_ID,
      "fill-extrusion-opacity",
      controls.opacity as number,
    );
  },

  snippet: `// 3D Buildings Pattern
// Tilt the map to see 3D effect
map.easeTo({
  pitch: 60,
  bearing: -17.6,
  duration: 1000
});

// Find the first symbol layer to insert buildings below labels
const layers = map.getStyle().layers;
const labelLayerId = layers.find(
  layer => layer.type === 'symbol' && layer.layout['text-field']
)?.id;

map.addLayer({
  id: '3d-buildings',
  source: 'composite',
  'source-layer': 'building',
  filter: ['==', 'extrude', 'true'],
  type: 'fill-extrusion',
  minzoom: 14,
  paint: {
    'fill-extrusion-color': '#aaa',
    // Use building height data
    'fill-extrusion-height': ['get', 'height'],
    'fill-extrusion-base': ['get', 'min_height'],
    'fill-extrusion-opacity': 0.8
  }
}, labelLayerId);

// Apply extrusion multiplier for dramatic effect
map.setPaintProperty('3d-buildings', 'fill-extrusion-height', [
  '*', ['get', 'height'], 1.5
]);`,
};

function findFirstSymbolLayer(map: Map): string | undefined {
  const layers = map.getStyle()?.layers;
  if (!layers) return undefined;

  for (const layer of layers) {
    if (
      layer.type === "symbol" &&
      "layout" in layer &&
      layer.layout &&
      "text-field" in layer.layout
    ) {
      return layer.id;
    }
  }
  return undefined;
}
