import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type { Theme } from "../types";

const STYLES: Record<Theme, string> = {
  light: "https://tiles.openfreemap.org/styles/bright",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

type UseMapLibreOptions = {
  container: React.RefObject<HTMLDivElement | null>;
  theme: Theme;
};

export function useMapLibre({ container, theme }: UseMapLibreOptions) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!container.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: container.current,
      style: STYLES[theme],
      center: [10.75, 59.91],
      zoom: 12,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

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
    if (!mapRef.current) return;
    mapRef.current.setStyle(STYLES[theme]);
  }, [theme]);

  return { map: mapRef.current, isLoaded };
}

