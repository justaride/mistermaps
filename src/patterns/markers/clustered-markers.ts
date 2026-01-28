import type { Map } from "mapbox-gl";
import type { Pattern } from "../../types";

const SOURCE_ID = "clusters-source";
const CLUSTERS_LAYER_ID = "clusters";
const CLUSTER_COUNT_LAYER_ID = "cluster-count";
const UNCLUSTERED_LAYER_ID = "unclustered-point";

export const clusteredMarkersPattern: Pattern = {
  id: "clustered-markers",
  name: "Clustered Markers",
  category: "markers",
  description:
    "Automatically group nearby points into clusters. Click clusters to zoom in and expand.",
  controls: [
    {
      id: "clusterRadius",
      label: "Cluster Radius",
      type: "slider",
      defaultValue: 50,
      min: 20,
      max: 100,
      step: 5,
    },
    {
      id: "pointSize",
      label: "Point Size",
      type: "slider",
      defaultValue: 8,
      min: 4,
      max: 16,
      step: 1,
    },
    {
      id: "pointColor",
      label: "Point Color",
      type: "color",
      defaultValue: "#10b981",
    },
  ],

  setup(map: Map, controls: Record<string, unknown>) {
    const points = generateRandomPoints([10.8, 61.7], [11.3, 62.0], 200);

    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: points.map((coord, i) => ({
          type: "Feature",
          properties: { id: i, name: `Location ${i + 1}` },
          geometry: { type: "Point", coordinates: coord },
        })),
      },
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: controls.clusterRadius as number,
    });

    map.addLayer({
      id: CLUSTERS_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": [
          "step",
          ["get", "point_count"],
          controls.pointColor as string,
          20,
          "#f59e0b",
          50,
          "#ef4444",
        ],
        "circle-radius": ["step", ["get", "point_count"], 20, 20, 30, 50, 40],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff",
      },
    });

    map.addLayer({
      id: CLUSTER_COUNT_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
        "text-size": 14,
      },
      paint: {
        "text-color": "#fff",
      },
    });

    map.addLayer({
      id: UNCLUSTERED_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": controls.pointColor as string,
        "circle-radius": controls.pointSize as number,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff",
      },
    });

    map.on("click", CLUSTERS_LAYER_ID, (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: [CLUSTERS_LAYER_ID],
      });
      const clusterId = features[0]?.properties?.cluster_id;
      if (clusterId === undefined) return;

      const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource;
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err || zoom === undefined || zoom === null) return;
        const geometry = features[0].geometry as GeoJSON.Point;
        map.easeTo({
          center: geometry.coordinates as [number, number],
          zoom,
        });
      });
    });

    map.on("mouseenter", CLUSTERS_LAYER_ID, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", CLUSTERS_LAYER_ID, () => {
      map.getCanvas().style.cursor = "";
    });
  },

  cleanup(map: Map) {
    map.off("click", CLUSTERS_LAYER_ID, () => {});
    map.off("mouseenter", CLUSTERS_LAYER_ID, () => {});
    map.off("mouseleave", CLUSTERS_LAYER_ID, () => {});

    if (map.getLayer(CLUSTER_COUNT_LAYER_ID))
      map.removeLayer(CLUSTER_COUNT_LAYER_ID);
    if (map.getLayer(UNCLUSTERED_LAYER_ID))
      map.removeLayer(UNCLUSTERED_LAYER_ID);
    if (map.getLayer(CLUSTERS_LAYER_ID)) map.removeLayer(CLUSTERS_LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  },

  update(map: Map, controls: Record<string, unknown>) {
    if (!map.getLayer(CLUSTERS_LAYER_ID)) return;

    map.setPaintProperty(
      UNCLUSTERED_LAYER_ID,
      "circle-color",
      controls.pointColor as string,
    );
    map.setPaintProperty(
      UNCLUSTERED_LAYER_ID,
      "circle-radius",
      controls.pointSize as number,
    );
    map.setPaintProperty(CLUSTERS_LAYER_ID, "circle-color", [
      "step",
      ["get", "point_count"],
      controls.pointColor as string,
      20,
      "#f59e0b",
      50,
      "#ef4444",
    ]);
  },

  snippet: `// Clustered Markers Pattern
map.addSource('clusters-source', {
  type: 'geojson',
  data: pointsGeoJSON,
  cluster: true,
  clusterMaxZoom: 14,
  clusterRadius: 50
});

// Cluster circles
map.addLayer({
  id: 'clusters',
  type: 'circle',
  source: 'clusters-source',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': [
      'step', ['get', 'point_count'],
      '#10b981', 20,
      '#f59e0b', 50,
      '#ef4444'
    ],
    'circle-radius': ['step', ['get', 'point_count'], 20, 20, 30, 50, 40]
  }
});

// Cluster count labels
map.addLayer({
  id: 'cluster-count',
  type: 'symbol',
  source: 'clusters-source',
  filter: ['has', 'point_count'],
  layout: {
    'text-field': ['get', 'point_count_abbreviated'],
    'text-size': 14
  }
});

// Individual points
map.addLayer({
  id: 'unclustered-point',
  type: 'circle',
  source: 'clusters-source',
  filter: ['!', ['has', 'point_count']],
  paint: {
    'circle-color': '#10b981',
    'circle-radius': 8
  }
});

// Click to zoom into cluster
map.on('click', 'clusters', (e) => {
  const clusterId = e.features[0].properties.cluster_id;
  map.getSource('clusters-source').getClusterExpansionZoom(clusterId, (err, zoom) => {
    map.easeTo({ center: e.features[0].geometry.coordinates, zoom });
  });
});`,
};

function generateRandomPoints(
  sw: [number, number],
  ne: [number, number],
  count: number,
): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const lng = sw[0] + Math.random() * (ne[0] - sw[0]);
    const lat = sw[1] + Math.random() * (ne[1] - sw[1]);
    points.push([lng, lat]);
  }
  return points;
}
