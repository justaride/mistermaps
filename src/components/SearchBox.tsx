import { useState, useRef, useEffect } from "react";
import type { Map } from "mapbox-gl";
import styles from "./SearchBox.module.css";

type Props = {
  map: Map | null;
};

type SearchResult = {
  id: string;
  place_name: string;
  center: [number, number];
};

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export function SearchBox({ map }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
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

  const search = async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&limit=5`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      setResults(
        data.features?.map(
          (f: {
            id: string;
            place_name: string;
            center: [number, number];
          }) => ({
            id: f.id,
            place_name: f.place_name,
            center: f.center,
          }),
        ) || [],
      );
      setIsOpen(true);
    } catch {
      setResults([]);
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
              {result.place_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
