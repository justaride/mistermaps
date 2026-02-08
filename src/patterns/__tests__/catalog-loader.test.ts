import { describe, it, expect } from "vitest";
import { CATALOG } from "../../data/catalog";
import { loadPatternById } from "../loadCatalogPattern";
import type { CatalogEntry, PatternId } from "../../types";

type MapboxCatalogEntry = CatalogEntry & {
  provider: "mapbox";
  patternId: PatternId;
};

function isMapboxCatalogEntry(entry: CatalogEntry): entry is MapboxCatalogEntry {
  return entry.provider === "mapbox" && entry.patternId !== "maplibre";
}

describe("loadPatternById", () => {
  it("loads every Mapbox catalog pattern", async () => {
    const entries = CATALOG.filter(isMapboxCatalogEntry);

    for (const entry of entries) {
      // eslint-disable-next-line no-await-in-loop
      const pattern = await loadPatternById(entry.patternId);
      expect(pattern).not.toBeNull();
      expect(pattern?.id).toBe(entry.patternId);
    }
  });
});

