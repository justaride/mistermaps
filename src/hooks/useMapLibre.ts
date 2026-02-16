import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Theme } from "../types";
import { useManagedMap } from "./useManagedMap";
import { logError } from "../utils/logger";

const STYLES: Record<Theme, string> = {
  light: "https://tiles.openfreemap.org/styles/bright",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

type UseMapLibreOptions = {
  container: RefObject<HTMLDivElement | null>;
  theme: Theme;
};

export function useMapLibre({ container, theme }: UseMapLibreOptions) {
  const prevThemeRef = useRef(theme);
  const createMap = useCallback(
    async (containerEl: HTMLDivElement): Promise<MapLibreMap> => {
      const mod = await import("maplibre-gl");
      const maplibregl = (mod.default ??
        mod) as unknown as typeof import("maplibre-gl");

      const map = new maplibregl.Map({
        container: containerEl,
        style: STYLES[theme],
        center: [10.75, 59.91],
        zoom: 12,
      });

      map.addControl(new maplibregl.NavigationControl(), "top-right");
      map.on("load", () => {
        setIsLoaded(true);
      });

      return map;
    },
    [theme],
  );

  const { mapRef, isLoaded, setIsLoaded } = useManagedMap<MapLibreMap>({
    container,
    createMap,
    onCreateError: (error) => {
      logError("Failed to initialize MapLibre map", error);
    },
  });

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;
    if (prevThemeRef.current === theme) return;
    prevThemeRef.current = theme;
    map.setStyle(STYLES[theme]);
    setIsLoaded(false);
    map.once("style.load", () => {
      setIsLoaded(true);
    });
  }, [theme, isLoaded]);

  return { map: mapRef.current, isLoaded };
}
