import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map } from "mapbox-gl";
import { CATALOG } from "../../data/catalog";
import { groupCatalog, type CatalogGroup } from "../../data/catalog-utils";
import { loadPatternById } from "../../patterns/loadCatalogPattern";
import { copyText } from "../../patterns/utils/export";
import type {
  CatalogEntry,
  ControlValue,
  ControlValues,
  Pattern,
  PatternCategory,
  PatternId,
  Theme,
} from "../../types";
import { buildAssistantPrompt } from "../../utils/buildAssistantPrompt";
import { logError } from "../../utils/logger";

type MapboxCatalogEntry = CatalogEntry & {
  provider: "mapbox";
  patternId: PatternId;
  category: PatternCategory;
};

export type WorkbenchCatalogGroup = CatalogGroup & {
  entries: MapboxCatalogEntry[];
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

function defaultsForPattern(pattern: Pattern): ControlValues {
  const defaults: ControlValues = {};
  for (const control of pattern.controls) {
    defaults[control.id] = control.defaultValue;
  }
  return defaults;
}

function normalizeControlValues(
  pattern: Pattern,
  values: ControlValues | undefined,
): ControlValues {
  const next = { ...(values ?? {}) };
  for (const control of pattern.controls) {
    if (!(control.id in next)) {
      next[control.id] = control.defaultValue;
    }
  }
  return next;
}

export function useWorkbenchState() {
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
    Partial<Record<PatternId, ControlValues>>
  >({});

  const [codeViewerOpen, setCodeViewerOpen] = useState(false);
  const [codeViewerCode, setCodeViewerCode] = useState("");
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const loadingRef = useRef(loadingById);
  const loadedRef = useRef(loadedById);

  useEffect(() => {
    loadingRef.current = loadingById;
    loadedRef.current = loadedById;
  }, [loadingById, loadedById]);

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
      .catch((error) => {
        logError(`Failed to load workbench pattern "${id}"`, error);
      })
      .finally(() => {
        setLoadingById((prev) => ({ ...prev, [id]: false }));
      });
  }, []);

  const enabledIds = useMemo(() => {
    return mapboxCatalog
      .map((entry) => entry.patternId)
      .filter((id) => Boolean(enabledById[id]));
  }, [mapboxCatalog, enabledById]);

  const enabledLoadedPatterns = useMemo(() => {
    const patterns: Pattern[] = [];
    for (const id of enabledIds) {
      const pattern = loadedById[id];
      if (pattern) patterns.push(pattern);
    }
    return patterns;
  }, [enabledIds, loadedById]);

  const anyEnabledLoading = useMemo(() => {
    return enabledIds.some((id) => Boolean(loadingById[id] && !loadedById[id]));
  }, [enabledIds, loadingById, loadedById]);

  const filteredCatalog = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return mapboxCatalog;

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

      return haystack.includes(query);
    });
  }, [filter, mapboxCatalog]);

  const groupedCatalog = useMemo(
    () =>
      groupCatalog(filteredCatalog) as WorkbenchCatalogGroup[],
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
    value: ControlValue,
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

  return {
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
  };
}
