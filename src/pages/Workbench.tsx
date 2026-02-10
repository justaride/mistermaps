import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map } from "mapbox-gl";
import { Link } from "react-router-dom";
import { ArrowLeft, Code2, Copy, Eye, X } from "lucide-react";
import "../map/engine-css";
import {
  CodeViewer,
  MapContainerMulti,
  SearchBox,
  ThemeToggle,
} from "../components";
import { CATALOG } from "../data/catalog";
import { SUBCATEGORY_LABELS } from "../data/catalog-meta";
import { groupCatalog, type CatalogGroup } from "../data/catalog-utils";
import { loadPatternById } from "../patterns/loadCatalogPattern";
import type {
  CatalogEntry,
  ControlConfig,
  Pattern,
  PatternCategory,
  PatternId,
  Subcategory,
  Theme,
} from "../types";
import { buildAssistantPrompt } from "../utils/buildAssistantPrompt";
import { copyText } from "../patterns/utils/export";
import appStyles from "../App.module.css";
import styles from "./Workbench.module.css";

type MapboxCatalogEntry = CatalogEntry & {
  provider: "mapbox";
  patternId: PatternId;
  category: PatternCategory;
};

function isMapboxCatalogEntry(
  entry: CatalogEntry,
): entry is MapboxCatalogEntry {
  return entry.provider === "mapbox" && entry.patternId !== "maplibre";
}

const CONFLICT_GROUP_BY_PATTERN: Partial<Record<PatternId, string>> = {
  "distance-measurement": "draw-tools",
  "area-measurement": "draw-tools",
  "layer-inspector": "inspect-tools",
  "feature-state": "inspect-tools",
};

function defaultsForPattern(pattern: Pattern): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const control of pattern.controls) {
    defaults[control.id] = control.defaultValue;
  }
  return defaults;
}

function normalizeControlValues(
  pattern: Pattern,
  values: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const next = { ...(values ?? {}) };
  for (const control of pattern.controls) {
    if (!(control.id in next)) {
      next[control.id] = control.defaultValue;
    }
  }
  return next;
}

function controlDomId(patternId: PatternId, controlId: string): string {
  return `${patternId}__${controlId}`;
}

function renderControlInline(
  patternId: PatternId,
  config: ControlConfig,
  value: unknown,
  onChange: (controlId: string, value: unknown) => void,
) {
  const id = controlDomId(patternId, config.id);

  switch (config.type) {
    case "text":
      return (
        <input
          type="text"
          id={id}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(config.id, e.target.value)}
          className={styles.textInput}
        />
      );

    case "textarea":
      return (
        <textarea
          id={id}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(config.id, e.target.value)}
          className={`${styles.textInput} ${styles.textarea}`}
          rows={7}
          spellCheck={false}
        />
      );

    case "button":
      return (
        <button
          type="button"
          className={`secondary ${styles.inlineButton}`}
          onClick={() => onChange(config.id, Date.now())}
        >
          {config.label}
        </button>
      );

    case "slider":
      return (
        <div className={styles.sliderRow}>
          <input
            type="range"
            id={id}
            min={config.min}
            max={config.max}
            step={config.step}
            value={value as number}
            onChange={(e) => onChange(config.id, parseFloat(e.target.value))}
          />
          <span className={styles.sliderValue}>{value as number}</span>
        </div>
      );

    case "toggle":
      return (
        <div className={styles.toggleRow}>
          <div className={styles.toggleLabel}>{config.label}</div>
          <label className={styles.toggle} aria-label={config.label}>
            <input
              type="checkbox"
              id={id}
              checked={Boolean(value)}
              onChange={(e) => onChange(config.id, e.target.checked)}
            />
            <span className={styles.toggleSlider} />
          </label>
        </div>
      );

    case "select":
      return (
        <select
          id={id}
          value={value as string}
          onChange={(e) => onChange(config.id, e.target.value)}
        >
          {config.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );

    case "color":
      return (
        <input
          type="color"
          id={id}
          value={value as string}
          onChange={(e) => onChange(config.id, e.target.value)}
          className={styles.colorInput}
        />
      );

    default:
      return null;
  }
}

