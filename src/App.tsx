import { useState, useCallback, useEffect } from "react";
import type { Map } from "mapbox-gl";
import {
  MapContainer,
  PatternSelector,
  ControlsPanel,
  CodeViewer,
  ThemeToggle,
  SearchBox,
} from "./components";
import { patterns } from "./patterns";
import type { PatternId, Theme } from "./types";
import styles from "./App.module.css";

function App() {
  const [theme, setTheme] = useState<Theme>("light");
  const [activePatternId, setActivePatternId] = useState<PatternId>("heatmap");
  const [controlValues, setControlValues] = useState<Record<string, unknown>>(
    {},
  );
  const [codeViewerOpen, setCodeViewerOpen] = useState(false);
  const [map, setMap] = useState<Map | null>(null);

  const activePattern = patterns.find((p) => p.id === activePatternId) || null;

  useEffect(() => {
    if (activePattern) {
      const defaults: Record<string, unknown> = {};
      activePattern.controls.forEach((control) => {
        defaults[control.id] = control.defaultValue;
      });
      setControlValues(defaults);
    }
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

  const handleControlChange = (id: string, value: unknown) => {
    setControlValues((prev) => ({ ...prev, [id]: value }));
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <div className={styles.app}>
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

export default App;
