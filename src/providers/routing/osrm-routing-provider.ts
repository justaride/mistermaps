import { ProviderRequestError } from "../errors";
import type {
  RoutingProvider,
  RoutingRequest,
  RoutingResult,
  RoutingProfile,
} from "../types";

const DEFAULT_OSRM_ENDPOINT = "https://router.project-osrm.org/route/v1";

type OSRMRoute = {
  distance?: number;
  duration?: number;
  geometry?: {
    type: "LineString";
    coordinates: [number, number][];
  };
};

type OSRMResponse = {
  code: string;
  message?: string;
  routes?: OSRMRoute[];
};

function mapProfile(profile?: RoutingProfile): string {
  switch (profile) {
    case "walking":
      return "foot";
    case "cycling":
      return "bike";
    case "driving":
    default:
      return "car";
  }
}

/**
 * OSRM (Open Source Routing Machine) implementation of the RoutingProvider.
 * Uses the standard OSRM v1 API.
 */
export class OSRMRoutingProvider implements RoutingProvider {
  readonly id = "osrm";
  private readonly endpoint: string;

  constructor(endpoint = import.meta.env.VITE_OSRM_ENDPOINT || DEFAULT_OSRM_ENDPOINT) {
    this.endpoint = endpoint;
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

    const profile = mapProfile(request.profile);
    const coordinateList = request.coordinates
      .map(([lng, lat]) => `${lng},${lat}`)
      .join(";");
    
    const params = new URLSearchParams({
      geometries: "geojson",
      overview: "full",
      alternatives: request.alternatives ? "true" : "false",
    });

    const url = `${this.endpoint}/${profile}/${coordinateList}?${params.toString()}`;
    const response = await fetch(url, { signal });

    if (!response.ok) {
      throw new ProviderRequestError("OSRM routing request failed", {
        providerId: this.id,
        status: response.status,
      });
    }

    const payload = (await response.json()) as OSRMResponse;

    if (payload.code !== "Ok") {
      throw new ProviderRequestError(payload.message || `OSRM error: ${payload.code}`, {
        providerId: this.id,
        code: payload.code.toLowerCase(),
      });
    }

    const route = Array.isArray(payload.routes) ? payload.routes[0] : undefined;

    if (!route || !route.geometry || !Array.isArray(route.geometry.coordinates)) {
      throw new ProviderRequestError("OSRM routing returned no geometry", {
        providerId: this.id,
        code: "no_route",
      });
    }

    return {
      providerId: this.id,
      geometry: {
        type: "LineString",
        coordinates: route.geometry.coordinates,
      },
      summary: {
        distanceMeters: typeof route.distance === "number" ? route.distance : 0,
        durationSeconds: typeof route.duration === "number" ? route.duration : 0,
      },
    };
  }
}
