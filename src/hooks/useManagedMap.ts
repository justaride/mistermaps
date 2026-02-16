import { useEffect, useRef, useState, type RefObject } from "react";

type ManagedMap = {
  remove: () => void;
};

type UseManagedMapOptions<TMap extends ManagedMap> = {
  container: RefObject<HTMLDivElement | null>;
  createMap: (container: HTMLDivElement) => Promise<TMap>;
  onCreateError?: (error: unknown) => void;
};

export function useManagedMap<TMap extends ManagedMap>({
  container,
  createMap,
  onCreateError,
}: UseManagedMapOptions<TMap>) {
  const mapRef = useRef<TMap | null>(null);
  const creatingRef = useRef(false);
  const createMapRef = useRef(createMap);
  const [isLoaded, setIsLoaded] = useState(false);

  createMapRef.current = createMap;

  useEffect(() => {
    if (!container.current || mapRef.current || creatingRef.current) return;
    creatingRef.current = true;

    let cancelled = false;
    const containerEl = container.current;

    void createMapRef
      .current(containerEl)
      .then((map) => {
        if (cancelled) {
          map.remove();
          return;
        }

        mapRef.current = map;
      })
      .catch((error) => {
        onCreateError?.(error);
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

  return { mapRef, isLoaded, setIsLoaded };
}
