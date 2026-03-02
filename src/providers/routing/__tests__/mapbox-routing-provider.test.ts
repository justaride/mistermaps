import { afterEach, describe, expect, it, vi } from "vitest";
import { MapboxRoutingProvider } from "../mapbox-routing-provider";
import { ProviderRequestError } from "../../errors";

describe("MapboxRoutingProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses geometry, summary, steps, and alternatives", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [
          {
            distance: 1200,
            duration: 320,
            geometry: {
              coordinates: [
                [10.0, 59.0],
                [10.1, 59.1],
              ],
            },
            legs: [
              {
                steps: [
                  {
                    distance: 100,
                    duration: 20,
                    maneuver: {
                      instruction: "Head north",
                      location: [10.0, 59.0],
                      type: "depart",
                    },
                  },
                ],
              },
            ],
          },
          {
            distance: 1400,
            duration: 380,
            geometry: {
              coordinates: [
                [10.0, 59.0],
                [10.2, 59.2],
              ],
            },
            legs: [
              {
                steps: [
                  {
                    distance: 150,
                    duration: 30,
                    maneuver: {
                      instruction: "Alternative turn",
                      location: [10.05, 59.05],
                      type: "turn",
                    },
                  },
                ],
              },
            ],
          },
        ],
      }),
    } as Response);

    const provider = new MapboxRoutingProvider("test-token");
    const result = await provider.route({
      coordinates: [
        [10.0, 59.0],
        [10.2, 59.2],
      ],
      profile: "driving",
      alternatives: true,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = String(fetchSpy.mock.calls[0]?.[0]);
    expect(url).toContain("alternatives=true");

    expect(result.geometry.coordinates).toEqual([
      [10.0, 59.0],
      [10.1, 59.1],
    ]);
    expect(result.summary).toEqual({
      distanceMeters: 1200,
      durationSeconds: 320,
    });

    expect(result.steps).toHaveLength(1);
    expect(result.steps?.[0]).toMatchObject({
      instruction: "Head north",
      distanceMeters: 100,
      durationSeconds: 20,
      maneuverType: "depart",
      location: [10.0, 59.0],
    });

    expect(result.alternatives).toHaveLength(1);
    expect(result.alternatives?.[0]).toMatchObject({
      id: "alt-1",
      summary: {
        distanceMeters: 1400,
        durationSeconds: 380,
      },
    });
    expect(result.alternatives?.[0]?.geometry.coordinates).toEqual([
      [10.0, 59.0],
      [10.2, 59.2],
    ]);
  });

  it("throws ProviderRequestError on non-ok responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const provider = new MapboxRoutingProvider("test-token");

    await expect(
      provider.route({
        coordinates: [
          [10.0, 59.0],
          [10.1, 59.1],
        ],
      }),
    ).rejects.toBeInstanceOf(ProviderRequestError);
  });
});
