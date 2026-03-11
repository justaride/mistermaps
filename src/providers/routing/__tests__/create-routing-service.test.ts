import { describe, expect, it, vi } from "vitest";
import { ProviderRequestError } from "../../errors";
import { createRoutingService } from "../create-routing-service";
import type {
  RoutingProvider,
  RoutingRequest,
  RoutingResult,
} from "../../types";

function provider(
  id: string,
  fn: (request: RoutingRequest) => Promise<RoutingResult>,
): RoutingProvider {
  return {
    id,
    route: fn,
  };
}

function createRoutingResult(providerId: string): RoutingResult {
  return {
    providerId,
    geometry: {
      type: "LineString",
      coordinates: [
        [10.0, 59.0],
        [10.1, 59.1],
      ],
    },
    summary: {
      distanceMeters: 1200,
      durationSeconds: 300,
    },
    steps: [],
  };
}

describe("createRoutingService", () => {
  it("returns primary provider results when successful", async () => {
    const p1 = provider("p1", async () => createRoutingResult("p1"));

    const service = createRoutingService({
      primaryProvider: p1,
      fallbackEnabled: true,
      fallbackProviders: [provider("p2", async () => createRoutingResult("p2"))],
      onTelemetry: () => {},
    });

    const result = await service.route({
      coordinates: [
        [10.0, 59.0],
        [10.1, 59.1],
      ],
    });

    expect(result.providerId).toBe("p1");
    expect(result.attemptedProviders).toEqual(["p1"]);
    expect(result.result.summary.distanceMeters).toBe(1200);
  });

  it("falls back when the primary provider fails", async () => {
    const p1 = provider("p1", async () => {
      throw new ProviderRequestError("fail", { providerId: "p1", status: 500 });
    });
    const p2 = provider("p2", async () => createRoutingResult("p2"));

    const service = createRoutingService({
      primaryProvider: p1,
      fallbackEnabled: true,
      fallbackProviders: [p2],
      onTelemetry: () => {},
    });

    const result = await service.route({
      coordinates: [
        [10.0, 59.0],
        [10.1, 59.1],
      ],
    });

    expect(result.providerId).toBe("p2");
    expect(result.attemptedProviders).toEqual(["p1", "p2"]);
    expect(result.result.providerId).toBe("p2");
  });

  it("deduplicates fallback providers by id", async () => {
    const telemetry = vi.fn();
    const primary = provider("shared", async () => createRoutingResult("shared"));

    const service = createRoutingService({
      primaryProvider: primary,
      fallbackEnabled: true,
      fallbackProviders: [
        provider("shared", async () => {
          throw new Error("should not run");
        }),
      ],
      onTelemetry: telemetry,
    });

    await service.route({
      coordinates: [
        [10.0, 59.0],
        [10.1, 59.1],
      ],
    });

    const requestEvents = telemetry.mock.calls
      .map(([event]) => event)
      .filter((event) => event.action === "request");

    expect(requestEvents).toHaveLength(1);
    expect(requestEvents[0]?.providerId).toBe("shared");
  });

  it("throws when fallback is disabled", async () => {
    const p1 = provider("p1", async () => {
      throw new ProviderRequestError("fail", { providerId: "p1", status: 503 });
    });

    const service = createRoutingService({
      primaryProvider: p1,
      fallbackEnabled: false,
      fallbackProviders: [provider("p2", async () => createRoutingResult("p2"))],
      onTelemetry: () => {},
    });

    await expect(
      service.route({
        coordinates: [
          [10.0, 59.0],
          [10.1, 59.1],
        ],
      }),
    ).rejects.toBeInstanceOf(ProviderRequestError);
  });
});
