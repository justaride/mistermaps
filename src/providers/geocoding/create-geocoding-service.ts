import { isRateLimitError } from "../errors";
import {
  describeProviderError,
  emitProviderTelemetry,
  type ProviderTelemetryEvent,
} from "../telemetry";
import type {
  GeocodingProvider,
  GeocodingRequest,
  GeocodingResult,
  ProviderId,
} from "../types";

type GeocodingServiceResponse = {
  providerId: ProviderId;
  results: GeocodingResult[];
  attemptedProviders: ProviderId[];
};

export type GeocodingService = {
  geocode(
    request: GeocodingRequest,
    signal?: AbortSignal,
  ): Promise<GeocodingServiceResponse>;
};

type CreateGeocodingServiceOptions = {
  primaryProvider: GeocodingProvider;
  fallbackProviders?: GeocodingProvider[];
  fallbackEnabled?: boolean;
  onTelemetry?: (event: ProviderTelemetryEvent) => void;
};

function dedupeProviders(providers: GeocodingProvider[]): GeocodingProvider[] {
  const seen = new Set<string>();
  const unique: GeocodingProvider[] = [];

  for (const provider of providers) {
    if (seen.has(provider.id)) continue;
    seen.add(provider.id);
    unique.push(provider);
  }

  return unique;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function createGeocodingService(
  options: CreateGeocodingServiceOptions,
): GeocodingService {
  const emit = options.onTelemetry ?? emitProviderTelemetry;
  const providers = dedupeProviders([
    options.primaryProvider,
    ...(options.fallbackEnabled ? options.fallbackProviders ?? [] : []),
  ]);

  return {
    async geocode(request, signal) {
      const attemptedProviders: ProviderId[] = [];

      for (let index = 0; index < providers.length; index += 1) {
        const provider = providers[index];
        attemptedProviders.push(provider.id);
        const start = Date.now();

        emit({
          area: "geocoding",
          action: "request",
          providerId: provider.id,
          message: request.query,
        });

        try {
          const results = await provider.geocode(request, signal);

          emit({
            area: "geocoding",
            action: "success",
            providerId: provider.id,
            durationMs: Date.now() - start,
            resultCount: results.length,
            metadata: {
              fallbackUsed: index > 0,
            },
          });

          return {
            providerId: provider.id,
            results,
            attemptedProviders,
          };
        } catch (error) {
          if (isAbortError(error)) throw error;

          emit({
            area: "geocoding",
            action: "failure",
            providerId: provider.id,
            durationMs: Date.now() - start,
            message: describeProviderError(error),
          });

          const hasFallback = index < providers.length - 1;
          if (!hasFallback) {
            throw error;
          }

          emit({
            area: "geocoding",
            action: "fallback",
            providerId: provider.id,
            message: isRateLimitError(error) ? "rate_limited" : "provider_error",
          });
        }
      }

      return {
        providerId: options.primaryProvider.id,
        results: [],
        attemptedProviders,
      };
    },
  };
}
