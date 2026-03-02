import { describe, expect, it } from "vitest";
import { routesToFeatureCollection, type RouteOption } from "../route-alternatives";

describe("route-alternatives helpers", () => {
  it("marks only selected route as active", () => {
    const routes: RouteOption[] = [
      {
        id: "primary",
        geometry: {
          type: "LineString",
          coordinates: [
            [10, 59],
            [10.1, 59.1],
          ],
        },
        summary: { distanceMeters: 1000, durationSeconds: 600 },
      },
      {
        id: "alt-1",
        geometry: {
          type: "LineString",
          coordinates: [
            [10, 59],
            [10.2, 59.2],
          ],
        },
        summary: { distanceMeters: 1200, durationSeconds: 660 },
      },
    ];

    const fc = routesToFeatureCollection(routes, "alt-1");
    expect(fc.features).toHaveLength(2);

    const activeFlags = fc.features.map((feature) => feature.properties?.isActive);
    expect(activeFlags).toEqual([false, true]);

    const activeRouteId = fc.features.find((feature) => feature.properties?.isActive)
      ?.properties?.routeId;
    expect(activeRouteId).toBe("alt-1");
  });
});
