import { ProviderRequestError } from "../errors";
import type {
  GeocodingProvider,
  GeocodingRequest,
  GeocodingResult,
  LngLat,
} from "../types";

type PhotonFeature = {
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
  properties?: Record<string, unknown>;
};

type PhotonResponse = {
  features?: PhotonFeature[];
};

function normalizeLngLat(raw: unknown): LngLat | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const [lng, lat] = raw;
  if (typeof lng !== "number" || typeof lat !== "number") return null;
  return [lng, lat];
}

function formatPhotonPlaceName(properties: Record<string, unknown>): string {
  const pick = (key: string): string => {
    const value = properties[key];
    return typeof value === "string" ? value : "";
  };

  const name = pick("name") || pick("street") || pick("housenumber");
  const city = pick("city") || pick("town") || pick("village");
  const state = pick("state") || pick("county");
  const country = pick("country");

  const parts = [name, city, state, country].filter(Boolean);
  return parts.join(", ");
}

export class PhotonGeocodingProvider implements GeocodingProvider {
  readonly id = "photon";
  private readonly endpoint: string;

  constructor(endpoint = import.meta.env.VITE_PHOTON_ENDPOINT) {
    this.endpoint = endpoint || "https://photon.komoot.io";
  }

  async geocode(
    request: GeocodingRequest,
    signal?: AbortSignal,
  ): Promise<GeocodingResult[]> {
    const query = request.query.trim();
    if (!query) return [];

    const limit = Math.max(1, Math.min(request.limit ?? 5, 10));
    const url = new URL("/api", this.endpoint);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(limit));

    const response = await fetch(url.toString(), {
      signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new ProviderRequestError("Photon geocoding request failed", {
        providerId: this.id,
        status: response.status,
      });
    }

    const payload = (await response.json()) as PhotonResponse;
    const features = Array.isArray(payload.features) ? payload.features : [];
    const results: GeocodingResult[] = [];

    for (const feature of features) {
      const properties = feature.properties ?? {};
      const center = normalizeLngLat(feature.geometry?.coordinates);
      if (!center) continue;

      const osmType =
        typeof properties.osm_type === "string" ? properties.osm_type : "";
      const osmId =
        typeof properties.osm_id === "number" || typeof properties.osm_id === "string"
          ? String(properties.osm_id)
          : "";
      const placeName = formatPhotonPlaceName(properties);

      results.push({
        id:
          osmId && osmType
            ? `${this.id}:${osmType}:${osmId}`
            : osmId
              ? `${this.id}:${osmId}`
              : `${this.id}:${placeName || center.join(",")}`,
        placeName: placeName || "Unknown place",
        center,
        providerId: this.id,
      });
    }

    return results;
  }
}

