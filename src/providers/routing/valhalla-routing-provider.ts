import { ProviderRequestError } from "../errors";
import type {
  RoutingProvider,
  RoutingRequest,
  RoutingResult,
  LngLat,
  RoutingProfile,
} from "../types";

const DEFAULT_VALHALLA_ENDPOINT = "https://valhalla1.openstreetmap.de";

type ValhallaIsochroneParams = {
  locations: { lon: number; lat: number }[];
  costing: string;
  contours: { time: number; color?: string }[];
  polygons?: boolean;
};

type ValhallaIsochroneResponse = {
  type: "FeatureCollection";
  features: GeoJSON.Feature[];
};

export type IsochroneRequest = {
  center: LngLat;
  minutes: number[];
  profile?: RoutingProfile;
};

function decodePolyline6(encoded: string): LngLat[] {
  const coords: LngLat[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push([lng / 1e6, lat / 1e6]);
  }

  return coords;
}

/**
 * Valhalla implementation of RoutingProvider + Advanced features (Isochrones).
 */
export class ValhallaRoutingProvider implements RoutingProvider {
  readonly id = "valhalla";
  private readonly endpoint: string;

  constructor(
    endpoint = import.meta.env.VITE_VALHALLA_ENDPOINT ||
      DEFAULT_VALHALLA_ENDPOINT,
  ) {
    this.endpoint = endpoint;
  }

  private mapCosting(profile?: RoutingProfile): string {
    switch (profile) {
      case "walking":
        return "pedestrian";
      case "cycling":
        return "bicycle";
      case "driving":
      default:
        return "auto";
    }
  }

  async route(
    request: RoutingRequest,
    signal?: AbortSignal,
  ): Promise<RoutingResult> {
    const costing = this.mapCosting(request.profile);
    const locations = request.coordinates.map(([lon, lat]) => ({ lon, lat }));

    const body = {
      locations,
      costing,
      units: "kilometers",
    };

    const url = `${this.endpoint}/route?json=${JSON.stringify(body)}`;
    const response = await fetch(url, { signal });

    if (!response.ok) {
      throw new ProviderRequestError("Valhalla routing request failed", {
        providerId: this.id,
        status: response.status,
      });
    }

    const payload = await response.json();
    const trip = payload.trip;

    if (!trip || !trip.legs) {
      throw new ProviderRequestError("Valhalla routing returned no trip", {
        providerId: this.id,
        code: "no_route",
      });
    }

    const coordinates: LngLat[] = [];
    for (const leg of trip.legs) {
      const decoded = decodePolyline6(leg.shape);
      coordinates.push(...decoded);
    }

    const summary = trip.summary ?? trip.legs[0]?.summary ?? {};

    return {
      geometry: { type: "LineString", coordinates },
      summary: {
        distanceMeters: (summary.length ?? 0) * 1000,
        durationSeconds: summary.time ?? 0,
      },
      providerId: this.id,
    };
  }

  /**
   * Fetch isochrones (time-distance polygons) from Valhalla.
   */
  async isochrone(
    request: IsochroneRequest,
    signal?: AbortSignal,
  ): Promise<ValhallaIsochroneResponse> {
    const costing = this.mapCosting(request.profile);
    const body: ValhallaIsochroneParams = {
      locations: [{ lon: request.center[0], lat: request.center[1] }],
      costing,
      contours: request.minutes.map((m) => ({ time: m })),
      polygons: true,
    };

    const url = `${this.endpoint}/isochrone?json=${JSON.stringify(body)}`;
    const response = await fetch(url, { signal });

    if (!response.ok) {
      throw new ProviderRequestError("Valhalla isochrone request failed", {
        providerId: this.id,
        status: response.status,
      });
    }

    return (await response.json()) as ValhallaIsochroneResponse;
  }
}