export default function Workbench() {
  const mapboxCatalog = useMemo(
    () =>
      CATALOG.filter(
        (entry): entry is MapboxCatalogEntry =>
          isMapboxCatalogEntry(entry) && entry.workbenchCompatible !== false,
      ),
    [],
  );

  const nameById = useMemo(() => {
    const record: Partial<Record<PatternId, string>> = {};
    for (const entry of mapboxCatalog) {
      record[entry.patternId] = entry.name;
    }
    return record;
  }, [mapboxCatalog]);

  const [theme, setTheme] = useState<Theme>("light");
  const [map, setMap] = useState<Map | null>(null);

  const [filter, setFilter] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const [enabledById, setEnabledById] = useState<
    Partial<Record<PatternId, boolean>>
  >({});

  const [loadingById, setLoadingById] = useState<
    Partial<Record<PatternId, boolean>>
  >({});
  const [loadedById, setLoadedById] = useState<
    Partial<Record<PatternId, Pattern>>
  >({});
  const [controlValuesById, setControlValuesById] = useState<
    Partial<Record<PatternId, Record<string, unknown>>>
  >({});

  const loadingRef = useRef(loadingById);
  const loadedRef = useRef(loadedById);
  useEffect(() => {
    loadingRef.current = loadingById;
    loadedRef.current = loadedById;
  }, [loadingById, loadedById]);

  const [codeViewerOpen, setCodeViewerOpen] = useState(false);
  const [codeViewerCode, setCodeViewerCode] = useState("");
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const handleMapReady = useCallback((mapInstance: Map) => {
    setMap(mapInstance);
  }, []);

  const ensurePatternLoaded = useCallback((id: PatternId) => {
    if (loadedRef.current[id] || loadingRef.current[id]) return;

    setLoadingById((prev) => ({ ...prev, [id]: true }));

    void loadPatternById(id)
      .then((pattern) => {
        if (!pattern) return;

        setLoadedById((prev) => ({ ...prev, [id]: pattern }));
        setControlValuesById((prev) => {
          const existing = prev[id];
          return {
            ...prev,
            [id]: normalizeControlValues(pattern, existing),
          };
        });
      })
      .catch(() => {
        // ignore; user can retry toggle
      })
      .finally(() => {
        setLoadingById((prev) => ({ ...prev, [id]: false }));
      });
  }, []);

  const enabledIds = useMemo(() => {
    return mapboxCatalog
      .map((e) => e.patternId)
      .filter((id) => Boolean(enabledById[id]));
  }, [mapboxCatalog, enabledById]);

  const enabledLoadedPatterns = useMemo(() => {
    const patterns: Pattern[] = [];
    for (const id of enabledIds) {
      const p = loadedById[id];
      if (p) patterns.push(p);
    }
    return patterns;
  }, [enabledIds, loadedById]);

  const anyEnabledLoading = useMemo(() => {
    return enabledIds.some((id) => Boolean(loadingById[id] && !loadedById[id]));
  }, [enabledIds, loadingById, loadedById]);

  const filteredCatalog = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return mapboxCatalog;
    return mapboxCatalog.filter((entry) => {
      const haystack = [
        entry.name,
        entry.description,
        entry.patternId,
        entry.category,
        ...entry.capabilities,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [filter, mapboxCatalog]);

  const groupedCatalog = useMemo(
    () =>
      groupCatalog(filteredCatalog) as (CatalogGroup & {
        entries: MapboxCatalogEntry[];
      })[],
    [filteredCatalog],
  );

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const setPatternEnabled = (id: PatternId, enabled: boolean) => {
    if (enabled) {
      const group = CONFLICT_GROUP_BY_PATTERN[id];
      const conflicts = group
        ? enabledIds.filter(
            (otherId) =>
              otherId !== id && CONFLICT_GROUP_BY_PATTERN[otherId] === group,
          )
        : [];

      if (conflicts.length > 0) {
        const disabledNames = conflicts
          .map((conflictId) => nameById[conflictId] ?? conflictId)
          .join(", ");
        const enabledName = nameById[id] ?? id;
        setNotice(
          `Disabled ${disabledNames} because it conflicts with ${enabledName}.`,
        );
        window.setTimeout(() => setNotice(null), 2500);
      }

      setEnabledById((prev) => {
        const next = { ...prev, [id]: true };
        for (const conflictId of conflicts) {
          next[conflictId] = false;
        }
        return next;
      });

      ensurePatternLoaded(id);
      return;
    }

    setEnabledById((prev) => ({ ...prev, [id]: false }));
  };

  const handleControlChange = (
    patternId: PatternId,
    controlId: string,
    value: unknown,
  ) => {
    setControlValuesById((prev) => ({
      ...prev,
      [patternId]: { ...(prev[patternId] ?? {}), [controlId]: value },
    }));
  };

  const clearAll = () => {
    setEnabledById({});
    setNotice(null);
  };

  const prompt = useMemo(() => {
    if (enabledLoadedPatterns.length === 0) return "";
    return buildAssistantPrompt(enabledLoadedPatterns, controlValuesById);
  }, [enabledLoadedPatterns, controlValuesById]);

  const handleCopyPrompt = async () => {
    if (!prompt || anyEnabledLoading) return;
    const ok = await copyText(prompt);
    if (!ok) return;
    setCopiedPrompt(true);
    window.setTimeout(() => setCopiedPrompt(false), 1200);
  };

  const handleViewPrompt = () => {
    if (!prompt) return;
    setCodeViewerCode(prompt);
    setCodeViewerOpen(true);
  };

  const handleViewPatternCode = (pattern: Pattern) => {
    setCodeViewerCode(pattern.snippet);
    setCodeViewerOpen(true);
  };

  return (
    <div className={`${appStyles.app} map-root`}>
      <div className="scanlines" />

      <MapContainerMulti
        theme={theme}
        patterns={enabledLoadedPatterns}
        controlValuesByPattern={controlValuesById}
        onMapReady={handleMapReady}
      />

      <SearchBox map={map} />

      <div className={`panel ${styles.panel}`}>
        <div className={styles.topRow}>
          <div>
            <h1 className={styles.title}>Workbench</h1>
            <p className={styles.subtitle}>
              Enable multiple patterns on one map. Tune controls. Copy a prompt.
            </p>
          </div>
          <Link
            to="/maps"
            className="secondary inline-flex items-center gap-2 rounded-md border border-[var(--panel-border)] px-3 py-2 font-mono text-xs font-bold text-[var(--text-primary)]"
            style={{ textDecoration: "none" }}
          >
            <ArrowLeft className="h-4 w-4" />
            Maps
          </Link>
        </div>

        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter patterns (name, capability, id)..."
          className={styles.search}
        />

        <div className={styles.actionsRow}>
          <button
            onClick={handleCopyPrompt}
            disabled={!prompt || anyEnabledLoading}
            className={styles.smallButton}
            title={
              anyEnabledLoading ? "Wait for patterns to finish loading" : ""
            }
          >
            <span className="inline-flex items-center gap-2">
              <Copy className="h-4 w-4" />
              {copiedPrompt ? "Prompt Copied" : "Copy Assistant Prompt"}
            </span>
          </button>
          <button
            className={`secondary ${styles.smallButtonSecondary}`}
            onClick={handleViewPrompt}
            disabled={!prompt}
          >
            <span className="inline-flex items-center gap-2">
              <Eye className="h-4 w-4" />
              View Prompt
            </span>
          </button>
          <button
            className={`secondary ${styles.smallButtonSecondary}`}
            onClick={clearAll}
          >
            <span className="inline-flex items-center gap-2">
              <X className="h-4 w-4" />
              Clear
            </span>
          </button>
        </div>

        {notice && <div className={styles.notice}>{notice}</div>}

        {groupedCatalog.map((group) => (
          <div
            key={`${group.category}::${group.subcategory ?? "none"}`}
            className={styles.category}
          >
            <div className={styles.categoryHeader}>
              <h2 className={styles.categoryTitle}>
                {group.category}
                {group.subcategory && (
                  <span className="ml-2 text-xs font-normal text-muted">
                    /{" "}
                    {SUBCATEGORY_LABELS[group.subcategory as Subcategory] ??
                      group.subcategory}
                  </span>
                )}
              </h2>
              <div className={styles.subtitle}>
                {group.entries.length} items
              </div>
            </div>

            {group.entries.map((entry) => {
              const id = entry.patternId as PatternId;
              const enabled = Boolean(enabledById[id]);
              const pattern = loadedById[id];
              const isLoading = Boolean(loadingById[id] && !pattern);
              const values =
                controlValuesById[id] ??
                (pattern ? defaultsForPattern(pattern) : {});

              return (
                <div key={id} className={styles.entry}>
                  <div className={styles.entryRow}>
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => setPatternEnabled(id, e.target.checked)}
                      aria-label={`Enable ${entry.name}`}
                    />
                    <div className={styles.entryMain}>
                      <div className={styles.entryNameRow}>
                        <div className={styles.entryName}>
                          {entry.name}{" "}
                          <span className="font-mono text-[10px] font-bold text-muted">
                            {id}
                          </span>
                        </div>

                        <button
                          className="secondary"
                          onClick={() =>
                            pattern && handleViewPatternCode(pattern)
                          }
                          disabled={!pattern}
                          title={
                            !pattern ? "Enable to load code" : "View snippet"
                          }
                        >
                          <span className="inline-flex items-center gap-2">
                            <Code2 className="h-4 w-4" />
                            Code
                          </span>
                        </button>
                      </div>

                      <div className={styles.entryDesc}>
                        {entry.description}
                      </div>

                      <div className={styles.pillRow}>
                        {entry.capabilities.slice(0, 6).map((cap) => (
                          <span key={cap} className={styles.pill}>
                            {cap}
                          </span>
                        ))}
                      </div>

                      {enabled && (
                        <div className={styles.details}>
                          <div className={styles.detailsHeader}>
                            <h3 className={styles.detailsTitle}>Controls</h3>
                            <div className={styles.subtitle}>
                              {isLoading
                                ? "Loading..."
                                : pattern
                                  ? `${pattern.controls.length} inputs`
                                  : "—"}
                            </div>
                          </div>

                          {pattern && pattern.controls.length > 0 ? (
                            <div className={styles.controls}>
                              {pattern.controls.map((control) => (
                                <div
                                  key={control.id}
                                  className={styles.controlRow}
                                >
                                  {control.type !== "toggle" && (
                                    <label
                                      htmlFor={controlDomId(
                                        pattern.id,
                                        control.id,
                                      )}
                                    >
                                      {control.label}
                                    </label>
                                  )}
                                  {renderControlInline(
                                    pattern.id,
                                    control,
                                    values[control.id],
                                    (controlId, value) =>
                                      handleControlChange(id, controlId, value),
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className={styles.subtitle}>
                              {isLoading
                                ? "Loading controls…"
                                : pattern
                                  ? "No controls"
                                  : "Enable to load"}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <ThemeToggle theme={theme} onToggle={toggleTheme} />

      <CodeViewer
        code={codeViewerCode}
        isOpen={codeViewerOpen}
        theme={theme}
        onClose={() => setCodeViewerOpen(false)}
      />
    </div>
  );
}
