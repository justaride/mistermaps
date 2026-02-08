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

/**
 * Valhalla implementation of RoutingProvider + Advanced features (Isochrones).
 */
export class ValhallaRoutingProvider implements RoutingProvider {
  readonly id = "valhalla";
  private readonly endpoint: string;

  constructor(endpoint = import.meta.env.VITE_VALHALLA_ENDPOINT || DEFAULT_VALHALLA_ENDPOINT) {
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

    // Valhalla uses polyline6 by default usually, but we can request geojson or decode it.
    // For simplicity in this demo, we assume the server might support a geojson path or we decode.
    // Actually, Valhalla standard /route returns a 'shape' which is encoded polyline.
    // Let's check if we can get coordinates directly or if we need a decoder.
    // Most public Valhalla instances return 'shape'.
    
    throw new Error("Valhalla shape decoding not implemented yet in this adapter");
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
      contours: request.minutes.map(m => ({ time: m })),
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
