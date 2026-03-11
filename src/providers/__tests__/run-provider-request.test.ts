import { describe, expect, it, vi } from "vitest";
import { ProviderRequestError } from "../errors";
import {
  dedupeProviders,
  runProviderRequest,
} from "../run-provider-request";
import type { ProviderTelemetryEvent } from "../telemetry";

type TestProvider = {
  id: "p1" | "p2" | "shared";
  run: () => Promise<string>;
};

describe("dedupeProviders", () => {
  it("keeps the first provider for each id", () => {
    const first = { id: "shared", run: vi.fn(async () => "first") };
    const second = { id: "shared", run: vi.fn(async () => "second") };
    const unique = dedupeProviders([first, second]);

    expect(unique).toEqual([first]);
  });
});

describe("runProviderRequest", () => {
  it("emits request, failure, fallback, and success telemetry around a fallback", async () => {
    const emit = vi.fn<(event: ProviderTelemetryEvent) => void>();
    const providers: TestProvider[] = [
      {
        id: "p1",
        run: async () => {
          throw new ProviderRequestError("rate limit", {
            providerId: "p1",
            status: 429,
          });
        },
      },
      {
        id: "p2",
        run: async () => "ok",
      },
    ];

    const result = await runProviderRequest({
      area: "geocoding",
      providers,
      emit,
      getRequestMessage: () => "bergen",
      execute: (provider) => provider.run(),
      getSuccessEvent: (value, context) => ({
        message: value,
        metadata: {
          fallbackUsed: context.index > 0,
        },
      }),
    });

    expect(result).toEqual({
      attemptedProviders: ["p1", "p2"],
      provider: providers[1],
      result: "ok",
    });

    expect(emit.mock.calls.map(([event]) => event.action)).toEqual([
      "request",
      "failure",
      "fallback",
      "request",
      "success",
    ]);
    expect(emit.mock.calls[2]?.[0]).toEqual(
      expect.objectContaining({
        action: "fallback",
        providerId: "p1",
        message: "rate_limited",
      }),
    );
    expect(emit.mock.calls[4]?.[0]).toEqual(
      expect.objectContaining({
        action: "success",
        providerId: "p2",
        message: "ok",
        metadata: {
          fallbackUsed: true,
        },
      }),
    );
  });

  it("rethrows abort errors without emitting failure or fallback telemetry", async () => {
    const emit = vi.fn<(event: ProviderTelemetryEvent) => void>();
    const abortError = new DOMException("aborted", "AbortError");

    await expect(
      runProviderRequest({
        area: "routing",
        providers: [
          {
            id: "p1",
            run: async () => {
              throw abortError;
            },
          },
        ],
        emit,
        getRequestMessage: () => "driving (2 pts)",
        execute: (provider) => provider.run(),
      }),
    ).rejects.toBe(abortError);

    expect(emit.mock.calls.map(([event]) => event.action)).toEqual(["request"]);
  });

  it("returns null when no providers are configured", async () => {
    const emit = vi.fn<(event: ProviderTelemetryEvent) => void>();

    const result = await runProviderRequest({
      area: "geocoding",
      providers: [],
      emit,
      getRequestMessage: () => "empty",
      execute: async () => "unused",
    });

    expect(result).toBeNull();
    expect(emit).not.toHaveBeenCalled();
  });
});
