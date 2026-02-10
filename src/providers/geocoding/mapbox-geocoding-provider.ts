import { ProviderRequestError } from "../errors";
import type {
  GeocodingProvider,
  GeocodingRequest,
  GeocodingResult,
  LngLat,
  ReverseGeocodingRequest,
  ReverseGeocodingResult,
} from "../types";

const MAPBOX_GEOCODING_ENDPOINT =
  "https://api.mapbox.com/geocoding/v5/mapbox.places";

type MapboxGeocodingFeature = {
  id?: string;
  place_name?: string;
  center?: unknown;
};

type MapboxGeocodingResponse = {
  features?: MapboxGeocodingFeature[];
};

function normalizeLngLat(raw: unknown): LngLat | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const [lng, lat] = raw;
  if (typeof lng !== "number" || typeof lat !== "number") return null;
  return [lng, lat];
}

export class MapboxGeocodingProvider implements GeocodingProvider {
  readonly id = "mapbox";
  private readonly accessToken: string;

  constructor(accessToken = import.meta.env.VITE_MAPBOX_TOKEN) {
    this.accessToken = accessToken;
  }

  async geocode(
    request: GeocodingRequest,
    signal?: AbortSignal,
  ): Promise<GeocodingResult[]> {
    const query = request.query.trim();
    if (!query) return [];

    if (!this.accessToken) {
      throw new ProviderRequestError("Mapbox token is not configured", {
        providerId: this.id,
        code: "missing_token",
      });
    }

    const limit = Math.max(1, Math.min(request.limit ?? 5, 10));
    const params = new URLSearchParams({
      access_token: this.accessToken,
      limit: String(limit),
    });
    const url = `${MAPBOX_GEOCODING_ENDPOINT}/${encodeURIComponent(query)}.json?${params.toString()}`;
    const response = await fetch(url, { signal });

    if (!response.ok) {
      throw new ProviderRequestError("Mapbox geocoding request failed", {
        providerId: this.id,
        status: response.status,
      });
    }

    const payload = (await response.json()) as MapboxGeocodingResponse;
    const features = Array.isArray(payload.features) ? payload.features : [];
    const results: GeocodingResult[] = [];

    for (const feature of features) {
      const center = normalizeLngLat(feature.center);
      if (!feature.id || !feature.place_name || !center) continue;
      results.push({
        id: `${this.id}:${feature.id}`,
        placeName: feature.place_name,
        center,
        providerId: this.id,
      });
    }

    return results;
  }

  async reverseGeocode(
    request: ReverseGeocodingRequest,
    signal?: AbortSignal,
  ): Promise<ReverseGeocodingResult[]> {
    const [lng, lat] = request.center;

    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return [];

    if (!this.accessToken) {
      throw new ProviderRequestError("Mapbox token is not configured", {
        providerId: this.id,
        code: "missing_token",
      });
    }

    const limit = Math.max(1, Math.min(request.limit ?? 1, 5));
    const params = new URLSearchParams({
      access_token: this.accessToken,
      limit: String(limit),
    });
    const url = `${MAPBOX_GEOCODING_ENDPOINT}/${encodeURIComponent(
      `${lng},${lat}`,
    )}.json?${params.toString()}`;
    const response = await fetch(url, { signal });

    if (!response.ok) {
      throw new ProviderRequestError("Mapbox reverse geocoding request failed", {
        providerId: this.id,
        status: response.status,
      });
    }

    const payload = (await response.json()) as MapboxGeocodingResponse;
    const features = Array.isArray(payload.features) ? payload.features : [];
    const results: ReverseGeocodingResult[] = [];

    for (const feature of features) {
      const center = normalizeLngLat(feature.center);
      if (!feature.place_name || !center) continue;
      const fid = feature.id ? `${this.id}:${feature.id}` : `${this.id}:${feature.place_name}`;
      results.push({
        id: fid,
        placeName: feature.place_name,
        center,
        providerId: this.id,
      });
    }

    return results;
  }
}
