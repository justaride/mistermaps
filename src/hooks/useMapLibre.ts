import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
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
  const mapRef = useRef<MapLibreMap | null>(null);
  const creatingRef = useRef(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!container.current || mapRef.current || creatingRef.current) return;
    creatingRef.current = true;

    let cancelled = false;

    void (async () => {
      const mod = await import("maplibre-gl");
      const maplibregl = (mod.default ?? mod) as unknown as typeof import("maplibre-gl");
      if (cancelled) return;

      const map = new maplibregl.Map({
        container: container.current!,
        style: STYLES[theme],
        center: [10.75, 59.91],
        zoom: 12,
      });

      map.addControl(new maplibregl.NavigationControl(), "top-right");

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
    if (!mapRef.current) return;
    mapRef.current.setStyle(STYLES[theme]);
  }, [theme]);

  return { map: mapRef.current, isLoaded };
}
