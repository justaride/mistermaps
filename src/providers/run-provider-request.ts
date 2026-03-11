import { isRateLimitError } from "./errors";
import {
  describeProviderError,
  type ProviderTelemetryEvent,
} from "./telemetry";
import type { ProviderId } from "./types";

type ProviderArea = ProviderTelemetryEvent["area"];

type ProviderWithId = {
  id: ProviderId;
};

type RunProviderRequestOptions<
  TProvider extends ProviderWithId,
  TResult,
> = {
  area: ProviderArea;
  providers: TProvider[];
  emit: (event: ProviderTelemetryEvent) => void;
  getRequestMessage: () => string;
  execute: (provider: TProvider) => Promise<TResult>;
  getSuccessEvent?: (
    result: TResult,
    context: { index: number },
  ) => Pick<ProviderTelemetryEvent, "message" | "metadata" | "resultCount">;
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function dedupeProviders<TProvider extends ProviderWithId>(
  providers: TProvider[],
): TProvider[] {
  const seen = new Set<string>();
  const unique: TProvider[] = [];

  for (const provider of providers) {
    if (seen.has(provider.id)) continue;
    seen.add(provider.id);
    unique.push(provider);
  }

  return unique;
}

export async function runProviderRequest<
  TProvider extends ProviderWithId,
  TResult,
>({
  area,
  providers,
  emit,
  getRequestMessage,
  execute,
  getSuccessEvent,
}: RunProviderRequestOptions<TProvider, TResult>): Promise<{
  attemptedProviders: ProviderId[];
  provider: TProvider;
  result: TResult;
} | null> {
  const attemptedProviders: ProviderId[] = [];

  for (let index = 0; index < providers.length; index += 1) {
    const provider = providers[index];
    attemptedProviders.push(provider.id);
    const start = Date.now();

    emit({
      area,
      action: "request",
      providerId: provider.id,
      message: getRequestMessage(),
    });

    try {
      const result = await execute(provider);

      emit({
        area,
        action: "success",
        providerId: provider.id,
        durationMs: Date.now() - start,
        ...(getSuccessEvent?.(result, { index }) ?? {}),
      });

      return {
        attemptedProviders,
        provider,
        result,
      };
    } catch (error) {
      if (isAbortError(error)) throw error;

      emit({
        area,
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
        area,
        action: "fallback",
        providerId: provider.id,
        message: isRateLimitError(error) ? "rate_limited" : "provider_error",
      });
    }
  }

  return null;
}
