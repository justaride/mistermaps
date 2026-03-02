import { afterEach, describe, expect, it, vi } from "vitest";
import { MapboxMapMatchingProvider } from "../mapbox-map-matching-provider";
import { ProviderRequestError } from "../../errors";

describe("MapboxMapMatchingProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns matched geometry and confidence", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        code: "Ok",
        matchings: [
          {
            confidence: 0.92,
            geometry: {
              coordinates: [
                [10.0, 59.0],
                [10.1, 59.1],
              ],
            },
          },
        ],
      }),
    } as Response);

    const provider = new MapboxMapMatchingProvider("test-token");
    const result = await provider.match({
      trace: [
        [10.0, 59.0],
        [10.12, 59.11],
      ],
      profile: "driving",
      tidy: true,
    });

    expect(result.providerId).toBe("mapbox");
    expect(result.confidence).toBe(0.92);
    expect(result.originalTrace.coordinates).toEqual([
      [10.0, 59.0],
      [10.12, 59.11],
    ]);
    expect(result.matchedGeometry.coordinates).toEqual([
      [10.0, 59.0],
      [10.1, 59.1],
    ]);
  });

  it("throws clear error when token is missing", async () => {
    const provider = new MapboxMapMatchingProvider("");

    await expect(
      provider.match({
        trace: [
          [10.0, 59.0],
          [10.1, 59.1],
        ],
      }),
    ).rejects.toMatchObject({
      code: "missing_token",
    });
  });

  it("throws ProviderRequestError when HTTP request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 422,
    } as Response);

    const provider = new MapboxMapMatchingProvider("test-token");

    await expect(
      provider.match({
        trace: [
          [10.0, 59.0],
          [10.1, 59.1],
        ],
      }),
    ).rejects.toBeInstanceOf(ProviderRequestError);
  });
});
