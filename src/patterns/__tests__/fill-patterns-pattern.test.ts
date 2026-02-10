import { describe, it, expect } from "vitest";
import { loadPatternById } from "../loadCatalogPattern";

describe("fill-patterns pattern", () => {
  it("loads and provides a view", async () => {
    const pattern = await loadPatternById("fill-patterns");
    expect(pattern).not.toBeNull();
    expect(pattern?.id).toBe("fill-patterns");
    expect(typeof pattern?.view).toBe("function");
    expect(pattern?.controls.map((c) => c.id)).toEqual(
      expect.arrayContaining(["pattern", "scale", "patternOpacity"]),
    );
  });
});

