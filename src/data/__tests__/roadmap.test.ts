import { describe, it, expect } from "vitest";
import { ROADMAP_ITEMS } from "../roadmap";

describe("ROADMAP_ITEMS", () => {
  it("has unique IDs", () => {
    const ids = ROADMAP_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every item declares engine support", () => {
    for (const item of ROADMAP_ITEMS) {
      expect(item.engineSupport).toBeTruthy();
      expect(typeof item.engineSupport.mapbox).toBe("boolean");
      expect(typeof item.engineSupport.maplibre).toBe("boolean");
      expect(item.engineSupport.mapbox || item.engineSupport.maplibre).toBe(
        true,
      );
    }
  });

  it("planned items have acceptance criteria", () => {
    const planned = ROADMAP_ITEMS.filter((i) => i.status === "planned");
    expect(planned.length).toBeGreaterThan(0);
    for (const item of planned) {
      expect(Array.isArray(item.acceptanceCriteria)).toBe(true);
      expect(item.acceptanceCriteria.length).toBeGreaterThan(0);
      expect(item.links?.demoPath).toBeUndefined();
    }
  });

  it("implemented items link to valid routes", () => {
    const implemented = ROADMAP_ITEMS.filter((i) => i.status === "implemented");
    expect(implemented.length).toBeGreaterThan(0);

    for (const item of implemented) {
      const path = item.links?.demoPath;
      expect(typeof path).toBe("string");

      if (item.artifact === "project") {
        expect(path?.startsWith("/projects/")).toBe(true);
      } else {
        expect(path?.startsWith("/maps/")).toBe(true);
      }
    }
  });
});

