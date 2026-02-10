import { providerFeatureFlags } from "../feature-flags";
import { emitProviderTelemetry } from "../telemetry";
import type { GeocodingProvider, ProviderId, ReverseGeocodingProvider } from "../types";
import {
  createGeocodingService,
  type GeocodingService,
} from "./create-geocoding-service";
import {
  createReverseGeocodingService,
  type ReverseGeocodingService,
} from "./create-reverse-geocoding-service";
import { MapboxGeocodingProvider } from "./mapbox-geocoding-provider";
import { NominatimGeocodingProvider } from "./nominatim-geocoding-provider";
import { PhotonGeocodingProvider } from "./photon-geocoding-provider";

type GeocodingProviderFactory = () => GeocodingProvider;

const geocodingProviderFactories: Record<string, GeocodingProviderFactory> = {
  mapbox: () => new MapboxGeocodingProvider(),
  nominatim: () => new NominatimGeocodingProvider(),
  photon: () => new PhotonGeocodingProvider(),
};

type ReverseGeocodingProviderFactory = () => ReverseGeocodingProvider;

const reverseGeocodingProviderFactories: Record<
  string,
  ReverseGeocodingProviderFactory
> = {
  mapbox: () => new MapboxGeocodingProvider(),
  nominatim: () => new NominatimGeocodingProvider(),
};

function resolveGeocodingProvider(providerId: ProviderId): GeocodingProvider | null {
  const factory = geocodingProviderFactories[providerId.toLowerCase()];
  return factory ? factory() : null;
}

function resolveReverseGeocodingProvider(
  providerId: ProviderId,
): ReverseGeocodingProvider | null {
  const factory = reverseGeocodingProviderFactories[providerId.toLowerCase()];
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

function resolveReverseFallbackProviders(
  primaryProviderId: ProviderId,
): ReverseGeocodingProvider[] {
  const fallbackProviders: ReverseGeocodingProvider[] = [];

  for (const fallbackId of providerFeatureFlags.geocodingFallbackOrder) {
    if (fallbackId.toLowerCase() === primaryProviderId.toLowerCase()) continue;
    const provider = resolveReverseGeocodingProvider(fallbackId);
    if (provider) {
      fallbackProviders.push(provider);
      continue;
    }
    emitProviderTelemetry({
      area: "geocoding",
      action: "fallback",
      providerId: fallbackId,
      message: "missing_reverse_adapter",
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

export function createDefaultReverseGeocodingService(): ReverseGeocodingService {
  const requestedPrimary = providerFeatureFlags.geocodingPrimaryProvider;
  const primaryProvider =
    resolveReverseGeocodingProvider(requestedPrimary) ??
    new MapboxGeocodingProvider();

  if (primaryProvider.id !== requestedPrimary) {
    emitProviderTelemetry({
      area: "geocoding",
      action: "fallback",
      providerId: requestedPrimary,
      message: "unknown_reverse_primary_provider",
    });
  }

  const fallbackProviders = providerFeatureFlags.geocodingFallbackEnabled
    ? resolveReverseFallbackProviders(primaryProvider.id)
    : [];

  return createReverseGeocodingService({
    primaryProvider,
    fallbackProviders,
    fallbackEnabled: providerFeatureFlags.geocodingFallbackEnabled,
    onTelemetry: emitProviderTelemetry,
  });
}

export const reverseGeocodingService = createDefaultReverseGeocodingService();

export {
  createGeocodingService,
  createReverseGeocodingService,
  MapboxGeocodingProvider,
  NominatimGeocodingProvider,
};
export type { GeocodingService, ReverseGeocodingService };
