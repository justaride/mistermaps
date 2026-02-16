import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { useMap } from "../hooks/useMap";
import type { ControlValues, Pattern, PatternId, Theme } from "../types";
import { logError } from "../utils/logger";
import styles from "./MapContainer.module.css";

type Props = {
  theme: Theme;
  patterns: Pattern[];
  controlValuesByPattern: Partial<Record<PatternId, ControlValues>>;
  onMapReady?: (map: MapboxMap) => void;
};

export function MapContainerMulti({
  theme,
  patterns,
  controlValuesByPattern,
  onMapReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { map, isLoaded } = useMap({ container: containerRef, theme });

  const patternsRef = useRef(patterns);
  patternsRef.current = patterns;

  const controlValuesRef = useRef(controlValuesByPattern);
  controlValuesRef.current = controlValuesByPattern;

  const activeIdsRef = useRef<Set<PatternId>>(new Set());
  const desiredIdsRef = useRef<Set<PatternId>>(new Set());
  const inflightIdsRef = useRef<Set<PatternId>>(new Set());
  const setupTokenRef = useRef<Partial<Record<PatternId, number>>>({});
  const styleGenRef = useRef(0);

  useEffect(() => {
    if (map && isLoaded) {
      onMapReady?.(map);
    }
  }, [map, isLoaded, onMapReady]);

  useEffect(() => {
    if (!map) return;

    if (!isLoaded) {
      // Style reload resets layers/sources but not DOM or event handlers. Always cleanup.
      styleGenRef.current++;
      const activeIds = Array.from(activeIdsRef.current);
      const activePatterns = patternsRef.current.filter((p) =>
        activeIdsRef.current.has(p.id),
      );
      for (const pattern of activePatterns) {
        try {
          pattern.cleanup(map);
        } catch (error) {
          logError(`Pattern cleanup failed during style reset (${pattern.id})`, error);
        }
      }
      activeIdsRef.current.clear();

      // Invalidate any in-flight setups so they self-cleanup on resolve.
      for (const id of activeIds) {
        setupTokenRef.current[id] = (setupTokenRef.current[id] ?? 0) + 1;
      }

      return;
    }

    const desired = new Set(patterns.map((p) => p.id));
    desiredIdsRef.current = desired;

    const byId = new Map<PatternId, Pattern>();
    for (const p of patterns) byId.set(p.id, p);

    // Disable removed patterns.
    for (const activeId of Array.from(activeIdsRef.current)) {
      if (desired.has(activeId)) continue;
      const pattern = byId.get(activeId);
      if (pattern) {
        try {
          pattern.cleanup(map);
        } catch (error) {
          logError(`Pattern cleanup failed while disabling (${pattern.id})`, error);
        }
      }
      activeIdsRef.current.delete(activeId);
      setupTokenRef.current[activeId] = (setupTokenRef.current[activeId] ?? 0) + 1;
    }

    // Setup newly enabled patterns.
    for (const pattern of patterns) {
      if (activeIdsRef.current.has(pattern.id)) continue;
      if (inflightIdsRef.current.has(pattern.id)) continue;

      const token = (setupTokenRef.current[pattern.id] ?? 0) + 1;
      setupTokenRef.current[pattern.id] = token;
      const styleGen = styleGenRef.current;
      inflightIdsRef.current.add(pattern.id);

      const controls = controlValuesRef.current[pattern.id] ?? {};

      void Promise.resolve()
        .then(() => pattern.setup(map, controls))
        .then(() => {
          inflightIdsRef.current.delete(pattern.id);

          const isStillDesired = desiredIdsRef.current.has(pattern.id);
          const isStillCurrentStyle = styleGenRef.current === styleGen;
          const isStillCurrentToken = setupTokenRef.current[pattern.id] === token;

          if (!isStillDesired || !isStillCurrentStyle || !isStillCurrentToken) {
            try {
              pattern.cleanup(map);
            } catch (error) {
              logError(`Pattern cleanup failed after stale setup (${pattern.id})`, error);
            }
            return;
          }

          activeIdsRef.current.add(pattern.id);

          // If controls changed while setup was running, bring it up to date.
          const latestControls = controlValuesRef.current[pattern.id] ?? {};
          try {
            pattern.update(map, latestControls);
          } catch (error) {
            logError(`Pattern update failed after setup (${pattern.id})`, error);
          }
        })
        .catch((error) => {
          inflightIdsRef.current.delete(pattern.id);
          logError(`Pattern setup failed (${pattern.id})`, error);
        });
    }
  }, [map, isLoaded, patterns]);

  useEffect(() => {
    if (!map || !isLoaded) return;

    for (const pattern of patterns) {
      if (!activeIdsRef.current.has(pattern.id)) continue;
      try {
        pattern.update(map, controlValuesByPattern[pattern.id] ?? {});
      } catch (error) {
        logError(`Pattern update failed (${pattern.id})`, error);
      }
    }
  }, [map, isLoaded, patterns, controlValuesByPattern]);

  useEffect(() => {
    if (!map) return;
    return () => {
      for (const pattern of patternsRef.current) {
        if (!activeIdsRef.current.has(pattern.id)) continue;
        try {
          pattern.cleanup(map);
        } catch (error) {
          logError(`Pattern cleanup failed on unmount (${pattern.id})`, error);
        }
      }
      activeIdsRef.current.clear();
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
