import { useEffect, useRef } from "react";
import type { Map } from "maplibre-gl";
import { useMapLibre } from "../hooks/useMapLibre";
import type { Theme } from "../types";
import styles from "./MapContainer.module.css";

type Props = {
  theme: Theme;
  onMapReady?: (map: Map) => void;
};

export function MapLibreContainer({ theme, onMapReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { map, isLoaded } = useMapLibre({ container: containerRef, theme });

  useEffect(() => {
    if (map && isLoaded) {
      onMapReady?.(map);
    }
  }, [map, isLoaded, onMapReady]);

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
