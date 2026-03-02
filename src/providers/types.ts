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

export type ReverseGeocodingRequest = {
  center: LngLat;
  limit?: number;
};

export type ReverseGeocodingResult = {
  id: string;
  placeName: string;
  center: LngLat;
  providerId: ProviderId;
};

export interface ReverseGeocodingProvider {
  id: ProviderId;
  reverseGeocode(
    request: ReverseGeocodingRequest,
    signal?: AbortSignal,
  ): Promise<ReverseGeocodingResult[]>;
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

export type RoutingStep = {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  location?: LngLat;
  maneuverType?: string;
};

export type RoutingAlternative = {
  id: string;
  geometry: {
    type: "LineString";
    coordinates: LngLat[];
  };
  summary: RoutingSummary;
  steps?: RoutingStep[];
};

export type RoutingResult = {
  geometry: {
    type: "LineString";
    coordinates: LngLat[];
  };
  summary: RoutingSummary;
  steps?: RoutingStep[];
  alternatives?: RoutingAlternative[];
  providerId: ProviderId;
};

export interface RoutingProvider {
  id: ProviderId;
  route(request: RoutingRequest, signal?: AbortSignal): Promise<RoutingResult>;
}

export type MapMatchingRequest = {
  trace: LngLat[];
  profile?: RoutingProfile;
  tidy?: boolean;
};

export type MapMatchingResult = {
  matchedGeometry: {
    type: "LineString";
    coordinates: LngLat[];
  };
  originalTrace: {
    type: "LineString";
    coordinates: LngLat[];
  };
  confidence?: number;
  providerId: ProviderId;
};

export interface MapMatchingProvider {
  id: ProviderId;
  match(
    request: MapMatchingRequest,
    signal?: AbortSignal,
  ): Promise<MapMatchingResult>;
}

export interface BasemapProvider<TStyle = unknown> {
  id: ProviderId;
  getStyle(theme: Theme): TStyle;
}
