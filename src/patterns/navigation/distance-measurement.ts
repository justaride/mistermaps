import type { Map, MapMouseEvent, GeoJSONSource } from "mapbox-gl";
import * as turf from "@turf/turf";
import type { Pattern } from "../../types";

const SOURCE_ID = "measurement-source";
const LINE_LAYER_ID = "measurement-line";
const POINTS_LAYER_ID = "measurement-points";
const LABEL_LAYER_ID = "measurement-label";

let points: [number, number][] = [];
let clickHandler: ((e: MapMouseEvent) => void) | null = null;

export const distanceMeasurementPattern: Pattern = {
  id: "distance-measurement",
  name: "Distance Measurement",
  category: "navigation",
  description:
    "Click on the map to measure distances between points. Double-click to finish.",
  controls: [
    {
      id: "lineColor",
      label: "Line Color",
      type: "color",
      defaultValue: "#ef4444",
    },
    {
      id: "unit",
      label: "Unit",
      type: "select",
      defaultValue: "kilometers",
      options: [
        { label: "Kilometers", value: "kilometers" },
        { label: "Miles", value: "miles" },
        { label: "Meters", value: "meters" },
      ],
    },
  ],

  setup(map: Map, controls: Record<string, unknown>) {
    points = [];

    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });

    map.addLayer({
      id: LINE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      filter: ["==", "$type", "LineString"],
      paint: {
        "line-color": controls.lineColor as string,
        "line-width": 3,
        "line-dasharray": [2, 1],
      },
    });

    map.addLayer({
      id: POINTS_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      filter: ["==", "$type", "Point"],
      paint: {
        "circle-radius": 6,
        "circle-color": controls.lineColor as string,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff",
      },
    });

    map.addLayer({
      id: LABEL_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      filter: ["has", "distance"],
      layout: {
        "text-field": ["get", "distance"],
        "text-size": 14,
        "text-offset": [0, -1.5],
        "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
      },
      paint: {
        "text-color": "#333",
        "text-halo-color": "#fff",
        "text-halo-width": 2,
      },
    });

    clickHandler = (e) => {
      const coord: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      points.push(coord);
      updateMeasurement(
        map,
        controls.unit as string,
        controls.lineColor as string,
      );
    };

    map.on("click", clickHandler);
    map.getCanvas().style.cursor = "crosshair";
  },

  cleanup(map: Map) {
    if (clickHandler) {
      map.off("click", clickHandler);
      clickHandler = null;
    }
    map.getCanvas().style.cursor = "";
    points = [];

    if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID);
    if (map.getLayer(POINTS_LAYER_ID)) map.removeLayer(POINTS_LAYER_ID);
    if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  },

  update(map: Map, controls: Record<string, unknown>) {
    if (!map.getLayer(LINE_LAYER_ID)) return;

    map.setPaintProperty(
      LINE_LAYER_ID,
      "line-color",
      controls.lineColor as string,
    );
    map.setPaintProperty(
      POINTS_LAYER_ID,
      "circle-color",
      controls.lineColor as string,
    );
    updateMeasurement(
      map,
      controls.unit as string,
      controls.lineColor as string,
    );
  },

  snippet: `// Distance Measurement Pattern
import * as turf from '@turf/turf';

let points = [];

map.on('click', (e) => {
  points.push([e.lngLat.lng, e.lngLat.lat]);
  updateMeasurement();
});

function updateMeasurement() {
  const features = [];

  // Add point features
  points.forEach(coord => {
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: coord }
    });
  });

  // Add line and calculate distance
  if (points.length > 1) {
    const line = turf.lineString(points);
    const distance = turf.length(line, { units: 'kilometers' });

    features.push({
      type: 'Feature',
      properties: { distance: \`\${distance.toFixed(2)} km\` },
      geometry: line.geometry
    });
  }

  map.getSource('measurement').setData({
    type: 'FeatureCollection',
    features
  });
}`,
};

function updateMeasurement(map: Map, unit: string, _color: string) {
  const source = map.getSource(SOURCE_ID) as GeoJSONSource;
  if (!source) return;

  const features: GeoJSON.Feature[] = [];

  points.forEach((coord) => {
    features.push({
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: coord },
    });
  });

  if (points.length > 1) {
    const line = turf.lineString(points);
    const distance = turf.length(line, {
      units: unit as "kilometers" | "miles" | "meters",
    });
    const midpoint = turf.midpoint(
      turf.point(points[0]),
      turf.point(points[points.length - 1]),
    );

    features.push({
      type: "Feature",
      properties: {},
      geometry: line.geometry,
    });

    const unitLabel =
      unit === "kilometers" ? "km" : unit === "miles" ? "mi" : "m";
    features.push({
      type: "Feature",
      properties: { distance: `${distance.toFixed(2)} ${unitLabel}` },
      geometry: midpoint.geometry,
    });
  }

  source.setData({
    type: "FeatureCollection",
    features,
  });
}
