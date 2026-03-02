export type DrawMode = "point" | "line" | "polygon" | "edit" | "delete";

export type DrawGeometry = GeoJSON.Point | GeoJSON.LineString | GeoJSON.Polygon;

export type DrawFeature = GeoJSON.Feature<DrawGeometry, Record<string, unknown>> & {
  id: string;
};

export function emptyCollection<T extends GeoJSON.Geometry>(): GeoJSON.FeatureCollection<T> {
  return {
    type: "FeatureCollection",
    features: [],
  };
}

export function toFeatureCollection(
  features: DrawFeature[],
): GeoJSON.FeatureCollection<DrawGeometry> {
  return {
    type: "FeatureCollection",
    features,
  };
}

export function toDraftCollection(
  mode: DrawMode,
  draftCoords: [number, number][],
): GeoJSON.FeatureCollection<GeoJSON.Geometry> {
  if (draftCoords.length === 0) {
    return emptyCollection();
  }

  if (mode === "line") {
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: draftCoords,
          },
        },
      ],
    };
  }

  if (mode === "polygon" && draftCoords.length >= 2) {
    const closed = [...draftCoords, draftCoords[0]];
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: closed,
          },
        },
      ],
    };
  }

  return emptyCollection();
}

export function toVertexCollection(
  feature: DrawFeature | null,
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  if (!feature) {
    return emptyCollection();
  }

  const vertices: GeoJSON.Feature<GeoJSON.Point>[] = [];

  if (feature.geometry.type === "Point") {
    vertices.push({
      type: "Feature",
      properties: {
        featureId: String(feature.id),
        vertexIndex: 0,
      },
      geometry: {
        type: "Point",
        coordinates: feature.geometry.coordinates,
      },
    });
  }

  if (feature.geometry.type === "LineString") {
    feature.geometry.coordinates.forEach((coord, index) => {
      vertices.push({
        type: "Feature",
        properties: {
          featureId: String(feature.id),
          vertexIndex: index,
        },
        geometry: {
          type: "Point",
          coordinates: coord,
        },
      });
    });
  }

  if (feature.geometry.type === "Polygon") {
    const ring = feature.geometry.coordinates[0] ?? [];
    ring.slice(0, -1).forEach((coord, index) => {
      vertices.push({
        type: "Feature",
        properties: {
          featureId: String(feature.id),
          vertexIndex: index,
        },
        geometry: {
          type: "Point",
          coordinates: coord,
        },
      });
    });
  }

  return {
    type: "FeatureCollection",
    features: vertices,
  };
}

export function updateFeatureVertex(
  feature: DrawFeature,
  vertexIndex: number,
  nextCoord: [number, number],
): DrawFeature {
  if (feature.geometry.type === "Point") {
    return {
      ...feature,
      geometry: {
        ...feature.geometry,
        coordinates: nextCoord,
      },
    };
  }

  if (feature.geometry.type === "LineString") {
    const coords = [...feature.geometry.coordinates];
    if (!coords[vertexIndex]) return feature;
    coords[vertexIndex] = nextCoord;
    return {
      ...feature,
      geometry: {
        ...feature.geometry,
        coordinates: coords,
      },
    };
  }

  const ring = [...(feature.geometry.coordinates[0] ?? [])];
  if (!ring[vertexIndex]) return feature;
  ring[vertexIndex] = nextCoord;
  ring[ring.length - 1] = ring[0];

  return {
    ...feature,
    geometry: {
      ...feature.geometry,
      coordinates: [ring, ...feature.geometry.coordinates.slice(1)],
    },
  };
}

export function normalizeImportedGeometry(
  geometry: GeoJSON.Geometry,
): DrawGeometry | null {
  if (geometry.type === "Point") {
    if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length < 2) {
      return null;
    }
    const [lng, lat] = geometry.coordinates;
    if (typeof lng !== "number" || typeof lat !== "number") return null;

    return {
      type: "Point",
      coordinates: [lng, lat],
    };
  }

  if (geometry.type === "LineString") {
    const coords = geometry.coordinates.filter(
      (coord): coord is [number, number] =>
        Array.isArray(coord) &&
        coord.length >= 2 &&
        typeof coord[0] === "number" &&
        typeof coord[1] === "number",
    );
    if (coords.length < 2) return null;

    return {
      type: "LineString",
      coordinates: coords,
    };
  }

  if (geometry.type === "Polygon") {
    const ring = (geometry.coordinates[0] ?? []).filter(
      (coord): coord is [number, number] =>
        Array.isArray(coord) &&
        coord.length >= 2 &&
        typeof coord[0] === "number" &&
        typeof coord[1] === "number",
    );

    if (ring.length < 3) return null;

    const closed =
      ring[0][0] === ring[ring.length - 1][0] &&
      ring[0][1] === ring[ring.length - 1][1]
        ? ring
        : [...ring, ring[0]];

    return {
      type: "Polygon",
      coordinates: [closed],
    };
  }

  return null;
}

export function createPointFeature(
  id: string,
  coord: [number, number],
  name = `Point ${id}`,
): DrawFeature {
  return {
    id,
    type: "Feature",
    properties: { name },
    geometry: {
      type: "Point",
      coordinates: coord,
    },
  };
}

export function createLineFeature(
  id: string,
  coords: [number, number][],
  name = `Line ${id}`,
): DrawFeature | null {
  if (coords.length < 2) return null;

  return {
    id,
    type: "Feature",
    properties: { name },
    geometry: {
      type: "LineString",
      coordinates: coords,
    },
  };
}

export function createPolygonFeature(
  id: string,
  coords: [number, number][],
  name = `Polygon ${id}`,
): DrawFeature | null {
  if (coords.length < 3) return null;

  const ring = [...coords, coords[0]];
  return {
    id,
    type: "Feature",
    properties: { name },
    geometry: {
      type: "Polygon",
      coordinates: [ring],
    },
  };
}

export function getGeometryCounts(features: DrawFeature[]): {
  points: number;
  lines: number;
  polygons: number;
} {
  let points = 0;
  let lines = 0;
  let polygons = 0;

  for (const feature of features) {
    if (feature.geometry.type === "Point") points += 1;
    if (feature.geometry.type === "LineString") lines += 1;
    if (feature.geometry.type === "Polygon") polygons += 1;
  }

  return { points, lines, polygons };
}
