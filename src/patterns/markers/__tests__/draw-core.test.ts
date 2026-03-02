import { describe, expect, it } from "vitest";
import {
  type DrawFeature,
  createLineFeature,
  createPointFeature,
  createPolygonFeature,
  getGeometryCounts,
  normalizeImportedGeometry,
  toDraftCollection,
  toFeatureCollection,
  toVertexCollection,
  updateFeatureVertex,
} from "../draw-core";

describe("draw-core", () => {
  it("creates and counts point/line/polygon features", () => {
    const point = createPointFeature("draw-1", [10, 59], "Point 1");
    const line = createLineFeature(
      "draw-2",
      [
        [10, 59],
        [10.1, 59.1],
      ],
      "Line 2",
    );
    const polygon = createPolygonFeature(
      "draw-3",
      [
        [10, 59],
        [10.1, 59],
        [10.1, 59.1],
      ],
      "Polygon 3",
    );

    expect(line).not.toBeNull();
    expect(polygon).not.toBeNull();

    const features: DrawFeature[] = [point, line, polygon].filter(
      (feature): feature is DrawFeature => feature !== null,
    );
    expect(getGeometryCounts(features)).toEqual({
      points: 1,
      lines: 1,
      polygons: 1,
    });

    const fc = toFeatureCollection(features);
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features).toHaveLength(3);
  });

  it("builds draft geometries for line and polygon modes", () => {
    const lineDraft = toDraftCollection("line", [
      [10, 59],
      [10.1, 59.1],
    ]);
    expect(lineDraft.features).toHaveLength(1);
    expect(lineDraft.features[0]?.geometry.type).toBe("LineString");

    const polygonDraft = toDraftCollection("polygon", [
      [10, 59],
      [10.1, 59],
      [10.1, 59.1],
    ]);
    expect(polygonDraft.features).toHaveLength(1);
    const coords = (polygonDraft.features[0]?.geometry as GeoJSON.LineString).coordinates;
    expect(coords[0]).toEqual(coords[coords.length - 1]);
  });

  it("returns editable vertex collection for polygons without duplicate closing point", () => {
    const polygon = createPolygonFeature(
      "draw-9",
      [
        [10, 59],
        [10.1, 59],
        [10.1, 59.1],
      ],
      "Polygon 9",
    );

    const vertices = toVertexCollection(polygon);
    expect(vertices.features).toHaveLength(3);
  });

  it("updates polygon vertex and preserves closed ring", () => {
    const polygon = createPolygonFeature(
      "draw-7",
      [
        [10, 59],
        [10.1, 59],
        [10.1, 59.1],
      ],
      "Polygon 7",
    );
    expect(polygon).not.toBeNull();

    const updated = updateFeatureVertex(polygon!, 1, [10.2, 59.2]);
    const ring = (updated.geometry as GeoJSON.Polygon).coordinates[0];

    expect(ring[1]).toEqual([10.2, 59.2]);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it("normalizes imported geometries and rejects unsupported types", () => {
    const normalizedPoint = normalizeImportedGeometry({
      type: "Point",
      coordinates: [10, 59],
    });
    expect(normalizedPoint?.type).toBe("Point");

    const normalizedPolygon = normalizeImportedGeometry({
      type: "Polygon",
      coordinates: [
        [
          [10, 59],
          [10.1, 59],
          [10.1, 59.1],
        ],
      ],
    });
    expect(normalizedPolygon?.type).toBe("Polygon");

    const unsupported = normalizeImportedGeometry({
      type: "GeometryCollection",
      geometries: [],
    });
    expect(unsupported).toBeNull();
  });
});
