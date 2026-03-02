import { afterEach, describe, expect, it, vi } from "vitest";
import { OSRMRoutingProvider } from "../osrm-routing-provider";
import { ProviderRequestError } from "../../errors";

describe("OSRMRoutingProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses geometry, summary, steps, and alternatives", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        code: "Ok",
        routes: [
          {
            distance: 900,
            duration: 210,
            geometry: {
              type: "LineString",
              coordinates: [
                [10.0, 59.0],
                [10.15, 59.15],
              ],
            },
            legs: [
              {
                steps: [
                  {
                    distance: 120,
                    duration: 22,
                    name: "Main St",
                    maneuver: {
                      type: "depart",
                      location: [10.0, 59.0],
                    },
                  },
                ],
              },
            ],
          },
          {
            distance: 1100,
            duration: 260,
            geometry: {
              type: "LineString",
              coordinates: [
                [10.0, 59.0],
                [10.2, 59.2],
              ],
            },
            legs: [
              {
                steps: [
                  {
                    distance: 140,
                    duration: 28,
                    name: "Alt Way",
                    maneuver: {
                      type: "turn",
                      modifier: "right",
                      location: [10.1, 59.1],
                    },
                  },
                ],
              },
            ],
          },
        ],
      }),
    } as Response);

    const provider = new OSRMRoutingProvider("https://router.example.test/route/v1");
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
    expect(url).toContain("steps=true");

    expect(result.summary).toEqual({
      distanceMeters: 900,
      durationSeconds: 210,
    });
    expect(result.steps?.[0]).toMatchObject({
      instruction: "Depart onto Main St",
      maneuverType: "depart",
      location: [10.0, 59.0],
    });

    expect(result.alternatives).toHaveLength(1);
    expect(result.alternatives?.[0]).toMatchObject({
      id: "alt-1",
      summary: {
        distanceMeters: 1100,
        durationSeconds: 260,
      },
    });
  });

  it("throws ProviderRequestError when OSRM returns non-Ok code", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        code: "NoRoute",
        message: "No route found",
      }),
    } as Response);

    const provider = new OSRMRoutingProvider("https://router.example.test/route/v1");

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
