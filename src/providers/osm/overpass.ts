import type { LngLat } from "../types";

export type OverpassElementType = "node" | "way" | "relation";

export type OverpassElement = {
  type: OverpassElementType;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export type OverpassResponse = {
  elements: OverpassElement[];
};

export type OverpassCategoryFilter = {
  key: string;
  value: string;
};

export type BuildOverpassQueryOptions = {
  filter: OverpassCategoryFilter;
  center: LngLat;
  radiusMeters: number;
  maxResults: number;
  timeoutSeconds?: number;
};

function clampInt(value: number, min: number, max: number): number {
  const v = Math.trunc(value);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function escapeOverpassString(value: string): string {
  // Keep this conservative; we're interpolating into ["k"="v"].
  return value.split("\\").join("\\\\").split('"').join('\\"');
}

export function buildOverpassQuery(options: BuildOverpassQueryOptions): string {
  const timeout = clampInt(options.timeoutSeconds ?? 25, 1, 180);
  const radius = clampInt(options.radiusMeters, 10, 50_000);
  const maxResults = clampInt(options.maxResults, 1, 1000);
  const key = escapeOverpassString(options.filter.key);
  const value = escapeOverpassString(options.filter.value);
  const lng = options.center[0];
  const lat = options.center[1];

  // Note: Overpass expects (lat, lon) ordering.
  return [
    `[out:json][timeout:${timeout}];`,
    `nwr["${key}"="${value}"](around:${radius},${lat},${lng});`,
    `out center ${maxResults};`,
  ].join("\n");
}

export async function fetchOverpass(options: {
  endpoint: string;
  query: string;
  signal?: AbortSignal;
}): Promise<OverpassResponse> {
  const body = new URLSearchParams({ data: options.query });
  const res = await fetch(options.endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body,
    signal: options.signal,
  });

  if (!res.ok) {
    throw new Error(`Overpass request failed: HTTP ${res.status}`);
  }

  return (await res.json()) as OverpassResponse;
}

function getName(tags: Record<string, string>): string | undefined {
  return tags.name || tags["name:en"] || tags["name:local"];
}

export function overpassElementsToFeatureCollection(
  elements: OverpassElement[],
  options?: { filter?: OverpassCategoryFilter; maxTags?: number },
): GeoJSON.FeatureCollection {
  const maxTags = clampInt(options?.maxTags ?? 25, 0, 200);
  const filter = options?.filter;

  const features: GeoJSON.Feature[] = [];

  for (const el of elements) {
    const id = `${el.type}/${String(el.id)}`;

    const lat = el.type === "node" ? el.lat : el.center?.lat ?? el.lat;
    const lon = el.type === "node" ? el.lon : el.center?.lon ?? el.lon;
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const tags = el.tags ?? {};
    const name = getName(tags);

    const properties: Record<string, unknown> = {
      id,
      osm_type: el.type,
      osm_id: el.id,
      name,
    };

    if (filter) {
      properties.filter_key = filter.key;
      properties.filter_value = filter.value;
      properties.kind = `${filter.key}=${filter.value}`;
    }

    const tagEntries = Object.entries(tags)
      .filter(([k, v]) => typeof k === "string" && typeof v === "string")
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, maxTags);

    for (const [k, v] of tagEntries) {
      // Avoid clobbering our normalized name/kind fields.
      if (k === "name" || k === "name:en" || k === "name:local") continue;
      if (k === "id" || k === "osm_type" || k === "osm_id") continue;
      if (k === "kind" || k === "filter_key" || k === "filter_value") continue;
      properties[k] = v;
    }

    features.push({
      type: "Feature",
      id,
      properties,
      geometry: { type: "Point", coordinates: [lon, lat] },
    });
  }

  return { type: "FeatureCollection", features };
}
