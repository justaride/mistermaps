import { describe, it, expect } from "vitest";
import { loadPatternById } from "../loadCatalogPattern";

describe("hover-tooltips pattern", () => {
  it("loads and provides a view", async () => {
    const pattern = await loadPatternById("hover-tooltips");
    expect(pattern).not.toBeNull();
    expect(pattern?.id).toBe("hover-tooltips");
    expect(typeof pattern?.view).toBe("function");
    expect(pattern?.controls.map((c) => c.id)).toEqual(
      expect.arrayContaining(["enabled", "showCoords"]),
    );
  });
});

