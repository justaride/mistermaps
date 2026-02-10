import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import type { Map } from "mapbox-gl";
import { ArrowLeft } from "lucide-react";
import "../map/engine-css";
import {
  MapContainer,
  ControlsPanel,
  CodeViewer,
  ThemeToggle,
  SearchBox,
} from "../components";
import { rendalenDataPattern } from "../patterns";
import type { Theme } from "../types";
import styles from "../App.module.css";

export default function RendalenProject() {
  const [theme, setTheme] = useState<Theme>("light");
  const [controlValues, setControlValues] = useState<Record<string, unknown>>(
    () => {
      const defaults: Record<string, unknown> = {};
      rendalenDataPattern.controls.forEach((c) => {
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

  return (
    <div className={`${styles.app} map-root`}>
      <MapContainer
        theme={theme}
        pattern={rendalenDataPattern}
        controlValues={controlValues}
        onMapReady={handleMapReady}
      />

      <SearchBox map={map} />

      <div className="absolute left-4 top-4 z-10 flex flex-col gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 border-2 border-border bg-card px-3 py-1.5 font-mono text-xs font-bold text-fg transition-transform hover:-translate-y-0.5"
          style={{ boxShadow: "2px 2px 0 var(--color-border)" }}
        >
          <ArrowLeft className="h-3 w-3" /> Home
        </Link>
        <div
          className="border-2 border-border bg-card/95 p-4 backdrop-blur-sm"
          style={{ boxShadow: "3px 3px 0 var(--color-border)", maxWidth: 320 }}
        >
          <h2 className="font-display text-lg tracking-wide">
            Rendalen Project
          </h2>
          <p className="mt-1 font-mono text-[11px] text-muted leading-relaxed">
            Norwegian public data from Kartverket, Naturbase, and NVE overlaid
            on Rendalen kommune. Toggle layers to explore boundaries, nature
            reserves, water bodies, and hiking trails.
          </p>
        </div>
      </div>

      <ControlsPanel
        controls={rendalenDataPattern.controls}
        values={controlValues}
        onChange={handleControlChange}
        onViewCode={() => setCodeViewerOpen(true)}
      />

      <CodeViewer
        code={rendalenDataPattern.snippet}
        isOpen={codeViewerOpen}
        theme={theme}
        onClose={() => setCodeViewerOpen(false)}
      />

      <ThemeToggle theme={theme} onToggle={toggleTheme} />
    </div>
  );
}
