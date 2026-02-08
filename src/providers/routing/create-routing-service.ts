import { isRateLimitError } from "../errors";
import {
  describeProviderError,
  emitProviderTelemetry,
  type ProviderTelemetryEvent,
} from "../telemetry";
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

function dedupeProviders(providers: RoutingProvider[]): RoutingProvider[] {
  const seen = new Set<string>();
  const unique: RoutingProvider[] = [];

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
      const attemptedProviders: ProviderId[] = [];

      for (let index = 0; index < providers.length; index += 1) {
        const provider = providers[index];
        attemptedProviders.push(provider.id);
        const start = Date.now();

        emit({
          area: "routing",
          action: "request",
          providerId: provider.id,
          message: `${request.profile || "driving"} (${request.coordinates.length} pts)`,
        });

        try {
          const result = await provider.route(request, signal);

          emit({
            area: "routing",
            action: "success",
            providerId: provider.id,
            durationMs: Date.now() - start,
            metadata: {
              fallbackUsed: index > 0,
              distance: result.summary.distanceMeters,
            },
          });

          return {
            providerId: provider.id,
            result,
            attemptedProviders,
          };
        } catch (error) {
          if (isAbortError(error)) throw error;

          emit({
            area: "routing",
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
            area: "routing",
            action: "fallback",
            providerId: provider.id,
            message: isRateLimitError(error) ? "rate_limited" : "provider_error",
          });
        }
      }

      throw new Error("Routing service failed: all providers exhausted");
    },
  };
}
