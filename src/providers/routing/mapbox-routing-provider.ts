import { ProviderRequestError } from "../errors";
import type {
  LngLat,
  RoutingProvider,
  RoutingRequest,
  RoutingResult,
} from "../types";

const MAPBOX_DIRECTIONS_ENDPOINT =
  "https://api.mapbox.com/directions/v5/mapbox";

type MapboxDirectionsRoute = {
  distance?: number;
  duration?: number;
  geometry?: {
    coordinates?: unknown;
  };
};

type MapboxDirectionsResponse = {
  routes?: MapboxDirectionsRoute[];
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

export class MapboxRoutingProvider implements RoutingProvider {
  readonly id = "mapbox";
  private readonly accessToken: string;

  constructor(accessToken = import.meta.env.VITE_MAPBOX_TOKEN) {
    this.accessToken = accessToken;
  }

  async route(
    request: RoutingRequest,
    signal?: AbortSignal,
  ): Promise<RoutingResult> {
    if (request.coordinates.length < 2) {
      throw new ProviderRequestError("At least two coordinates are required", {
        providerId: this.id,
        code: "invalid_coordinates",
      });
    }

    if (!this.accessToken) {
      throw new ProviderRequestError("Mapbox token is not configured", {
        providerId: this.id,
        code: "missing_token",
      });
    }

    const profile = request.profile ?? "driving";
    const coordinateList = request.coordinates
      .map(([lng, lat]) => `${lng},${lat}`)
      .join(";");
    const params = new URLSearchParams({
      access_token: this.accessToken,
      geometries: "geojson",
      overview: "full",
      alternatives: request.alternatives ? "true" : "false",
    });
    const url = `${MAPBOX_DIRECTIONS_ENDPOINT}/${profile}/${coordinateList}?${params.toString()}`;
    const response = await fetch(url, { signal });

    if (!response.ok) {
      throw new ProviderRequestError("Mapbox routing request failed", {
        providerId: this.id,
        status: response.status,
      });
    }

    const payload = (await response.json()) as MapboxDirectionsResponse;
    const route = Array.isArray(payload.routes) ? payload.routes[0] : undefined;
    const geometryCoordinates = normalizeCoordinates(route?.geometry?.coordinates);

    if (!route || geometryCoordinates.length === 0) {
      throw new ProviderRequestError("Mapbox routing returned no geometry", {
        providerId: this.id,
        code: "no_route",
      });
    }

    return {
      providerId: this.id,
      geometry: {
        type: "LineString",
        coordinates: geometryCoordinates,
      },
      summary: {
        distanceMeters: typeof route.distance === "number" ? route.distance : 0,
        durationSeconds: typeof route.duration === "number" ? route.duration : 0,
      },
    };
  }
}
