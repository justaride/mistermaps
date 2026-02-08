import { providerFeatureFlags } from "../feature-flags";
import { emitProviderTelemetry } from "../telemetry";
import type { GeocodingProvider, ProviderId } from "../types";
import {
  createGeocodingService,
  type GeocodingService,
} from "./create-geocoding-service";
import { MapboxGeocodingProvider } from "./mapbox-geocoding-provider";
import { NominatimGeocodingProvider } from "./nominatim-geocoding-provider";
import { PhotonGeocodingProvider } from "./photon-geocoding-provider";

type GeocodingProviderFactory = () => GeocodingProvider;

const geocodingProviderFactories: Record<string, GeocodingProviderFactory> = {
  mapbox: () => new MapboxGeocodingProvider(),
  nominatim: () => new NominatimGeocodingProvider(),
  photon: () => new PhotonGeocodingProvider(),
};

function resolveGeocodingProvider(providerId: ProviderId): GeocodingProvider | null {
  const factory = geocodingProviderFactories[providerId.toLowerCase()];
  return factory ? factory() : null;
}

function resolveFallbackProviders(primaryProviderId: ProviderId): GeocodingProvider[] {
  const fallbackProviders: GeocodingProvider[] = [];

  for (const fallbackId of providerFeatureFlags.geocodingFallbackOrder) {
    if (fallbackId.toLowerCase() === primaryProviderId.toLowerCase()) continue;
    const provider = resolveGeocodingProvider(fallbackId);
    if (provider) {
      fallbackProviders.push(provider);
      continue;
    }
    emitProviderTelemetry({
      area: "geocoding",
      action: "fallback",
      providerId: fallbackId,
      message: "missing_adapter",
    });
  }

  return fallbackProviders;
}

export function createDefaultGeocodingService(): GeocodingService {
  const requestedPrimary = providerFeatureFlags.geocodingPrimaryProvider;
  const primaryProvider =
    resolveGeocodingProvider(requestedPrimary) ?? new MapboxGeocodingProvider();

  if (primaryProvider.id !== requestedPrimary) {
    emitProviderTelemetry({
      area: "geocoding",
      action: "fallback",
      providerId: requestedPrimary,
      message: "unknown_primary_provider",
    });
  }

  const fallbackProviders = providerFeatureFlags.geocodingFallbackEnabled
    ? resolveFallbackProviders(primaryProvider.id)
    : [];

  return createGeocodingService({
    primaryProvider,
    fallbackProviders,
    fallbackEnabled: providerFeatureFlags.geocodingFallbackEnabled,
    onTelemetry: emitProviderTelemetry,
  });
}

export const geocodingService = createDefaultGeocodingService();

export { createGeocodingService, MapboxGeocodingProvider };
export type { GeocodingService };
