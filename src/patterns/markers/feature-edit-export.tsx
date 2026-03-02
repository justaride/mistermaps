import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import type { Pattern, PatternViewProps, Theme } from "../../types";
import { mapboxBasemapProvider } from "../../providers";
import { downloadText } from "../utils/export";
import { once } from "../utils/map-compat";
import { loadMapboxGL } from "../utils/load-map-engine";
import {
  createLineFeature,
  createPointFeature,
  createPolygonFeature,
  emptyCollection,
  getGeometryCounts,
  normalizeImportedGeometry,
  toDraftCollection,
  toFeatureCollection,
  toVertexCollection,
  updateFeatureVertex,
  type DrawFeature,
  type DrawMode,
} from "./draw-core";

type CameraState = {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
};

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const FEATURE_SOURCE_ID = "feature-edit-features-src";
const FEATURE_FILL_LAYER_ID = "feature-edit-fill-lyr";
const FEATURE_LINE_LAYER_ID = "feature-edit-line-lyr";
const FEATURE_POINT_LAYER_ID = "feature-edit-point-lyr";
const DRAFT_SOURCE_ID = "feature-edit-draft-src";
const DRAFT_LAYER_ID = "feature-edit-draft-lyr";
const VERTEX_SOURCE_ID = "feature-edit-vertices-src";
const VERTEX_LAYER_ID = "feature-edit-vertices-lyr";

function styleFor(theme: Theme): string {
  return mapboxBasemapProvider.getStyle(theme);
}

function getCamera(map: MapboxMap): CameraState {
  const c = map.getCenter();
  return {
    center: [c.lng, c.lat],
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  };
}

function ensureLayers(map: MapboxMap) {
  if (!map.getSource(FEATURE_SOURCE_ID)) {
    map.addSource(FEATURE_SOURCE_ID, {
      type: "geojson",
      data: toFeatureCollection([]),
    });
  }

  if (!map.getSource(DRAFT_SOURCE_ID)) {
    map.addSource(DRAFT_SOURCE_ID, {
      type: "geojson",
      data: emptyCollection(),
    });
  }

  if (!map.getSource(VERTEX_SOURCE_ID)) {
    map.addSource(VERTEX_SOURCE_ID, {
      type: "geojson",
      data: emptyCollection(),
    });
  }

  if (!map.getLayer(FEATURE_FILL_LAYER_ID)) {
    map.addLayer({
      id: FEATURE_FILL_LAYER_ID,
      type: "fill",
      source: FEATURE_SOURCE_ID,
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: {
        "fill-color": "#22c55e",
        "fill-opacity": 0.25,
      },
    });
  }

  if (!map.getLayer(FEATURE_LINE_LAYER_ID)) {
    map.addLayer({
      id: FEATURE_LINE_LAYER_ID,
      type: "line",
      source: FEATURE_SOURCE_ID,
      filter: [
        "any",
        ["==", ["geometry-type"], "LineString"],
        ["==", ["geometry-type"], "Polygon"],
      ],
      paint: {
        "line-color": "#16a34a",
        "line-width": 3,
      },
    });
  }

  if (!map.getLayer(FEATURE_POINT_LAYER_ID)) {
    map.addLayer({
      id: FEATURE_POINT_LAYER_ID,
      type: "circle",
      source: FEATURE_SOURCE_ID,
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-radius": 6,
        "circle-color": "#16a34a",
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 2,
      },
    });
  }

  if (!map.getLayer(DRAFT_LAYER_ID)) {
    map.addLayer({
      id: DRAFT_LAYER_ID,
      type: "line",
      source: DRAFT_SOURCE_ID,
      paint: {
        "line-color": "#f97316",
        "line-width": 3,
        "line-dasharray": [1, 1],
      },
    });
  }

  if (!map.getLayer(VERTEX_LAYER_ID)) {
    map.addLayer({
      id: VERTEX_LAYER_ID,
      type: "circle",
      source: VERTEX_SOURCE_ID,
      paint: {
        "circle-radius": 6,
        "circle-color": "#ef4444",
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 2,
      },
    });
  }
}

