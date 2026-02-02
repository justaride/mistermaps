import { useState, useCallback, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import type { Map } from "mapbox-gl";
import { ArrowLeft } from "lucide-react";
import {
  MapContainer,
  MapLibreContainer,
  ControlsPanel,
  CodeViewer,
  ThemeToggle,
  SearchBox,
} from "../components";
import { catalogPatterns } from "../patterns";
import type { Theme } from "../types";
import styles from "../App.module.css";

export default function MapDetail() {
  const { id } = useParams<{ id: string }>();
  const isMaplibre = id === "maplibre";

  const pattern = isMaplibre
    ? null
    : catalogPatterns.find((p) => p.id === id) || null;

  const [theme, setTheme] = useState<Theme>("light");
  const [controlValues, setControlValues] = useState<Record<string, unknown>>(
    () => {
      if (!pattern) return {};
      const defaults: Record<string, unknown> = {};
      pattern.controls.forEach((c) => {
        defaults[c.id] = c.defaultValue;
      });
      return defaults;
    },
  );
  const [codeViewerOpen, setCodeViewerOpen] = useState(false);
  const [map, setMap] = useState<Map | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const handleMapReady = useCallback((mapInstance: Map) => {
    setMap(mapInstance);
  }, []);

  const handleControlChange = (controlId: string, value: unknown) => {
    setControlValues((prev) => ({ ...prev, [controlId]: value }));
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  if (!isMaplibre && !pattern) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg text-fg">
        <p className="mb-4 font-mono text-lg">Pattern not found</p>
        <Link
          to="/maps"
          className="font-mono text-sm text-accent hover:underline"
        >
          Back to catalog
        </Link>
      </div>
    );
  }

  return (
    <div className={`${styles.app} map-root`}>
      {isMaplibre ? (
        <MapLibreContainer theme={theme} />
      ) : (
        <MapContainer
          theme={theme}
          pattern={pattern}
          controlValues={controlValues}
          onMapReady={handleMapReady}
        />
      )}

      {!isMaplibre && <SearchBox map={map} />}

      <div className="absolute left-4 top-4 z-10">
        <Link
          to="/maps"
          className="inline-flex items-center gap-2 border-2 border-border bg-card px-3 py-1.5 font-mono text-xs font-bold text-fg transition-transform hover:-translate-y-0.5"
          style={{ boxShadow: "2px 2px 0 var(--color-border)" }}
        >
          <ArrowLeft className="h-3 w-3" /> Back to Maps
        </Link>
      </div>

      {!isMaplibre && pattern && (
        <>
          <ControlsPanel
            controls={pattern.controls}
            values={controlValues}
            onChange={handleControlChange}
            onViewCode={() => setCodeViewerOpen(true)}
          />
          <CodeViewer
            code={pattern.snippet}
            isOpen={codeViewerOpen}
            theme={theme}
            onClose={() => setCodeViewerOpen(false)}
          />
        </>
      )}

      <ThemeToggle theme={theme} onToggle={toggleTheme} />
    </div>
  );
}
