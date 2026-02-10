import { useRef } from "react";
import { Link } from "react-router-dom";
import type { GeoJSONSource } from "mapbox-gl";
import { ArrowLeft } from "lucide-react";
import "../map/engine-css";
import { useDarkSatelliteMap } from "../hooks/useDarkSatelliteMap";
import containerStyles from "../components/MapContainer.module.css";
import styles from "../App.module.css";

const SOURCE_ID = "oslo-clusters";
const CLUSTERS_LAYER = "oslo-clusters-circles";
const CLUSTER_COUNT_LAYER = "oslo-cluster-count";
const UNCLUSTERED_LAYER = "oslo-unclustered";

const BLUE = "#3b82f6";

function generatePoints(count: number): GeoJSON.FeatureCollection {
  const sw = [10.85, 59.88] as const;
  const ne = [11.05, 59.98] as const;
  const features: GeoJSON.Feature[] = [];
  for (let i = 0; i < count; i++) {
    features.push({
      type: "Feature",
      properties: { id: i, name: `Location ${i + 1}` },
      geometry: {
        type: "Point",
        coordinates: [
          sw[0] + Math.random() * (ne[0] - sw[0]),
          sw[1] + Math.random() * (ne[1] - sw[1]),
        ],
      },
    });
  }
  return { type: "FeatureCollection", features };
}

export default function OsloSatellite() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { map, isLoaded } = useDarkSatelliteMap({ container: containerRef });

  if (map && isLoaded && !map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: generatePoints(200),
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50,
    });

    map.addLayer({
      id: CLUSTERS_LAYER,
      type: "circle",
      source: SOURCE_ID,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": [
          "step",
          ["get", "point_count"],
          BLUE,
          20,
          "#2563eb",
          50,
          "#1d4ed8",
        ],
        "circle-radius": ["step", ["get", "point_count"], 20, 20, 30, 50, 40],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff",
      },
    });

    map.addLayer({
      id: CLUSTER_COUNT_LAYER,
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
      id: UNCLUSTERED_LAYER,
      type: "circle",
      source: SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": BLUE,
        "circle-radius": 8,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff",
      },
    });

    map.on("click", CLUSTERS_LAYER, (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: [CLUSTERS_LAYER],
      });
      const clusterId = features[0]?.properties?.cluster_id;
      if (clusterId === undefined) return;

      const source = map.getSource(SOURCE_ID) as GeoJSONSource;
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err || zoom === undefined || zoom === null) return;
        const geometry = features[0].geometry as GeoJSON.Point;
        map.easeTo({
          center: geometry.coordinates as [number, number],
          zoom,
        });
      });
    });

    map.on("mouseenter", CLUSTERS_LAYER, () => {
      map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", CLUSTERS_LAYER, () => {
      map.getCanvas().style.cursor = "";
    });
  }

  return (
    <div className={`${styles.app} map-root`}>
      <div ref={containerRef} className={containerStyles.container} />
      {(!map || !isLoaded) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-bg/80 font-mono text-xs text-muted">
          Loading map...
        </div>
      )}

      <div className="absolute left-4 top-4 z-10">
        <Link
          to="/maps"
          className="inline-flex items-center gap-2 border-2 border-border bg-card px-3 py-1.5 font-mono text-xs font-bold text-fg transition-transform hover:-translate-y-0.5"
          style={{ boxShadow: "2px 2px 0 var(--color-border)" }}
        >
          <ArrowLeft className="h-3 w-3" /> Back to Maps
        </Link>
      </div>
    </div>
  );
}