function FeatureEditExportView({ theme, onPrimaryMapReady }: PatternViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const recreateTokenRef = useRef(0);

  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<DrawMode>("point");
  const [features, setFeatures] = useState<DrawFeature[]>([]);
  const [draftCoords, setDraftCoords] = useState<[number, number][]>([]);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [status, setStatus] = useState("Draw features, edit vertices, then export/import.");

  const [propertiesText, setPropertiesText] = useState("{}");
  const [ioText, setIoText] = useState("");
  const [propertyError, setPropertyError] = useState("");
  const [importError, setImportError] = useState("");

  const modeRef = useRef<DrawMode>(mode);
  const featuresRef = useRef<DrawFeature[]>(features);
  const draftCoordsRef = useRef<[number, number][]>(draftCoords);
  const selectedFeatureIdRef = useRef<string | null>(selectedFeatureId);
  const nextFeatureIdRef = useRef(1);
  const draggingVertexRef = useRef<{ featureId: string; vertexIndex: number } | null>(
    null,
  );

  const style = styleFor(theme);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    featuresRef.current = features;
    const map = mapRef.current;
    if (!map || !loaded) return;

    const src = map.getSource(FEATURE_SOURCE_ID) as GeoJSONSource | undefined;
    src?.setData(toFeatureCollection(features));
  }, [features, loaded]);

  useEffect(() => {
    draftCoordsRef.current = draftCoords;
    const map = mapRef.current;
    if (!map || !loaded) return;

    const src = map.getSource(DRAFT_SOURCE_ID) as GeoJSONSource | undefined;
    src?.setData(toDraftCollection(modeRef.current, draftCoords));
  }, [draftCoords, loaded]);

  const selectedFeature = useMemo(
    () => features.find((feature) => String(feature.id) === selectedFeatureId) ?? null,
    [features, selectedFeatureId],
  );

  useEffect(() => {
    selectedFeatureIdRef.current = selectedFeatureId;
    const map = mapRef.current;
    if (!map || !loaded) return;

    const src = map.getSource(VERTEX_SOURCE_ID) as GeoJSONSource | undefined;
    const shouldShowVertices = mode === "edit" && selectedFeature !== null;
    src?.setData(shouldShowVertices ? toVertexCollection(selectedFeature) : emptyCollection());
  }, [loaded, mode, selectedFeature, selectedFeatureId]);

  useEffect(() => {
    if (!selectedFeature) {
      setPropertiesText("{}");
      return;
    }
    setPropertiesText(JSON.stringify(selectedFeature.properties ?? {}, null, 2));
  }, [selectedFeature]);

  const resetDraft = () => {
    setDraftCoords([]);
  };

  const finalizeDraft = useCallback(() => {
    const currentMode = modeRef.current;
    const currentDraft = draftCoordsRef.current;

    if (currentMode === "line") {
      const id = `draw-${nextFeatureIdRef.current}`;
      const feature = createLineFeature(
        id,
        currentDraft,
        `Line ${nextFeatureIdRef.current}`,
      );
      if (!feature) {
        setStatus("Line requires at least 2 vertices.");
        return;
      }

      nextFeatureIdRef.current += 1;
      setFeatures((prev) => [...prev, feature]);
      setSelectedFeatureId(String(feature.id));
      setDraftCoords([]);
      setStatus("Line created.");
      return;
    }

    if (currentMode === "polygon") {
      const id = `draw-${nextFeatureIdRef.current}`;
      const feature = createPolygonFeature(
        id,
        currentDraft,
        `Polygon ${nextFeatureIdRef.current}`,
      );
      if (!feature) {
        setStatus("Polygon requires at least 3 vertices.");
        return;
      }

      nextFeatureIdRef.current += 1;
      setFeatures((prev) => [...prev, feature]);
      setSelectedFeatureId(String(feature.id));
      setDraftCoords([]);
      setStatus("Polygon created.");
    }
  }, []);

  const handleMapClick = useCallback((event: unknown) => {
    const map = mapRef.current;
    if (!map) return;

    const ev = event as {
      lngLat?: { lng: number; lat: number };
      point?: { x: number; y: number };
    };

    if (!ev.lngLat || !ev.point) return;

    const currentMode = modeRef.current;
    const coord: [number, number] = [ev.lngLat.lng, ev.lngLat.lat];

    if (currentMode === "point") {
      const feature = createPointFeature(
        `draw-${nextFeatureIdRef.current}`,
        coord,
        `Point ${nextFeatureIdRef.current}`,
      );
      nextFeatureIdRef.current += 1;
      setFeatures((prev) => [...prev, feature]);
      setSelectedFeatureId(String(feature.id));
      setStatus("Point added.");
      return;
    }

    if (currentMode === "line" || currentMode === "polygon") {
      setDraftCoords((prev) => [...prev, coord]);
      setStatus("Vertex added. Double-click to finish geometry.");
      return;
    }

    const hit = map.queryRenderedFeatures([ev.point.x, ev.point.y], {
      layers: [FEATURE_POINT_LAYER_ID, FEATURE_LINE_LAYER_ID, FEATURE_FILL_LAYER_ID],
    })[0];

    const hitId =
      typeof hit?.id === "string" || typeof hit?.id === "number"
        ? String(hit.id)
        : null;

    if (currentMode === "delete") {
      if (!hitId) {
        setStatus("Click a feature to delete it.");
        return;
      }

      setFeatures((prev) => prev.filter((feature) => String(feature.id) !== hitId));
      setSelectedFeatureId((prev) => (prev === hitId ? null : prev));
      setStatus("Feature deleted.");
      return;
    }

    if (currentMode === "edit") {
      if (!hitId) {
        setSelectedFeatureId(null);
        setStatus("No feature selected.");
        return;
      }

      setSelectedFeatureId(hitId);
      setStatus("Feature selected. Drag red vertices to edit.");
    }
  }, []);

  const handleMapDoubleClick = useCallback((event: unknown) => {
    const ev = event as { preventDefault?: () => void };
    if (modeRef.current !== "line" && modeRef.current !== "polygon") return;
    ev.preventDefault?.();
    finalizeDraft();
  }, [finalizeDraft]);

  const handleVertexMouseDown = useCallback((event: unknown) => {
    if (modeRef.current !== "edit") return;

    const map = mapRef.current;
    if (!map) return;

    const ev = event as {
      features?: Array<{ properties?: Record<string, unknown> }>;
      preventDefault?: () => void;
    };

    const props = ev.features?.[0]?.properties ?? {};
    const featureId = props.featureId;
    const vertexIndex = props.vertexIndex;

    if (typeof featureId !== "string" || typeof vertexIndex !== "number") {
      return;
    }

    draggingVertexRef.current = { featureId, vertexIndex };
    map.dragPan.disable();
    ev.preventDefault?.();
  }, []);

  const handleMouseMove = useCallback((event: unknown) => {
    const dragging = draggingVertexRef.current;
    if (!dragging) return;

    const ev = event as { lngLat?: { lng: number; lat: number } };
    if (!ev.lngLat) return;

    const nextCoord: [number, number] = [ev.lngLat.lng, ev.lngLat.lat];

    setFeatures((prev) =>
      prev.map((feature) => {
        if (String(feature.id) !== dragging.featureId) return feature;
        return updateFeatureVertex(feature, dragging.vertexIndex, nextCoord);
      }),
    );
  }, []);

  const handleMouseUp = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (draggingVertexRef.current) {
      draggingVertexRef.current = null;
      map.dragPan.enable();
      setStatus("Vertex updated.");
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const token = (recreateTokenRef.current += 1);
    const prev = mapRef.current;
    const camera = prev ? getCamera(prev) : null;

    if (prev) {
      try {
        prev.remove();
      } catch {
        // ignore
      }
      mapRef.current = null;
    }

    setLoaded(false);

    void (async () => {
      const mapboxgl = await loadMapboxGL();
      if (recreateTokenRef.current !== token) return;

      mapboxgl.accessToken = MAPBOX_TOKEN ?? "";
      const map = new mapboxgl.Map({
        container: containerRef.current!,
        style,
        center: camera?.center ?? [10.7522, 59.9139],
        zoom: camera?.zoom ?? 11,
        bearing: camera?.bearing ?? 0,
        pitch: camera?.pitch ?? 0,
      });
      map.addControl(new mapboxgl.NavigationControl(), "top-right");
      mapRef.current = map;

      map.on("load", () => {
        if (recreateTokenRef.current !== token) return;
        ensureLayers(map);

        (map.getSource(FEATURE_SOURCE_ID) as GeoJSONSource | undefined)?.setData(
          toFeatureCollection(featuresRef.current),
        );
        (map.getSource(DRAFT_SOURCE_ID) as GeoJSONSource | undefined)?.setData(
          toDraftCollection(modeRef.current, draftCoordsRef.current),
        );

        const selected = featuresRef.current.find(
          (feature) => String(feature.id) === selectedFeatureIdRef.current,
        );
        (map.getSource(VERTEX_SOURCE_ID) as GeoJSONSource | undefined)?.setData(
          modeRef.current === "edit" && selected
            ? toVertexCollection(selected)
            : emptyCollection(),
        );

        setLoaded(true);
        onPrimaryMapReady?.(map);
      });

      map.on("click", handleMapClick);
      map.on("dblclick", handleMapDoubleClick);
      map.on("mousedown", VERTEX_LAYER_ID, handleVertexMouseDown);
      map.on("mousemove", handleMouseMove);
      map.on("mouseup", handleMouseUp);
    })().catch(() => {
      setStatus("Failed to load map view.");
    });

    return () => {
      recreateTokenRef.current += 1;
      const map = mapRef.current;
      if (map) {
        map.off("click", handleMapClick);
        map.off("dblclick", handleMapDoubleClick);
        map.off("mousedown", VERTEX_LAYER_ID, handleVertexMouseDown);
        map.off("mousemove", handleMouseMove);
        map.off("mouseup", handleMouseUp);

        try {
          map.remove();
        } catch {
          // ignore
        }
      }
      mapRef.current = null;
    };
  }, [
    handleMapClick,
    handleMapDoubleClick,
    handleMouseMove,
    handleMouseUp,
    handleVertexMouseDown,
    onPrimaryMapReady,
    style,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    if (mode === "line" || mode === "polygon") {
      map.doubleClickZoom.disable();
    } else {
      map.doubleClickZoom.enable();
    }

    return () => {
      map.doubleClickZoom.enable();
    };
  }, [loaded, mode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    const camera = getCamera(map);
    map.setStyle(style);

    once(map, "style.load", () => {
      map.jumpTo(camera);
      ensureLayers(map);

      (map.getSource(FEATURE_SOURCE_ID) as GeoJSONSource | undefined)?.setData(
        toFeatureCollection(featuresRef.current),
      );
      (map.getSource(DRAFT_SOURCE_ID) as GeoJSONSource | undefined)?.setData(
        toDraftCollection(modeRef.current, draftCoordsRef.current),
      );

      const selected = featuresRef.current.find(
        (feature) => String(feature.id) === selectedFeatureIdRef.current,
      );
      (map.getSource(VERTEX_SOURCE_ID) as GeoJSONSource | undefined)?.setData(
        modeRef.current === "edit" && selected
          ? toVertexCollection(selected)
          : emptyCollection(),
      );
    });
  }, [loaded, style]);

  const modeHelp: Record<DrawMode, string> = {
    point: "Point mode: click map to add points.",
    line: "Line mode: click to add vertices, double-click to finish.",
    polygon: "Polygon mode: click to add vertices, double-click to finish.",
    edit: "Edit mode: select feature and drag vertices. Properties editable below.",
    delete: "Delete mode: click feature to remove.",
  };

  const applyProperties = () => {
    if (!selectedFeatureId) {
      setPropertyError("Select a feature first.");
      return;
    }

    try {
      const parsed = JSON.parse(propertiesText) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setPropertyError("Properties must be a JSON object.");
        return;
      }

      setFeatures((prev) =>
        prev.map((feature) =>
          String(feature.id) === selectedFeatureId
            ? {
                ...feature,
                properties: parsed as Record<string, unknown>,
              }
            : feature,
        ),
      );
      setPropertyError("");
      setStatus("Feature properties updated.");
    } catch {
      setPropertyError("Invalid JSON in properties editor.");
    }
  };

  const exportGeoJson = () => {
    const fc = toFeatureCollection(features);
    const text = JSON.stringify(fc, null, 2);
    setIoText(text);
    downloadText(
      `mister-maps-features-${Date.now()}.geojson`,
      text,
      "application/geo+json",
    );
    setStatus(`Exported ${features.length} feature(s).`);
  };

  const importGeoJson = () => {
    try {
      const parsed = JSON.parse(ioText) as GeoJSON.FeatureCollection;
      if (!parsed || parsed.type !== "FeatureCollection") {
        setImportError("Input must be a GeoJSON FeatureCollection.");
        return;
      }

      const imported: DrawFeature[] = [];

      for (const feature of parsed.features ?? []) {
        if (!feature || feature.type !== "Feature" || !feature.geometry) continue;

        const geometry = normalizeImportedGeometry(feature.geometry);
        if (!geometry) continue;

        const featureId =
          typeof feature.id === "string" || typeof feature.id === "number"
            ? String(feature.id)
            : `draw-${nextFeatureIdRef.current++}`;

        imported.push({
          id: featureId,
          type: "Feature",
          properties:
            feature.properties && typeof feature.properties === "object"
              ? (feature.properties as Record<string, unknown>)
              : {},
          geometry,
        });
      }

      setFeatures(imported);
      setSelectedFeatureId(imported[0]?.id ?? null);
      setDraftCoords([]);
      setImportError("");
      setStatus(`Imported ${imported.length} feature(s).`);
    } catch {
      setImportError("Invalid GeoJSON JSON payload.");
    }
  };

  const geometryCounts = useMemo(() => getGeometryCounts(features), [features]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="panel status-panel absolute left-4 top-16 z-10 w-[520px] p-3">
        <div className="status-panel__message">{modeHelp[mode]}</div>

        <div className="grid grid-cols-5 gap-1">
          {(["point", "line", "polygon", "edit", "delete"] as DrawMode[]).map(
            (candidateMode) => (
              <button
                key={candidateMode}
                type="button"
                className={`status-panel__button ${mode === candidateMode ? "primary" : ""}`}
                onClick={() => {
                  setMode(candidateMode);
                  if (candidateMode !== "line" && candidateMode !== "polygon") {
                    resetDraft();
                  }
                  setStatus(modeHelp[candidateMode]);
                }}
              >
                {candidateMode}
              </button>
            ),
          )}
        </div>

        <div className="status-panel__actions">
          <button
            type="button"
            className="status-panel__button"
            onClick={() => finalizeDraft()}
            disabled={!(mode === "line" || mode === "polygon")}
          >
            Finish geometry
          </button>
          <button
            type="button"
            className="status-panel__button"
            onClick={() => {
              setDraftCoords([]);
              setStatus("Draft cleared.");
            }}
          >
            Clear draft
          </button>
          <button
            type="button"
            className="status-panel__button"
            onClick={() => {
              setFeatures([]);
              setDraftCoords([]);
              setSelectedFeatureId(null);
              setStatus("All features cleared.");
            }}
          >
            Clear all
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 font-mono text-xs">
          <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
            <div className="text-muted">Points</div>
            <div className="text-fg">{geometryCounts.points}</div>
          </div>
          <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
            <div className="text-muted">Lines</div>
            <div className="text-fg">{geometryCounts.lines}</div>
          </div>
          <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
            <div className="text-muted">Polygons</div>
            <div className="text-fg">{geometryCounts.polygons}</div>
          </div>
          <div className="rounded-sm border border-border/40 bg-bg/50 p-2">
            <div className="text-muted">Selected</div>
            <div className="text-fg">{selectedFeatureId ?? "-"}</div>
          </div>
        </div>

        <div>
          <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-widest text-muted">
            Selected feature properties (JSON)
          </div>
          <textarea
            className="geojson-import__textarea"
            rows={4}
            value={propertiesText}
            onChange={(event) => setPropertiesText(event.target.value)}
            spellCheck={false}
          />
          <div className="status-panel__actions">
            <button
              type="button"
              className="status-panel__button"
              onClick={applyProperties}
            >
              Apply properties
            </button>
          </div>
          {propertyError ? <div className="text-xs text-danger">{propertyError}</div> : null}
        </div>

        <div>
          <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-widest text-muted">
            GeoJSON import / export
          </div>
          <textarea
            className="geojson-import__textarea"
            rows={6}
            value={ioText}
            onChange={(event) => setIoText(event.target.value)}
            placeholder="Paste GeoJSON FeatureCollection here..."
            spellCheck={false}
          />
          <div className="status-panel__actions">
            <button
              type="button"
              className="status-panel__button"
              onClick={exportGeoJson}
            >
              Export GeoJSON
            </button>
            <button
              type="button"
              className="status-panel__button primary"
              onClick={importGeoJson}
            >
              Import GeoJSON
            </button>
          </div>
          {importError ? <div className="text-xs text-danger">{importError}</div> : null}
        </div>

        <div className="text-xs text-muted">{status}</div>
      </div>
    </div>
  );
}

export const featureEditExportPattern: Pattern = {
  id: "feature-edit-export",
  name: "Feature Editing + Persist Export",
  category: "markers",
  description:
    "Edit geometries and properties, then export/import GeoJSON with round-trip preservation.",
  controls: [],
  disableGlobalSearch: true,
  setup() {},
  cleanup() {},
  update() {},
  view: FeatureEditExportView,
  snippet: `// Export current editable features
const fc = {
  type: 'FeatureCollection',
  features
};
const text = JSON.stringify(fc, null, 2);

// Later: import same JSON back and restore feature geometries + properties
const parsed = JSON.parse(text);
setFeatures(parsed.features);`,
};
