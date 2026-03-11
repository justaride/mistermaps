import {
  emitProviderTelemetry,
  type ProviderTelemetryEvent,
} from "../telemetry";
import { dedupeProviders, runProviderRequest } from "../run-provider-request";
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
      const response = await runProviderRequest({
        area: "geocoding",
        providers,
        emit,
        getRequestMessage: () =>
          `${request.center[0].toFixed(5)},${request.center[1].toFixed(5)}`,
        execute: (candidate) => candidate.reverseGeocode(request, signal),
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
