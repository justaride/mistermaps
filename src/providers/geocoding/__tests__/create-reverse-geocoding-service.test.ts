import { describe, it, expect } from "vitest";
import { ProviderRequestError } from "../../errors";
import { createReverseGeocodingService } from "../create-reverse-geocoding-service";
import type {
  ReverseGeocodingProvider,
  ReverseGeocodingRequest,
  ReverseGeocodingResult,
} from "../../types";

function provider(
  id: string,
  fn: (
    req: ReverseGeocodingRequest,
  ) => Promise<ReverseGeocodingResult[]>,
): ReverseGeocodingProvider {
  return {
    id,
    reverseGeocode: fn,
  };
}

describe("createReverseGeocodingService", () => {
  it("returns primary provider results when successful", async () => {
    const p = provider("p1", async () => [
      {
        id: "p1:1",
        placeName: "A",
        center: [10, 59],
        providerId: "p1",
      },
    ]);

    const service = createReverseGeocodingService({
      primaryProvider: p,
      fallbackEnabled: true,
      fallbackProviders: [provider("p2", async () => [])],
      onTelemetry: () => {},
    });

    const res = await service.reverseGeocode({ center: [10, 59] });
    expect(res.providerId).toBe("p1");
    expect(res.results.length).toBe(1);
    expect(res.attemptedProviders).toEqual(["p1"]);
  });

  it("falls back when primary fails and fallback is enabled", async () => {
    const p1 = provider("p1", async () => {
      throw new ProviderRequestError("fail", { providerId: "p1", status: 500 });
    });
    const p2 = provider("p2", async () => [
      {
        id: "p2:1",
        placeName: "B",
        center: [10.1, 59.1],
        providerId: "p2",
      },
    ]);

    const service = createReverseGeocodingService({
      primaryProvider: p1,
      fallbackEnabled: true,
      fallbackProviders: [p2],
      onTelemetry: () => {},
    });

    const res = await service.reverseGeocode({ center: [10, 59] });
    expect(res.providerId).toBe("p2");
    expect(res.results[0]?.placeName).toBe("B");
    expect(res.attemptedProviders).toEqual(["p1", "p2"]);
  });

  it("throws when primary fails and fallback is disabled", async () => {
    const p1 = provider("p1", async () => {
      throw new ProviderRequestError("fail", { providerId: "p1", status: 503 });
    });
    const p2 = provider("p2", async () => []);

    const service = createReverseGeocodingService({
      primaryProvider: p1,
      fallbackEnabled: false,
      fallbackProviders: [p2],
      onTelemetry: () => {},
    });

    await expect(service.reverseGeocode({ center: [10, 59] })).rejects.toBeInstanceOf(
      ProviderRequestError,
    );
  });
});

