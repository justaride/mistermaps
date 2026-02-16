import { Link } from "react-router-dom";
import { ArrowLeft, Code2, Copy, Eye, X } from "lucide-react";
import "../map/engine-css";
import {
  CodeViewer,
  MapContainerMulti,
  SearchBox,
  ThemeToggle,
} from "../components";
import { SUBCATEGORY_LABELS } from "../data/catalog-meta";
import type { ControlValues, PatternId, Subcategory } from "../types";
import appStyles from "../App.module.css";
import styles from "./Workbench.module.css";
import { controlDomId, renderControlInline } from "./workbench/controlRenderer";
import { useWorkbenchState } from "./workbench/useWorkbenchState";

export default function Workbench() {
  const {
    theme,
    map,
    filter,
    notice,
    enabledById,
    loadingById,
    loadedById,
    controlValuesById,
    codeViewerOpen,
    codeViewerCode,
    copiedPrompt,
    groupedCatalog,
    enabledLoadedPatterns,
    anyEnabledLoading,
    prompt,
    setFilter,
    setCodeViewerOpen,
    handleMapReady,
    toggleTheme,
    setPatternEnabled,
    handleControlChange,
    clearAll,
    handleCopyPrompt,
    handleViewPrompt,
    handleViewPatternCode,
    defaultsForPattern,
  } = useWorkbenchState();

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
            title={anyEnabledLoading ? "Wait for patterns to finish loading" : ""}
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
              <div className={styles.subtitle}>{group.entries.length} items</div>
            </div>

            {group.entries.map((entry) => {
              const id = entry.patternId as PatternId;
              const enabled = Boolean(enabledById[id]);
              const pattern = loadedById[id];
              const isLoading = Boolean(loadingById[id] && !pattern);
              const values: ControlValues =
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
                          onClick={() => pattern && handleViewPatternCode(pattern)}
                          disabled={!pattern}
                          title={!pattern ? "Enable to load code" : "View snippet"}
                        >
                          <span className="inline-flex items-center gap-2">
                            <Code2 className="h-4 w-4" />
                            Code
                          </span>
                        </button>
                      </div>

                      <div className={styles.entryDesc}>{entry.description}</div>

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
                                <div key={control.id} className={styles.controlRow}>
                                  {control.type !== "toggle" && (
                                    <label htmlFor={controlDomId(pattern.id, control.id)}>
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
