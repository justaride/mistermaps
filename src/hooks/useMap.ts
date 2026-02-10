import { useEffect, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { Theme } from "../types";
import { mapboxBasemapProvider } from "../providers/basemap";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

type UseMapOptions = {
  container: React.RefObject<HTMLDivElement | null>;
  theme: Theme;
};

export function useMap({ container, theme }: UseMapOptions) {
  const mapRef = useRef<MapboxMap | null>(null);
  const creatingRef = useRef(false);
  const prevThemeRef = useRef(theme);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!container.current || mapRef.current || creatingRef.current) return;
    creatingRef.current = true;

    let cancelled = false;

    void (async () => {
      type MapboxGL = (typeof import("mapbox-gl"))["default"];
      const mod = await import("mapbox-gl");
      const mapboxgl = (mod as unknown as { default: MapboxGL }).default;
      if (cancelled) return;

      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container: container.current!,
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

      mapRef.current = map;
    })()
      .catch(() => {
        // ignore
      })
      .finally(() => {
        creatingRef.current = false;
      });

    return () => {
      cancelled = true;
      const map = mapRef.current;
      if (map) {
        map.remove();
        mapRef.current = null;
      }
      creatingRef.current = false;
      setIsLoaded(false);
    };
  }, [container]);

  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;
    if (prevThemeRef.current === theme) return;
    prevThemeRef.current = theme;
    mapRef.current.setStyle(mapboxBasemapProvider.getStyle(theme));
    setIsLoaded(false);
    mapRef.current.once("style.load", () => {
      setIsLoaded(true);
    });
  }, [theme, isLoaded]);

  return { map: mapRef.current, isLoaded };
}
