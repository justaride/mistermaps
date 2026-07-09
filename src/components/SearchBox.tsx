import { useEffect, useRef, useState } from "react";
import type { Map } from "mapbox-gl";
import { geocodingService } from "../providers/geocoding";
import styles from "./SearchBox.module.css";

type Props = {
  map: Map | null;
};

type SearchResult = {
  id: string;
  place_name: string;
  center: [number, number];
  providerId: string;
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function providerLabel(providerId: string): string {
  switch (providerId) {
    case "mapbox":
      return "Mapbox";
    case "nominatim":
      return "Nominatim";
    case "photon":
      return "Photon";
    default:
      return providerId;
  }
}

export function SearchBox({ map }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!rootRef.current) return;
      const target = event.target;
      if (target instanceof Node && rootRef.current.contains(target)) return;
      setIsOpen(false);
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      abortRef.current?.abort();
    };
  }, []);

  const runSearch = async (rawQuery: string) => {
    const trimmed = rawQuery.trim();
    if (!trimmed) {
      abortRef.current?.abort();
      setResults([]);
      setIsOpen(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await geocodingService.geocode(
        { query: trimmed, limit: 5 },
        controller.signal,
      );

      setResults(
        response.results.map((result) => ({
          id: result.id,
          place_name: result.placeName,
          center: result.center,
          providerId: result.providerId,
        })),
      );
      setIsOpen(true);
    } catch (error) {
      if (isAbortError(error)) return;
      setResults([]);
      setIsOpen(false);
    }
  };

  const handleInputChange = (value: string) => {
    setQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      void runSearch(value);
    }, 300);
  };

  const handleSelect = (result: SearchResult) => {
    if (!map) return;

    map.flyTo({
      center: result.center,
      zoom: 14,
      duration: 1500,
    });

    setQuery(result.place_name.split(",")[0] ?? result.place_name);
    setIsOpen(false);
    setResults([]);
  };

  return (
    <div ref={rootRef} className={styles.container}>
      <input
        type="text"
        value={query}
        onChange={(event) => handleInputChange(event.target.value)}
        onFocus={() => {
          if (results.length > 0) {
            setIsOpen(true);
          }
        }}
        placeholder="Search location..."
        className={`panel ${styles.input}`}
      />

      {isOpen && results.length > 0 && (
        <ul className={`panel ${styles.results}`}>
          {results.map((result) => (
            <li
              key={result.id}
              onClick={() => handleSelect(result)}
              className={styles.result}
            >
              <div className={styles.resultRow}>
                <span className={styles.placeName}>{result.place_name}</span>
                <span className={styles.providerTag}>
                  {providerLabel(result.providerId)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
