import type { Theme } from "../types";

export type ProviderId = string;
export type LngLat = [number, number];

export type GeocodingRequest = {
  query: string;
  limit?: number;
};

export type GeocodingResult = {
  id: string;
  placeName: string;
  center: LngLat;
  providerId: ProviderId;
};

export interface GeocodingProvider {
  id: ProviderId;
  geocode(
    request: GeocodingRequest,
    signal?: AbortSignal,
  ): Promise<GeocodingResult[]>;
}

export type RoutingProfile = "driving" | "walking" | "cycling";

export type RoutingRequest = {
  coordinates: LngLat[];
  profile?: RoutingProfile;
  alternatives?: boolean;
};

export type RoutingSummary = {
  distanceMeters: number;
  durationSeconds: number;
};

export type RoutingResult = {
  geometry: {
    type: "LineString";
    coordinates: LngLat[];
  };
  summary: RoutingSummary;
  providerId: ProviderId;
};

export interface RoutingProvider {
  id: ProviderId;
  route(request: RoutingRequest, signal?: AbortSignal): Promise<RoutingResult>;
}

export interface BasemapProvider<TStyle = unknown> {
  id: ProviderId;
  getStyle(theme: Theme): TStyle;
}
