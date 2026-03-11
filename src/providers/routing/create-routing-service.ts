import {
  emitProviderTelemetry,
  type ProviderTelemetryEvent,
} from "../telemetry";
import { dedupeProviders, runProviderRequest } from "../run-provider-request";
import type {
  RoutingProvider,
  RoutingRequest,
  RoutingResult,
  ProviderId,
} from "../types";

type RoutingServiceResponse = {
  providerId: ProviderId;
  result: RoutingResult;
  attemptedProviders: ProviderId[];
};

export type RoutingService = {
  route(
    request: RoutingRequest,
    signal?: AbortSignal,
  ): Promise<RoutingServiceResponse>;
};

type CreateRoutingServiceOptions = {
  primaryProvider: RoutingProvider;
  fallbackProviders?: RoutingProvider[];
  fallbackEnabled?: boolean;
  onTelemetry?: (event: ProviderTelemetryEvent) => void;
};

export function createRoutingService(
  options: CreateRoutingServiceOptions,
): RoutingService {
  const emit = options.onTelemetry ?? emitProviderTelemetry;
  const providers = dedupeProviders([
    options.primaryProvider,
    ...(options.fallbackEnabled ? options.fallbackProviders ?? [] : []),
  ]);

  return {
    async route(request, signal) {
      const response = await runProviderRequest({
        area: "routing",
        providers,
        emit,
        getRequestMessage: () =>
          `${request.profile || "driving"} (${request.coordinates.length} pts)`,
        execute: (candidate) => candidate.route(request, signal),
        getSuccessEvent: (result, context) => ({
          metadata: {
            fallbackUsed: context.index > 0,
            distance: result.summary.distanceMeters,
          },
        }),
      });

      if (!response) {
        throw new Error("Routing service failed: all providers exhausted");
      }

      return {
        providerId: response.provider.id,
        result: response.result,
        attemptedProviders: response.attemptedProviders,
      };
    },
  };
}
