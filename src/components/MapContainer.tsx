import { useRef, useEffect, useState } from "react";
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
  const styleGenRef = useRef(0);
  const [setupComplete, setSetupComplete] = useState(false);

  useEffect(() => {
    if (map && isLoaded) {
      onMapReady(map);
    }
  }, [map, isLoaded, onMapReady]);

  useEffect(() => {
    if (!map || !isLoaded) return;

    if (activePatternRef.current) {
      activePatternRef.current.cleanup(map);
      activePatternRef.current = null;
    }
    setSetupComplete(false);

    if (pattern) {
      styleGenRef.current++;
      const gen = styleGenRef.current;

      const setupPattern = async () => {
        if (gen !== styleGenRef.current) return;
        await pattern.setup(map, controlValues);
        if (gen !== styleGenRef.current) return;
        activePatternRef.current = pattern;
        setSetupComplete(true);
      };

      if (map.isStyleLoaded()) {
        setupPattern();
      } else {
        map.once("style.load", setupPattern);
      }
    }
  }, [map, isLoaded, pattern?.id]);

  useEffect(() => {
    if (!map || !isLoaded || !pattern || !setupComplete) return;
    if (activePatternRef.current?.id === pattern.id) {
      pattern.update(map, controlValues);
    }
  }, [map, isLoaded, pattern, controlValues, setupComplete]);

  return <div ref={containerRef} className={styles.container} />;
}
