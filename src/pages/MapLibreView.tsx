import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapLibreContainer, ThemeToggle } from "../components";
import type { Theme } from "../types";
import styles from "../App.module.css";

export default function MapLibreView() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <div className={`${styles.app} map-root`}>
      <MapLibreContainer theme={theme} />
      <div
        className="panel"
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 10,
          minWidth: 280,
          padding: 16,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 14 }}>MapLibre Quick Peek</div>
        <div
          style={{
            marginTop: 6,
            fontSize: 13,
            color: "var(--text-secondary)",
            lineHeight: 1.4,
          }}
        >
          Light: OpenStreetMap raster · Dark: CARTO Dark Matter raster
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
          <Link
            to="/map"
            className="secondary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              color: "var(--text-primary)",
              border: "1px solid var(--panel-border)",
              padding: "8px 12px",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Back to Mapbox
          </Link>
        </div>
      </div>
      <ThemeToggle theme={theme} onToggle={toggleTheme} />
    </div>
  );
}
