import { ProviderRequestError } from "./errors";
import type { ProviderId } from "./types";

type ProviderArea = "geocoding" | "routing" | "basemap";
type ProviderEventAction = "request" | "success" | "failure" | "fallback";

export type ProviderTelemetryEvent = {
  area: ProviderArea;
  action: ProviderEventAction;
  providerId: ProviderId;
  message?: string;
  durationMs?: number;
  resultCount?: number;
  metadata?: Record<string, string | number | boolean>;
};

export function emitProviderTelemetry(event: ProviderTelemetryEvent): void {
  if (!import.meta.env.DEV) return;

  const payload: Record<string, unknown> = {
    area: event.area,
    action: event.action,
    providerId: event.providerId,
    ...(event.message ? { message: event.message } : {}),
    ...(event.durationMs !== undefined ? { durationMs: event.durationMs } : {}),
    ...(event.resultCount !== undefined ? { resultCount: event.resultCount } : {}),
    ...(event.metadata ? { metadata: event.metadata } : {}),
  };

  const prefix = "[provider]";
  if (event.action === "failure") {
    console.warn(prefix, payload);
    return;
  }
  console.info(prefix, payload);
}

export function describeProviderError(error: unknown): string {
  if (error instanceof ProviderRequestError) {
    const statusFragment =
      error.status !== undefined ? ` status=${error.status}` : "";
    const codeFragment = error.code ? ` code=${error.code}` : "";
    return `${error.providerId}${statusFragment}${codeFragment}: ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown provider error";
}
