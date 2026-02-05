type ExportOptions = {
  name?: string;
  creator?: string;
  time?: Date;
};

type FlatItem = {
  geometry: GeoJSON.Geometry;
  properties: Record<string, unknown>;
  fallbackName: string;
};

export function geojsonToKml(
  geojson: GeoJSON.FeatureCollection,
  options: ExportOptions = {},
): string {
  const documentName = options.name ?? "Mister Maps Export";
  const placemarks: string[] = [];

  const items = flattenFeatureCollection(geojson);
  for (const item of items) {
    const name = getDisplayName(item.properties, item.fallbackName);
    const description = propertiesToDescription(item.properties);
    const geometryXml = geometryToKml(item.geometry);
    if (!geometryXml) continue;

    placemarks.push(
      [
        "<Placemark>",
        `<name>${xmlEscape(name)}</name>`,
        description ? `<description>${xmlEscape(description)}</description>` : "",
        geometryXml,
        "</Placemark>",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2">',
    "<Document>",
    `<name>${xmlEscape(documentName)}</name>`,
    ...placemarks,
    "</Document>",
    "</kml>",
    "",
  ].join("\n");
}

export function geojsonToGpx(
  geojson: GeoJSON.FeatureCollection,
  options: ExportOptions = {},
): string {
  const name = options.name ?? "Mister Maps Export";
  const creator = options.creator ?? "Mister Maps";
  const time = (options.time ?? new Date()).toISOString();

  const waypoints: string[] = [];
  const tracks: string[] = [];

  const items = flattenFeatureCollection(geojson);
  for (const item of items) {
    const displayName = getDisplayName(item.properties, item.fallbackName);
    const description = propertiesToDescription(item.properties);
    const geometry = item.geometry;

    if (geometry.type === "Point") {
      const lngLat = toLngLat(geometry.coordinates);
      if (!lngLat) continue;
      waypoints.push(
        [
          `<wpt lat="${formatNumber(lngLat[1])}" lon="${formatNumber(lngLat[0])}">`,
          `<name>${xmlEscape(displayName)}</name>`,
          description ? `<desc>${xmlEscape(description)}</desc>` : "",
          "</wpt>",
        ]
          .filter(Boolean)
          .join("\n"),
      );
      continue;
    }

    if (geometry.type === "LineString") {
      const trk = lineStringToGpxTrack(displayName, description, geometry);
      if (trk) tracks.push(trk);
      continue;
    }

    if (geometry.type === "Polygon") {
      const trk = polygonToGpxTrack(displayName, description, geometry);
      if (trk) tracks.push(trk);
      continue;
    }
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<gpx creator="${xmlEscape(creator)}" version="1.1" xmlns="http://www.topografix.com/GPX/1/1">`,
    "<metadata>",
    `<name>${xmlEscape(name)}</name>`,
    `<time>${xmlEscape(time)}</time>`,
    "</metadata>",
    ...waypoints,
    ...tracks,
    "</gpx>",
    "",
  ].join("\n");
}

function flattenFeatureCollection(geojson: GeoJSON.FeatureCollection): FlatItem[] {
  const out: FlatItem[] = [];
  const features = geojson.features ?? [];

  let featureIndex = 0;
  for (const feature of features) {
    featureIndex += 1;
    if (!feature || feature.type !== "Feature") continue;
    if (!feature.geometry) continue;

    const properties = toProperties(feature.properties);
    const geometries = flattenGeometry(feature.geometry);

    let partIndex = 0;
    for (const geometry of geometries) {
      partIndex += 1;
      out.push({
        geometry,
        properties,
        fallbackName:
          geometries.length > 1
            ? `Feature ${featureIndex} (${partIndex})`
            : `Feature ${featureIndex}`,
      });
    }
  }

  return out;
}

function toProperties(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function flattenGeometry(geometry: GeoJSON.Geometry): GeoJSON.Geometry[] {
  if (!geometry) return [];

  switch (geometry.type) {
    case "GeometryCollection":
      return geometry.geometries.flatMap((g) => flattenGeometry(g));
    case "MultiPoint":
      return geometry.coordinates.map((coordinates) => ({
        type: "Point" as const,
        coordinates,
      }));
    case "MultiLineString":
      return geometry.coordinates.map((coordinates) => ({
        type: "LineString" as const,
        coordinates,
      }));
    case "MultiPolygon":
      return geometry.coordinates.map((coordinates) => ({
        type: "Polygon" as const,
        coordinates,
      }));
    default:
      return [geometry];
  }
}

function getDisplayName(properties: Record<string, unknown>, fallback: string): string {
  const fromName = properties.name;
  if (typeof fromName === "string" && fromName.trim()) return fromName.trim();

  const distance = properties.distance;
  if (typeof distance === "string" && distance.trim()) return distance.trim();

  const area = properties.area;
  if (typeof area === "string" && area.trim()) return area.trim();

  return fallback;
}

function propertiesToDescription(properties: Record<string, unknown>): string | null {
  const entries = Object.entries(properties).filter(
    ([, v]) =>
      typeof v === "string" || typeof v === "number" || typeof v === "boolean",
  );
  if (entries.length === 0) return null;

  const lines: string[] = [];
  for (const [key, value] of entries.slice(0, 24)) {
    lines.push(`${key}: ${String(value)}`);
  }

  const text = lines.join("\n");
  return text.length > 1800 ? `${text.slice(0, 1797)}...` : text;
}

function geometryToKml(geometry: GeoJSON.Geometry): string | null {
  if (geometry.type === "Point") {
    const lngLat = toLngLat(geometry.coordinates);
    if (!lngLat) return null;
    return [
      "<Point>",
      `<coordinates>${formatNumber(lngLat[0])},${formatNumber(lngLat[1])}</coordinates>`,
      "</Point>",
    ].join("\n");
  }

  if (geometry.type === "LineString") {
    const coords = lineStringToKmlCoords(geometry.coordinates);
    if (!coords) return null;
    return [
      "<LineString>",
      "<tessellate>1</tessellate>",
      "<coordinates>",
      coords,
      "</coordinates>",
      "</LineString>",
    ].join("\n");
  }

  if (geometry.type === "Polygon") {
    const polygon = polygonToKml(geometry);
    return polygon;
  }

  return null;
}

function polygonToKml(geometry: GeoJSON.Polygon): string | null {
  const rings = geometry.coordinates ?? [];
  if (!Array.isArray(rings) || rings.length === 0) return null;

  const outer = ringToKmlCoords(rings[0]);
  if (!outer) return null;

  const innerXml: string[] = [];
  for (const ring of rings.slice(1)) {
    const inner = ringToKmlCoords(ring);
    if (!inner) continue;
    innerXml.push(
      [
        "<innerBoundaryIs>",
        "<LinearRing>",
        "<coordinates>",
        inner,
        "</coordinates>",
        "</LinearRing>",
        "</innerBoundaryIs>",
      ].join("\n"),
    );
  }

  return [
    "<Polygon>",
    "<tessellate>1</tessellate>",
    "<outerBoundaryIs>",
    "<LinearRing>",
    "<coordinates>",
    outer,
    "</coordinates>",
    "</LinearRing>",
    "</outerBoundaryIs>",
    ...innerXml,
    "</Polygon>",
  ].join("\n");
}

function lineStringToKmlCoords(coordinates: GeoJSON.Position[]): string | null {
  const parts = coordinates
    .map((pos) => positionToKmlCoord(pos))
    .filter((v): v is string => Boolean(v));
  if (parts.length < 2) return null;
  return parts.join("\n");
}

function ringToKmlCoords(ring: GeoJSON.Position[]): string | null {
  const closed = ensureClosedRing(ring);
  const parts = closed
    .map((pos) => positionToKmlCoord(pos))
    .filter((v): v is string => Boolean(v));
  if (parts.length < 4) return null;
  return parts.join("\n");
}

function lineStringToGpxTrack(
  name: string,
  description: string | null,
  geometry: GeoJSON.LineString,
): string | null {
  const points = geometry.coordinates
    .map((pos) => positionToLngLat(pos))
    .filter((v): v is [number, number] => Boolean(v));
  if (points.length < 2) return null;

  const seg = [
    "<trkseg>",
    ...points.map(
      ([lon, lat]) =>
        `<trkpt lat="${formatNumber(lat)}" lon="${formatNumber(lon)}"></trkpt>`,
    ),
    "</trkseg>",
  ].join("\n");

  return [
    "<trk>",
    `<name>${xmlEscape(name)}</name>`,
    description ? `<desc>${xmlEscape(description)}</desc>` : "",
    seg,
    "</trk>",
  ]
    .filter(Boolean)
    .join("\n");
}

function polygonToGpxTrack(
  name: string,
  description: string | null,
  geometry: GeoJSON.Polygon,
): string | null {
  const rings = geometry.coordinates ?? [];
  if (!Array.isArray(rings) || rings.length === 0) return null;

  const segments: string[] = [];
  for (const ring of rings) {
    const closed = ensureClosedRing(ring);
    const points = closed
      .map((pos) => positionToLngLat(pos))
      .filter((v): v is [number, number] => Boolean(v));
    if (points.length < 4) continue;
    segments.push(
      [
        "<trkseg>",
        ...points.map(
          ([lon, lat]) =>
            `<trkpt lat="${formatNumber(lat)}" lon="${formatNumber(lon)}"></trkpt>`,
        ),
        "</trkseg>",
      ].join("\n"),
    );
  }

  if (segments.length === 0) return null;

  return [
    "<trk>",
    `<name>${xmlEscape(name)}</name>`,
    description ? `<desc>${xmlEscape(description)}</desc>` : "",
    ...segments,
    "</trk>",
  ]
    .filter(Boolean)
    .join("\n");
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const fixed = n.toFixed(7);
  return fixed.replace(/\.?0+$/, "");
}

function toLngLat(value: GeoJSON.Position): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lon = Number(value[0]);
  const lat = Number(value[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return [lon, lat];
}

function positionToLngLat(value: GeoJSON.Position): [number, number] | null {
  return toLngLat(value);
}

function positionToKmlCoord(value: GeoJSON.Position): string | null {
  const lngLat = toLngLat(value);
  if (!lngLat) return null;
  return `${formatNumber(lngLat[0])},${formatNumber(lngLat[1])}`;
}

function ensureClosedRing(ring: GeoJSON.Position[]): GeoJSON.Position[] {
  if (!Array.isArray(ring) || ring.length === 0) return [];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (Array.isArray(first) && Array.isArray(last) && first.length >= 2 && last.length >= 2) {
    if (Number(first[0]) === Number(last[0]) && Number(first[1]) === Number(last[1])) {
      return ring;
    }
  }
  return [...ring, first];
}

