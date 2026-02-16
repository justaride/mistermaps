import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { Theme } from "../types";
import { mapboxBasemapProvider } from "../providers/basemap";
import { useManagedMap } from "./useManagedMap";
import { logError } from "../utils/logger";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

type UseMapOptions = {
  container: RefObject<HTMLDivElement | null>;
  theme: Theme;
};

export function useMap({ container, theme }: UseMapOptions) {
  const prevThemeRef = useRef(theme);
  const createMap = useCallback(
    async (containerEl: HTMLDivElement): Promise<MapboxMap> => {
      type MapboxGL = (typeof import("mapbox-gl"))["default"];
      const mod = await import("mapbox-gl");
      const mapboxgl = (mod as unknown as { default: MapboxGL }).default;

      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container: containerEl,
        style: mapboxBasemapProvider.getStyle(theme),
        center: [11.0, 61.83],
        zoom: 10,
        pitch: 0,
        bearing: 0,
      });

      map.addControl(new mapboxgl.NavigationControl(), "top-right");
      map.on("load", () => {
        setIsLoaded(true);
      });

      return map;
    },
    [theme],
  );

  const { mapRef, isLoaded, setIsLoaded } = useManagedMap<MapboxMap>({
    container,
    createMap,
    onCreateError: (error) => {
      logError("Failed to initialize Mapbox map", error);
    },
  });

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;
    if (prevThemeRef.current === theme) return;
    prevThemeRef.current = theme;
    map.setStyle(mapboxBasemapProvider.getStyle(theme));
    setIsLoaded(false);
    map.once("style.load", () => {
      setIsLoaded(true);
    });
  }, [theme, isLoaded]);

  return { map: mapRef.current, isLoaded };
}
