import { ProviderRequestError } from "../errors";
import type {
  LngLat,
  RoutingAlternative,
  RoutingProfile,
  RoutingProvider,
  RoutingRequest,
  RoutingResult,
  RoutingStep,
} from "../types";

const DEFAULT_OSRM_ENDPOINT = "https://router.project-osrm.org/route/v1";

type OSRMRoute = {
  distance?: number;
  duration?: number;
  geometry?: {
    type: "LineString";
    coordinates?: unknown;
  };
  legs?: OSRMLeg[];
};

type OSRMLeg = {
  steps?: OSRMStep[];
};

type OSRMStep = {
  distance?: number;
  duration?: number;
  name?: string;
  maneuver?: {
    type?: string;
    modifier?: string;
    location?: unknown;
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

function normalizeCoordinate(raw: unknown): LngLat | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const [lng, lat] = raw;
  if (typeof lng !== "number" || typeof lat !== "number") return null;
  return [lng, lat];
}

function toTitleCase(value: string): string {
  return value
    .split(/[\s_-]+/g)
    .filter(Boolean)
    .map((token) => token.slice(0, 1).toUpperCase() + token.slice(1))
    .join(" ");
}

function buildInstruction(step: OSRMStep): string {
  const type = typeof step.maneuver?.type === "string" ? step.maneuver.type : "";
  const modifier =
    typeof step.maneuver?.modifier === "string" ? step.maneuver.modifier : "";
  const name = typeof step.name === "string" ? step.name.trim() : "";

  if (type === "depart") {
    return name ? `Depart onto ${name}` : "Depart";
  }

  if (type === "arrive") {
    return "Arrive at destination";
  }

  if (type === "roundabout") {
    return name ? `Enter roundabout onto ${name}` : "Enter roundabout";
  }

  if (type) {
    const typeLabel = toTitleCase(type);
    const modifierLabel = modifier ? ` ${modifier.toLowerCase()}` : "";
    return name ? `${typeLabel}${modifierLabel} onto ${name}` : `${typeLabel}${modifierLabel}`.trim();
  }

  if (name) {
    return `Continue on ${name}`;
  }

  return "Continue";
}

function parseSteps(route: OSRMRoute): RoutingStep[] {
  if (!Array.isArray(route.legs)) return [];

  const out: RoutingStep[] = [];
  for (const leg of route.legs) {
    if (!Array.isArray(leg.steps)) continue;
    for (const step of leg.steps) {
      const location = normalizeCoordinate(step.maneuver?.location);
      const maneuverType =
        typeof step.maneuver?.type === "string" ? step.maneuver.type : undefined;

      out.push({
        instruction: buildInstruction(step),
        distanceMeters: typeof step.distance === "number" ? step.distance : 0,
        durationSeconds: typeof step.duration === "number" ? step.duration : 0,
        location: location ?? undefined,
        maneuverType,
      });
    }
  }

  return out;
}

function toAlternative(route: OSRMRoute, index: number): RoutingAlternative | null {
  const coordinates = normalizeCoordinates(route.geometry?.coordinates);
  if (coordinates.length === 0) return null;

  return {
    id: `alt-${index + 1}`,
    geometry: {
      type: "LineString",
      coordinates,
    },
    summary: {
      distanceMeters: typeof route.distance === "number" ? route.distance : 0,
      durationSeconds: typeof route.duration === "number" ? route.duration : 0,
    },
    steps: parseSteps(route),
  };
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
      steps: "true",
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

    const geometryCoordinates = normalizeCoordinates(route?.geometry?.coordinates);
    if (!route || geometryCoordinates.length === 0) {
      throw new ProviderRequestError("OSRM routing returned no geometry", {
        providerId: this.id,
        code: "no_route",
      });
    }

    const steps = parseSteps(route);
    const alternatives = (payload.routes ?? [])
      .slice(1)
      .map((candidate, index) => toAlternative(candidate, index))
      .filter((candidate): candidate is RoutingAlternative => Boolean(candidate));

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
      steps,
      alternatives: alternatives.length > 0 ? alternatives : undefined,
    };
  }
}
