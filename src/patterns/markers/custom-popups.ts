import mapboxgl, { type Map } from "mapbox-gl";
import type { Pattern } from "../../types";

const SOURCE_ID = "popups-source";
const LAYER_ID = "popups-layer";

let popup: mapboxgl.Popup | null = null;

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

    map.on("click", LAYER_ID, (e) => {
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
            <span style="background: ${controls.markerColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
              ${props.category}
            </span>
            <span style="color: #f59e0b; font-size: 13px;">
              ${"★".repeat(props.rating)}${"☆".repeat(5 - props.rating)}
            </span>
          </div>
        </div>
      `;

      popup?.setLngLat(coords).setHTML(html).addTo(map);
    });

    map.on("mouseenter", LAYER_ID, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", LAYER_ID, () => {
      map.getCanvas().style.cursor = "";
    });
  },

  cleanup(map: Map) {
    popup?.remove();
    popup = null;

    map.off("click", LAYER_ID, () => {});
    map.off("mouseenter", LAYER_ID, () => {});
    map.off("mouseleave", LAYER_ID, () => {});

    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  },

  update(map: Map, controls: Record<string, unknown>) {
    if (!map.getLayer(LAYER_ID)) return;

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
      name: "Oslo Opera House",
      description: "Award-winning opera house with walkable marble roof.",
      rating: 5,
      category: "Landmark",
      coordinates: [10.7527, 59.9075],
    },
    {
      name: "Vigeland Park",
      description: "World's largest sculpture park by a single artist.",
      rating: 5,
      category: "Park",
      coordinates: [10.7, 59.9269],
    },
    {
      name: "Karl Johans gate",
      description:
        "Oslo's main street connecting the Palace to Central Station.",
      rating: 4,
      category: "Entertainment",
      coordinates: [10.7414, 59.9127],
    },
    {
      name: "Akershus Fortress",
      description: "Medieval castle and fortress overlooking the Oslo Fjord.",
      rating: 5,
      category: "Landmark",
      coordinates: [10.7369, 59.9072],
    },
    {
      name: "Aker Brygge",
      description: "Popular waterfront district with restaurants and shops.",
      rating: 4,
      category: "Entertainment",
      coordinates: [10.7267, 59.9111],
    },
    {
      name: "Royal Palace",
      description: "Official residence of the Norwegian monarch.",
      rating: 5,
      category: "Landmark",
      coordinates: [10.7275, 59.9169],
    },
  ];
}
