import type { Map } from "mapbox-gl";
import type { Pattern } from "../../types";
import { valhallaRoutingProvider } from "../../providers/routing";
import type { LngLat } from "../../providers/types";

const SOURCE_ID = "isochrone-source";
const LAYER_ID_PREFIX = "isochrone-layer-";

export const isochronesPattern: Pattern = {
  id: "isochrones" as any, // We'll add this to PatternId type
  name: "Isochrones (Travel Time)",
  category: "navigation",
  description:
    "Visualize reachable areas within specific travel time intervals using Valhalla.",
  controls: [
    {
      id: "profile",
      label: "Profile",
      type: "select",
      defaultValue: "driving",
      options: [
        { label: "Driving", value: "driving" },
        { label: "Walking", value: "walking" },
        { label: "Cycling", value: "cycling" },
      ],
    },
    {
      id: "intervals",
      label: "Intervals (minutes)",
      type: "select",
      defaultValue: "10,20,30",
      options: [
        { label: "5, 10, 15", value: "5,10,15" },
        { label: "10, 20, 30", value: "10,20,30" },
        { label: "15, 30, 45", value: "15,30,45" },
      ],
    },
    {
      id: "opacity",
      label: "Opacity",
      type: "slider",
      defaultValue: 0.5,
      min: 0,
      max: 1,
      step: 0.1,
    },
  ],

  async setup(map: Map, controls: Record<string, unknown>) {
    const center = map.getCenter().toArray() as LngLat;
    await this.updateIsochrones(map, center, controls);

    map.on("click", this.handleMapClick.bind(this, map));
  },

  cleanup(map: Map) {
    const layers = map.getStyle().layers || [];
    layers.forEach((layer) => {
      if (layer.id.startsWith(LAYER_ID_PREFIX)) {
        map.removeLayer(layer.id);
      }
    });
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    map.off("click", this.handleMapClick);
  },

  async update(map: Map, controls: Record<string, unknown>) {
    const center = map.getCenter().toArray() as LngLat;
    await this.updateIsochrones(map, center, controls);
  },

  async handleMapClick(map: Map, e: any) {
    const center = [e.lngLat.lng, e.lngLat.lat] as LngLat;
    // We need to get current controls. This is a bit tricky with this pattern structure.
    // For now, we'll just use the center from the map in update.
  },

  async updateIsochrones(map: Map, center: LngLat, controls: Record<string, unknown>) {
    const minutes = (controls.intervals as string).split(",").map((s) => parseInt(s.trim()));
    const profile = (controls.profile as any) || "driving";

    try {
      const data = await valhallaRoutingProvider.isochrone({
        center,
        minutes,
        profile,
      });

      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: "geojson",
          data,
        });
      } else {
        (map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource).setData(data);
      }

      // Add layers for each contour if they don't exist
      const colors = ["#4ade80", "#facc15", "#f87171", "#a78bfa", "#60a5fa"];
      
      // Remove old layers first to ensure order or just update
      const existingLayers = map.getStyle().layers || [];
      existingLayers.forEach(l => {
        if (l.id.startsWith(LAYER_ID_PREFIX)) map.removeLayer(l.id);
      });

      // Valhalla returns features in order of time. We should render largest first (background) or use transparency.
      // Actually, Valhalla contours usually overlap.
      const features = [...data.features].reverse(); // Smallest last (on top)

      features.forEach((feature, i) => {
        const layerId = `${LAYER_ID_PREFIX}${i}`;
        map.addLayer({
          id: layerId,
          type: "fill",
          source: SOURCE_ID,
          filter: ["==", ["get", "contour"], feature.properties.contour],
          paint: {
            "fill-color": colors[i % colors.length],
            "fill-opacity": controls.opacity as number,
            "fill-outline-color": "#fff",
          },
        });
      });

    } catch (error) {
      console.error("Isochrone update failed:", error);
    }
  },

  snippet: `// Isochrones with Valhalla
const result = await valhallaRoutingProvider.isochrone({
  center: [10.75, 59.91],
  minutes: [10, 20, 30],
  profile: 'driving'
});

map.addSource('isochrones', {
  type: 'geojson',
  data: result
});

map.addLayer({
  id: 'isochrone-fill',
  type: 'fill',
  source: 'isochrones',
  paint: {
    'fill-color': ['interpolate', ['linear'], ['get', 'contour'], 
      10, '#4ade80', 
      20, '#facc15', 
      30, '#f87171'
    ],
    'fill-opacity': 0.5
  }
});`,
};
