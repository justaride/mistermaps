import { describe, it, expect } from "vitest";
import {
  buildOverpassQuery,
  overpassElementsToFeatureCollection,
  type OverpassElement,
} from "../overpass";

describe("buildOverpassQuery", () => {
  it("builds an around query with correct lat/lon ordering and out center limit", () => {
    const q = buildOverpassQuery({
      filter: { key: "amenity", value: "cafe" },
      center: [10.748, 59.912],
      radiusMeters: 800,
      maxResults: 120,
      timeoutSeconds: 25,
    });

    expect(q).toContain('[out:json][timeout:25];');
    expect(q).toContain('nwr["amenity"="cafe"](around:800,59.912,10.748);');
    expect(q).toContain("out center 120;");
  });
});

describe("overpassElementsToFeatureCollection", () => {
  it("converts nodes and center-carrying ways/relations to Point features and drops elements without coords", () => {
    const elements: OverpassElement[] = [
      {
        type: "node",
        id: 123,
        lat: 59.9,
        lon: 10.7,
        tags: { amenity: "cafe", name: "Cafe A" },
      },
      {
        type: "way",
        id: 456,
        center: { lat: 59.91, lon: 10.71 },
        tags: { leisure: "park", name: "Park B" },
      },
      {
        type: "relation",
        id: 789,
        center: { lat: 59.92, lon: 10.72 },
        tags: { tourism: "viewpoint" },
      },
      {
        type: "way",
        id: 999,
        tags: { amenity: "toilets" },
      },
    ];

    const fc = overpassElementsToFeatureCollection(elements, {
      filter: { key: "amenity", value: "cafe" },
    });

    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features).toHaveLength(3);

    const ids = fc.features.map((f) => String(f.id));
    expect(ids).toContain("node/123");
    expect(ids).toContain("way/456");
    expect(ids).toContain("relation/789");

    const cafe = fc.features.find((f) => String(f.id) === "node/123");
    expect(cafe?.properties).toMatchObject({ name: "Cafe A" });
    expect((cafe?.geometry as GeoJSON.Point).coordinates).toEqual([10.7, 59.9]);
  });
});

