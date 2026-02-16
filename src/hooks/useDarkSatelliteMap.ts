import { useCallback, type RefObject } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { useManagedMap } from "./useManagedMap";
import { logError } from "../utils/logger";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

type UseDarkSatelliteMapOptions = {
  container: RefObject<HTMLDivElement | null>;
};

export function useDarkSatelliteMap({ container }: UseDarkSatelliteMapOptions) {
  const createMap = useCallback(
    async (containerEl: HTMLDivElement): Promise<MapboxMap> => {
      type MapboxGL = (typeof import("mapbox-gl"))["default"];
      const mod = await import("mapbox-gl");
      const mapboxgl = (mod as unknown as { default: MapboxGL }).default;

      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container: containerEl,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        center: [10.95, 59.93],
        zoom: 11,
        pitch: 0,
        bearing: 0,
      });

      map.addControl(new mapboxgl.NavigationControl(), "top-right");

      map.on("style.load", () => {
        const layers = map.getStyle().layers;
        if (!layers) return;

        for (const layer of layers) {
          if (layer.type === "raster") {
            map.setPaintProperty(layer.id, "raster-brightness-max", 0.6);
            map.setPaintProperty(layer.id, "raster-brightness-min", 0.05);
            map.setPaintProperty(layer.id, "raster-saturation", -0.3);
          }

          if (layer.type === "line" && layer.id.includes("road")) {
            map.setPaintProperty(layer.id, "line-color", "#FF8C42");
            map.setPaintProperty(layer.id, "line-opacity", 0.85);
          }

          if (
            layer.type === "symbol" &&
            (layer.id.includes("label") || layer.id.includes("place"))
          ) {
            map.setPaintProperty(layer.id, "text-color", "#f0f0f0");
            map.setPaintProperty(layer.id, "text-halo-color", "rgba(0,0,0,0.8)");
            map.setPaintProperty(layer.id, "text-halo-width", 1.5);
          }
        }

        setIsLoaded(true);
      });

      return map;
    },
    [],
  );

  const { mapRef, isLoaded, setIsLoaded } = useManagedMap<MapboxMap>({
    container,
    createMap,
    onCreateError: (error) => {
      logError("Failed to initialize dark satellite map", error);
    },
  });

  return { map: mapRef.current, isLoaded };
}
