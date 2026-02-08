import { describe, it, expect } from "vitest";
import { CATALOG } from "../catalog";

describe("CATALOG", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(CATALOG)).toBe(true);
    expect(CATALOG.length).toBeGreaterThan(0);
  });

  it("has unique pattern IDs", () => {
    const ids = CATALOG.map((entry) => entry.patternId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every entry has required fields", () => {
    for (const entry of CATALOG) {
      expect(entry.patternId).toBeTruthy();
      expect(entry.name).toBeTruthy();
      expect(entry.description).toBeTruthy();
      expect(entry.capabilities.length).toBeGreaterThan(0);
      expect(entry.category).toBeTruthy();
      expect(entry.provider).toBeTruthy();
    }
  });

  it("categories are valid", () => {
    const validCategories = [
      "layers",
      "data-viz",
      "markers",
      "navigation",
      "providers",
    ];
    for (const entry of CATALOG) {
      expect(validCategories).toContain(entry.category);
    }
  });

  it("providers are valid", () => {
    const validProviders = ["mapbox", "maplibre"];
    for (const entry of CATALOG) {
      expect(validProviders).toContain(entry.provider);
    }
  });

  it("capabilities are non-empty strings", () => {
    for (const entry of CATALOG) {
      for (const cap of entry.capabilities) {
        expect(typeof cap).toBe("string");
        expect(cap.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
