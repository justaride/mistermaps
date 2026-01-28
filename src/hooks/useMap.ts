import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import type { Theme } from "../types";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const STYLES: Record<Theme, string> = {
  light: "mapbox://styles/mapbox/light-v11",
  dark: "mapbox://styles/mapbox/dark-v11",
};

type UseMapOptions = {
  container: React.RefObject<HTMLDivElement | null>;
  theme: Theme;
};

export function useMap({ container, theme }: UseMapOptions) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!container.current || mapRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: container.current,
      style: STYLES[theme],
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

    return () => {
      map.remove();
      mapRef.current = null;
      setIsLoaded(false);
    };
  }, [container]);

  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;
    mapRef.current.setStyle(STYLES[theme]);
  }, [theme, isLoaded]);

  return { map: mapRef.current, isLoaded };
}
