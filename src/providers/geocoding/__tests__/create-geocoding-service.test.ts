import { describe, expect, it, vi } from "vitest";
import { ProviderRequestError } from "../../errors";
import { createGeocodingService } from "../create-geocoding-service";
import type {
  GeocodingProvider,
  GeocodingRequest,
  GeocodingResult,
} from "../../types";

function provider(
  id: string,
  fn: (request: GeocodingRequest) => Promise<GeocodingResult[]>,
): GeocodingProvider {
  return {
    id,
    geocode: fn,
  };
}

describe("createGeocodingService", () => {
  it("returns primary provider results when successful", async () => {
    const p1 = provider("p1", async () => [
      {
        id: "p1:1",
        placeName: "Oslo",
        center: [10.75, 59.91],
        providerId: "p1",
      },
    ]);

    const service = createGeocodingService({
      primaryProvider: p1,
      fallbackEnabled: true,
      fallbackProviders: [provider("p2", async () => [])],
      onTelemetry: () => {},
    });

    const result = await service.geocode({ query: "oslo" });

    expect(result.providerId).toBe("p1");
    expect(result.results).toHaveLength(1);
    expect(result.attemptedProviders).toEqual(["p1"]);
  });

  it("falls back when the primary provider fails", async () => {
    const p1 = provider("p1", async () => {
      throw new ProviderRequestError("fail", { providerId: "p1", status: 500 });
    });
    const p2 = provider("p2", async () => [
      {
        id: "p2:1",
        placeName: "Bergen",
        center: [5.32, 60.39],
        providerId: "p2",
      },
    ]);

    const service = createGeocodingService({
      primaryProvider: p1,
      fallbackEnabled: true,
      fallbackProviders: [p2],
      onTelemetry: () => {},
    });

    const result = await service.geocode({ query: "bergen" });

    expect(result.providerId).toBe("p2");
    expect(result.results[0]?.placeName).toBe("Bergen");
    expect(result.attemptedProviders).toEqual(["p1", "p2"]);
  });

  it("deduplicates fallback providers by id", async () => {
    const telemetry = vi.fn();
    const primary = provider("shared", async () => [
      {
        id: "shared:1",
        placeName: "Trondheim",
        center: [10.39, 63.43],
        providerId: "shared",
      },
    ]);

    const service = createGeocodingService({
      primaryProvider: primary,
      fallbackEnabled: true,
      fallbackProviders: [
        provider("shared", async () => {
          throw new Error("should not run");
        }),
      ],
      onTelemetry: telemetry,
    });

    await service.geocode({ query: "trondheim" });

    const requestEvents = telemetry.mock.calls
      .map(([event]) => event)
      .filter((event) => event.action === "request");

    expect(requestEvents).toHaveLength(1);
    expect(requestEvents[0]?.providerId).toBe("shared");
  });

  it("throws when fallback is disabled", async () => {
    const p1 = provider("p1", async () => {
      throw new ProviderRequestError("fail", { providerId: "p1", status: 429 });
    });

    const service = createGeocodingService({
      primaryProvider: p1,
      fallbackEnabled: false,
      fallbackProviders: [provider("p2", async () => [])],
      onTelemetry: () => {},
    });

    await expect(service.geocode({ query: "hammerfest" })).rejects.toBeInstanceOf(
      ProviderRequestError,
    );
  });
});
