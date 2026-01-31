import { useEffect, useRef, useState } from "react";
import maplibregl, { type StyleSpecification } from "maplibre-gl";
import type { Theme } from "../types";

const STYLES: Record<Theme, StyleSpecification> = {
  light: {
    version: 8,
    sources: {
      "osm-raster": {
        type: "raster",
        tiles: [
          "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution: "&copy; OpenStreetMap contributors",
      },
    },
    layers: [
      {
        id: "osm-raster",
        type: "raster",
        source: "osm-raster",
      },
    ],
  },
  dark: {
    version: 8,
    sources: {
      "carto-dark": {
        type: "raster",
        tiles: [
          "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        ],
        tileSize: 256,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      },
    },
    layers: [
      {
        id: "carto-dark",
        type: "raster",
        source: "carto-dark",
      },
    ],
  },
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
      center: [11.0, 61.83],
      zoom: 10,
      pitch: 0,
      bearing: 0,
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
    if (!mapRef.current || !isLoaded) return;
    mapRef.current.setStyle(STYLES[theme]);
    setIsLoaded(false);
    mapRef.current.once("style.load", () => {
      setIsLoaded(true);
    });
  }, [theme, isLoaded]);

  return { map: mapRef.current, isLoaded };
}

