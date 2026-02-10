import { isRateLimitError } from "../errors";
import {
  describeProviderError,
  emitProviderTelemetry,
  type ProviderTelemetryEvent,
} from "../telemetry";
import type {
  ProviderId,
  ReverseGeocodingProvider,
  ReverseGeocodingRequest,
  ReverseGeocodingResult,
} from "../types";

type ReverseGeocodingServiceResponse = {
  providerId: ProviderId;
  results: ReverseGeocodingResult[];
  attemptedProviders: ProviderId[];
};

export type ReverseGeocodingService = {
  reverseGeocode(
    request: ReverseGeocodingRequest,
    signal?: AbortSignal,
  ): Promise<ReverseGeocodingServiceResponse>;
};

type CreateReverseGeocodingServiceOptions = {
  primaryProvider: ReverseGeocodingProvider;
  fallbackProviders?: ReverseGeocodingProvider[];
  fallbackEnabled?: boolean;
  onTelemetry?: (event: ProviderTelemetryEvent) => void;
};

function dedupeProviders(
  providers: ReverseGeocodingProvider[],
): ReverseGeocodingProvider[] {
  const seen = new Set<string>();
  const unique: ReverseGeocodingProvider[] = [];

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

export function createReverseGeocodingService(
  options: CreateReverseGeocodingServiceOptions,
): ReverseGeocodingService {
  const emit = options.onTelemetry ?? emitProviderTelemetry;
  const providers = dedupeProviders([
    options.primaryProvider,
    ...(options.fallbackEnabled ? options.fallbackProviders ?? [] : []),
  ]);

  return {
    async reverseGeocode(request, signal) {
      const attemptedProviders: ProviderId[] = [];

      for (let index = 0; index < providers.length; index += 1) {
        const provider = providers[index];
        attemptedProviders.push(provider.id);
        const start = Date.now();

        emit({
          area: "geocoding",
          action: "request",
          providerId: provider.id,
          message: `${request.center[0].toFixed(5)},${request.center[1].toFixed(5)}`,
        });

        try {
          const results = await provider.reverseGeocode(request, signal);

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

