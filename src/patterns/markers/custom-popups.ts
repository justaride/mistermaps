import mapboxgl, { type Map, type MapLayerMouseEvent } from "mapbox-gl";
import type { Pattern } from "../../types";

const SOURCE_ID = "popups-source";
const LAYER_ID = "popups-layer";

let popup: mapboxgl.Popup | null = null;
let markerColor = "#8b5cf6";
let clickHandler: ((e: MapLayerMouseEvent) => void) | null = null;
let mouseEnterHandler: (() => void) | null = null;
let mouseLeaveHandler: (() => void) | null = null;

export const customPopupsPattern: Pattern = {
  id: "custom-popups",
  name: "Custom Popups",
  category: "markers",
  description:
    "Display rich information windows when clicking markers. Customize appearance and content.",
  controls: [
    {
      id: "markerColor",
      label: "Marker Color",
      type: "color",
      defaultValue: "#8b5cf6",
    },
    {
      id: "markerSize",
      label: "Marker Size",
      type: "slider",
      defaultValue: 10,
      min: 6,
      max: 20,
      step: 1,
    },
    {
      id: "closeOnClick",
      label: "Close on Map Click",
      type: "toggle",
      defaultValue: true,
    },
  ],

  setup(map: Map, controls: Record<string, unknown>) {
    const locations = getSampleLocations();
    markerColor = controls.markerColor as string;

    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: locations.map((loc) => ({
          type: "Feature",
          properties: loc,
          geometry: { type: "Point", coordinates: loc.coordinates },
        })),
      },
    });

    map.addLayer({
      id: LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-color": controls.markerColor as string,
        "circle-radius": controls.markerSize as number,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff",
      },
    });

    popup = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: controls.closeOnClick as boolean,
      maxWidth: "300px",
    });

    clickHandler = (e) => {
      const feature = e.features?.[0];
      if (!feature) return;

      const coords = (
        feature.geometry as GeoJSON.Point
      ).coordinates.slice() as [number, number];
      const props = feature.properties as {
        name: string;
        description: string;
        rating: number;
        category: string;
      };

      const html = `
        <div style="font-family: system-ui, sans-serif;">
          <h3 style="margin: 0 0 8px; font-size: 16px; color: #1a1a1a;">${props.name}</h3>
          <p style="margin: 0 0 8px; color: #666; font-size: 13px;">${props.description}</p>
          <div style="display: flex; gap: 8px; align-items: center;">
            <span style="background: ${markerColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
              ${props.category}
            </span>
            <span style="color: #f59e0b; font-size: 13px;">
              ${"★".repeat(props.rating)}${"☆".repeat(5 - props.rating)}
            </span>
          </div>
        </div>
      `;

      popup?.setLngLat(coords).setHTML(html).addTo(map);
    };
    map.on("click", LAYER_ID, clickHandler);

    mouseEnterHandler = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    map.on("mouseenter", LAYER_ID, mouseEnterHandler);

    mouseLeaveHandler = () => {
      map.getCanvas().style.cursor = "";
    };
    map.on("mouseleave", LAYER_ID, mouseLeaveHandler);
  },

  cleanup(map: Map) {
    popup?.remove();
    popup = null;

    if (clickHandler) {
      map.off("click", LAYER_ID, clickHandler);
      clickHandler = null;
    }
    if (mouseEnterHandler) {
      map.off("mouseenter", LAYER_ID, mouseEnterHandler);
      mouseEnterHandler = null;
    }
    if (mouseLeaveHandler) {
      map.off("mouseleave", LAYER_ID, mouseLeaveHandler);
      mouseLeaveHandler = null;
    }

    map.getCanvas().style.cursor = "";

    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  },

  update(map: Map, controls: Record<string, unknown>) {
    if (!map.getLayer(LAYER_ID)) return;

    markerColor = controls.markerColor as string;

    map.setPaintProperty(
      LAYER_ID,
      "circle-color",
      controls.markerColor as string,
    );
    map.setPaintProperty(
      LAYER_ID,
      "circle-radius",
      controls.markerSize as number,
    );

    if (popup) {
      popup.remove();
      popup = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: controls.closeOnClick as boolean,
        maxWidth: "300px",
      });
    }
  },

  snippet: `// Custom Popups Pattern
map.addSource('locations', {
  type: 'geojson',
  data: locationsGeoJSON
});

map.addLayer({
  id: 'locations-layer',
  type: 'circle',
  source: 'locations',
  paint: {
    'circle-color': '#8b5cf6',
    'circle-radius': 10,
    'circle-stroke-width': 2,
    'circle-stroke-color': '#fff'
  }
});

const popup = new mapboxgl.Popup({
  closeButton: true,
  closeOnClick: true,
  maxWidth: '300px'
});

map.on('click', 'locations-layer', (e) => {
  const feature = e.features[0];
  const coords = feature.geometry.coordinates;
  const { name, description, rating } = feature.properties;

  const html = \`
    <div style="font-family: system-ui;">
      <h3>\${name}</h3>
      <p>\${description}</p>
      <span>Rating: \${'★'.repeat(rating)}</span>
    </div>
  \`;

  popup.setLngLat(coords).setHTML(html).addTo(map);
});

map.on('mouseenter', 'locations-layer', () => {
  map.getCanvas().style.cursor = 'pointer';
});

map.on('mouseleave', 'locations-layer', () => {
  map.getCanvas().style.cursor = '';
});`,
};

type Location = {
  name: string;
  description: string;
  rating: number;
  category: string;
  coordinates: [number, number];
};

function getSampleLocations(): Location[] {
  return [
    {
      name: "Rendalen Church",
      description: "Historic wooden church from 1757 in Bergset.",
      rating: 5,
      category: "Landmark",
      coordinates: [11.0, 61.83],
    },
    {
      name: "Sølensjøen",
      description: "Beautiful mountain lake popular for fishing and hiking.",
      rating: 5,
      category: "Nature",
      coordinates: [11.15, 61.78],
    },
    {
      name: "Rendalen Kultursenter",
      description: "Local cultural center with events and exhibitions.",
      rating: 4,
      category: "Culture",
      coordinates: [11.02, 61.84],
    },
    {
      name: "Jutulhogget Canyon",
      description:
        "Northern Europe's largest canyon, 2.4km long and 240m deep.",
      rating: 5,
      category: "Nature",
      coordinates: [10.88, 61.95],
    },
    {
      name: "Fiskevollen",
      description: "Traditional fishing village by Sølensjøen lake.",
      rating: 4,
      category: "Heritage",
      coordinates: [11.12, 61.76],
    },
    {
      name: "Spekedalssetra",
      description: "Historic mountain farm with traditional architecture.",
      rating: 4,
      category: "Heritage",
      coordinates: [10.95, 61.88],
    },
  ];
}
