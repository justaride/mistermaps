import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import type { Map } from "mapbox-gl";
import {
  MapContainer,
  PatternSelector,
  ControlsPanel,
  CodeViewer,
  ThemeToggle,
  SearchBox,
} from "../components";
import { patterns } from "../patterns";
import type { ControlValue, ControlValues, PatternId, Theme } from "../types";
import styles from "../App.module.css";

export default function MapView() {
  const [searchParams] = useSearchParams();
  const initialPattern =
    (searchParams.get("pattern") as PatternId) || "rendalen-data";

  const [theme, setTheme] = useState<Theme>("light");
  const [activePatternId, setActivePatternId] =
    useState<PatternId>(initialPattern);
  const getDefaults = (patternId: PatternId): ControlValues => {
    const p = patterns.find((p) => p.id === patternId);
    if (!p) return {};
    const defaults: ControlValues = {};
    p.controls.forEach((c) => {
      defaults[c.id] = c.defaultValue;
    });
    return defaults;
  };

  const [controlValues, setControlValues] = useState<ControlValues>(
    () => getDefaults(initialPattern),
  );
  const [codeViewerOpen, setCodeViewerOpen] = useState(false);
  const [map, setMap] = useState<Map | null>(null);

  const activePattern = patterns.find((p) => p.id === activePatternId) || null;

  useEffect(() => {
    setControlValues(getDefaults(activePatternId));
  }, [activePatternId]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const handleMapReady = useCallback((mapInstance: Map) => {
    setMap(mapInstance);
  }, []);

  const handlePatternSelect = (id: PatternId) => {
    setActivePatternId(id);
    setCodeViewerOpen(false);
  };

  const handleControlChange = (id: string, value: ControlValue) => {
    setControlValues((prev) => ({ ...prev, [id]: value }));
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <div className={`${styles.app} map-root`}>
      <MapContainer
        theme={theme}
        pattern={activePattern}
        controlValues={controlValues}
        onMapReady={handleMapReady}
      />
      <SearchBox map={map} />
      <PatternSelector
        patterns={patterns}
        activePattern={activePatternId}
        onSelect={handlePatternSelect}
      />
      <ControlsPanel
        controls={activePattern?.controls || []}
        values={controlValues}
        onChange={handleControlChange}
        onViewCode={() => setCodeViewerOpen(true)}
      />
      <ThemeToggle theme={theme} onToggle={toggleTheme} />
      <CodeViewer
        code={activePattern?.snippet || ""}
        isOpen={codeViewerOpen}
        theme={theme}
        onClose={() => setCodeViewerOpen(false)}
      />
    </div>
  );
}
