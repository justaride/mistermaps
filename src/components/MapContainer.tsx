import { useEffect, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { useMap } from "../hooks/useMap";
import type { ControlValues, Pattern, Theme } from "../types";
import { logError } from "../utils/logger";
import styles from "./MapContainer.module.css";

type Props = {
  theme: Theme;
  pattern: Pattern | null;
  controlValues: ControlValues;
  onMapReady?: (map: MapboxMap) => void;
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
  const setupTokenRef = useRef(0);
  const [isPatternReady, setIsPatternReady] = useState(false);

  useEffect(() => {
    if (map && isLoaded) {
      onMapReady?.(map);
    }
  }, [map, isLoaded, onMapReady]);

  useEffect(() => {
    if (!map || !isLoaded) return;

    if (activePatternRef.current) {
      try {
        activePatternRef.current.cleanup(map);
      } catch (error) {
        logError(
          `Pattern cleanup failed (${activePatternRef.current.id})`,
          error,
        );
      }
      activePatternRef.current = null;
    }

    setIsPatternReady(false);

    if (!pattern) return;

    setupTokenRef.current += 1;
    const token = setupTokenRef.current;

    const setupPattern = async () => {
      if (token !== setupTokenRef.current) return;

      try {
        await pattern.setup(map, controlValues);
      } catch (error) {
        logError(`Pattern setup failed (${pattern.id})`, error);
        return;
      }

      if (token !== setupTokenRef.current) return;

      activePatternRef.current = pattern;
      setIsPatternReady(true);
    };

    if (map.isStyleLoaded()) {
      void setupPattern();
      return;
    }

    map.once("style.load", setupPattern);

    return () => {
      map.off("style.load", setupPattern);
    };
  }, [map, isLoaded, pattern?.id]);

  useEffect(() => {
    if (!map || !isLoaded || !pattern || !isPatternReady) return;
    if (activePatternRef.current?.id !== pattern.id) return;

    try {
      pattern.update(map, controlValues);
    } catch (error) {
      logError(`Pattern update failed (${pattern.id})`, error);
    }
  }, [map, isLoaded, pattern, controlValues, isPatternReady]);

  useEffect(() => {
    if (!map) return;

    return () => {
      if (!activePatternRef.current) return;
      try {
        activePatternRef.current.cleanup(map);
      } catch (error) {
        logError(
          `Pattern cleanup failed on unmount (${activePatternRef.current.id})`,
          error,
        );
      }
      activePatternRef.current = null;
    };
  }, [map]);

  return (
    <>
      <div ref={containerRef} className={styles.container} />
      {(!map || !isLoaded) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-bg/80 font-mono text-xs text-muted">
          Loading map...
        </div>
      )}
    </>
  );
}
