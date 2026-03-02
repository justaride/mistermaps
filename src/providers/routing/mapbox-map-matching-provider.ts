import { ProviderRequestError } from "../errors";
import type {
  LngLat,
  MapMatchingProvider,
  MapMatchingRequest,
  MapMatchingResult,
} from "../types";

const MAPBOX_MAP_MATCHING_ENDPOINT = "https://api.mapbox.com/matching/v5/mapbox";

type MapboxMapMatching = {
  confidence?: number;
  geometry?: {
    coordinates?: unknown;
  };
};

type MapboxMapMatchingResponse = {
  code?: string;
  message?: string;
  matchings?: MapboxMapMatching[];
};

function normalizeCoordinates(raw: unknown): LngLat[] {
  if (!Array.isArray(raw)) return [];

  const coords: LngLat[] = [];
  for (const candidate of raw) {
    if (!Array.isArray(candidate) || candidate.length < 2) continue;
    const [lng, lat] = candidate;
    if (typeof lng !== "number" || typeof lat !== "number") continue;
    coords.push([lng, lat]);
  }

  return coords;
}

export class MapboxMapMatchingProvider implements MapMatchingProvider {
  readonly id = "mapbox";
  private readonly accessToken: string;

  constructor(accessToken = import.meta.env.VITE_MAPBOX_TOKEN) {
    this.accessToken = accessToken;
  }

  async match(
    request: MapMatchingRequest,
    signal?: AbortSignal,
  ): Promise<MapMatchingResult> {
    const trace = normalizeCoordinates(request.trace);
    if (trace.length < 2) {
      throw new ProviderRequestError("At least two trace coordinates are required", {
        providerId: this.id,
        code: "invalid_trace",
      });
    }

    if (!this.accessToken) {
      throw new ProviderRequestError("Mapbox token is not configured", {
        providerId: this.id,
        code: "missing_token",
      });
    }

    const profile = request.profile ?? "driving";
    const coordinateList = trace.map(([lng, lat]) => `${lng},${lat}`).join(";");
    const params = new URLSearchParams({
      access_token: this.accessToken,
      geometries: "geojson",
      overview: "full",
      tidy: request.tidy ? "true" : "false",
    });

    const url = `${MAPBOX_MAP_MATCHING_ENDPOINT}/${profile}/${coordinateList}?${params.toString()}`;
    const response = await fetch(url, { signal });

    if (!response.ok) {
      throw new ProviderRequestError("Mapbox map matching request failed", {
        providerId: this.id,
        status: response.status,
      });
    }

    const payload = (await response.json()) as MapboxMapMatchingResponse;
    if (payload.code && payload.code !== "Ok") {
      throw new ProviderRequestError(
        payload.message || `Mapbox map matching error: ${payload.code}`,
        {
          providerId: this.id,
          code: payload.code.toLowerCase(),
        },
      );
    }

    const matching = Array.isArray(payload.matchings)
      ? payload.matchings[0]
      : undefined;
    const matchedCoordinates = normalizeCoordinates(matching?.geometry?.coordinates);

    if (!matching || matchedCoordinates.length === 0) {
      throw new ProviderRequestError("Mapbox map matching returned no geometry", {
        providerId: this.id,
        code: "no_match",
      });
    }

    return {
      providerId: this.id,
      matchedGeometry: {
        type: "LineString",
        coordinates: matchedCoordinates,
      },
      originalTrace: {
        type: "LineString",
        coordinates: trace,
      },
      confidence:
        typeof matching.confidence === "number" ? matching.confidence : undefined,
    };
  }
}
