import {
  emitProviderTelemetry,
  type ProviderTelemetryEvent,
} from "../telemetry";
import { dedupeProviders, runProviderRequest } from "../run-provider-request";
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
      const response = await runProviderRequest({
        area: "geocoding",
        providers,
        emit,
        getRequestMessage: () => request.query,
        execute: (candidate) => candidate.geocode(request, signal),
        getSuccessEvent: (results, context) => ({
          resultCount: results.length,
          metadata: {
            fallbackUsed: context.index > 0,
          },
        }),
      });

      if (!response) {
        return {
          providerId: options.primaryProvider.id,
          results: [],
          attemptedProviders: [],
        };
      }

      return {
        providerId: response.provider.id,
        results: response.result,
        attemptedProviders: response.attemptedProviders,
      };
    },
  };
}
