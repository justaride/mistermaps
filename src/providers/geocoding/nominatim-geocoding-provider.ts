import { ProviderRequestError } from "../errors";
import type {
  GeocodingProvider,
  GeocodingRequest,
  GeocodingResult,
  LngLat,
} from "../types";

type NominatimSearchResult = {
  place_id?: number | string;
  display_name?: string;
  lat?: string;
  lon?: string;
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeLngLat(lon: unknown, lat: unknown): LngLat | null {
  const longitude = toNumber(lon);
  const latitude = toNumber(lat);
  if (longitude === null || latitude === null) return null;
  return [longitude, latitude];
}

export class NominatimGeocodingProvider implements GeocodingProvider {
  readonly id = "nominatim";
  private readonly endpoint: string;

  constructor(endpoint = import.meta.env.VITE_NOMINATIM_ENDPOINT) {
    this.endpoint = endpoint || "https://nominatim.openstreetmap.org";
  }

  async geocode(
    request: GeocodingRequest,
    signal?: AbortSignal,
  ): Promise<GeocodingResult[]> {
    const query = request.query.trim();
    if (!query) return [];

    const limit = Math.max(1, Math.min(request.limit ?? 5, 10));
    const url = new URL("/search", this.endpoint);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(limit));

    const response = await fetch(url.toString(), {
      signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new ProviderRequestError("Nominatim geocoding request failed", {
        providerId: this.id,
        status: response.status,
      });
    }

    const payload = (await response.json()) as unknown;
    const results = Array.isArray(payload) ? payload : [];
    const normalized: GeocodingResult[] = [];

    for (const entry of results) {
      const item = entry as NominatimSearchResult;
      if (!item.display_name) continue;
      const center = normalizeLngLat(item.lon, item.lat);
      if (!center) continue;

      const placeId =
        typeof item.place_id === "number" || typeof item.place_id === "string"
          ? String(item.place_id)
          : "";
      normalized.push({
        id: placeId ? `${this.id}:${placeId}` : `${this.id}:${item.display_name}`,
        placeName: item.display_name,
        center,
        providerId: this.id,
      });
    }

    return normalized;
  }
}

