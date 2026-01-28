import { useRef, useEffect } from "react";
import type { Map } from "mapbox-gl";
import { useMap } from "../hooks/useMap";
import type { Theme, Pattern } from "../types";
import styles from "./MapContainer.module.css";

type Props = {
  theme: Theme;
  pattern: Pattern | null;
  controlValues: Record<string, unknown>;
  onMapReady: (map: Map) => void;
};

export function MapContainer({
  theme,
  pattern,
  controlValues,
  onMapReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { map, isLoaded } = useMap({ container: containerRef, theme });
  const activePatternRef = useRef<Pattern | null>(null);

  useEffect(() => {
    if (map && isLoaded) {
      onMapReady(map);
    }
  }, [map, isLoaded, onMapReady]);

  useEffect(() => {
    if (!map || !isLoaded) return;

    if (
      activePatternRef.current &&
      activePatternRef.current.id !== pattern?.id
    ) {
      activePatternRef.current.cleanup(map);
    }

    if (pattern && activePatternRef.current?.id !== pattern.id) {
      const styleLoadHandler = () => {
        pattern.setup(map, controlValues);
        activePatternRef.current = pattern;
      };

      if (map.isStyleLoaded()) {
        styleLoadHandler();
      } else {
        map.once("style.load", styleLoadHandler);
      }
    }
  }, [map, isLoaded, pattern?.id]);

  useEffect(() => {
    if (!map || !isLoaded || !pattern) return;
    if (activePatternRef.current?.id === pattern.id) {
      pattern.update(map, controlValues);
    }
  }, [map, isLoaded, pattern, controlValues]);

  return <div ref={containerRef} className={styles.container} />;
}
