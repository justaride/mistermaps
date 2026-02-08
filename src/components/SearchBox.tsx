import { useState, useRef, useEffect } from "react";
import type { Map } from "mapbox-gl";
import styles from "./SearchBox.module.css";
import { geocodingService } from "../providers/geocoding";

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

function getProviderLabel(providerId: string): string {
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
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const abortControllerRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      abortControllerRef.current?.abort();
    };
  }, []);

  const search = async (q: string) => {
    if (!q.trim()) {
      abortControllerRef.current?.abort();
      setResults([]);
      setIsOpen(false);
      return;
    }

    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await geocodingService.geocode(
        {
          query: q,
          limit: 5,
        },
        abortController.signal,
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

  const handleInput = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  };

  const handleSelect = (result: SearchResult) => {
    if (!map) return;
    map.flyTo({
      center: result.center,
      zoom: 14,
      duration: 1500,
    });
    setQuery(result.place_name.split(",")[0]);
    setIsOpen(false);
    setResults([]);
  };

  return (
    <div ref={containerRef} className={styles.container}>
      <input
        type="text"
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => results.length > 0 && setIsOpen(true)}
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
                  {getProviderLabel(result.providerId)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
