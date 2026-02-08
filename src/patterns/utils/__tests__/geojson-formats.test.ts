import { describe, it, expect } from "vitest";
import { geojsonToKml, geojsonToGpx } from "../geojson-formats";

const point = (lng: number, lat: number): GeoJSON.Feature => ({
  type: "Feature",
  properties: { name: "Test Point" },
  geometry: { type: "Point", coordinates: [lng, lat] },
});

const line = (coords: [number, number][]): GeoJSON.Feature => ({
  type: "Feature",
  properties: { name: "Test Line" },
  geometry: { type: "LineString", coordinates: coords },
});

const polygon = (ring: [number, number][]): GeoJSON.Feature => ({
  type: "Feature",
  properties: { name: "Test Polygon" },
  geometry: { type: "Polygon", coordinates: [ring] },
});

const fc = (...features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features,
});

describe("geojsonToKml", () => {
  it("produces valid KML structure", () => {
    const kml = geojsonToKml(fc(point(10, 60)));
    expect(kml).toContain('<?xml version="1.0"');
    expect(kml).toContain("<kml");
    expect(kml).toContain("<Document>");
    expect(kml).toContain("</Document>");
    expect(kml).toContain("</kml>");
  });

  it("uses custom document name", () => {
    const kml = geojsonToKml(fc(point(10, 60)), { name: "My Export" });
    expect(kml).toContain("<name>My Export</name>");
  });

  it("defaults document name to Mister Maps Export", () => {
    const kml = geojsonToKml(fc(point(10, 60)));
    expect(kml).toContain("<name>Mister Maps Export</name>");
  });

  it("renders a Point placemark", () => {
    const kml = geojsonToKml(fc(point(10.1234567, 59.9876543)));
    expect(kml).toContain("<Point>");
    expect(kml).toContain("<coordinates>10.1234567,59.9876543</coordinates>");
    expect(kml).toContain("<name>Test Point</name>");
  });

  it("renders a LineString placemark", () => {
    const kml = geojsonToKml(
      fc(
        line([
          [10, 60],
          [11, 61],
        ]),
      ),
    );
    expect(kml).toContain("<LineString>");
    expect(kml).toContain("10,60");
    expect(kml).toContain("11,61");
  });

  it("renders a Polygon placemark", () => {
    const kml = geojsonToKml(
      fc(
        polygon([
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ]),
      ),
    );
    expect(kml).toContain("<Polygon>");
    expect(kml).toContain("<outerBoundaryIs>");
  });

  it("escapes XML special characters in names", () => {
    const feat: GeoJSON.Feature = {
      type: "Feature",
      properties: { name: '<script>"alert"</script>' },
      geometry: { type: "Point", coordinates: [0, 0] },
    };
    const kml = geojsonToKml(fc(feat));
    expect(kml).not.toContain("<script>");
    expect(kml).toContain("&lt;script&gt;");
  });

  it("handles empty feature collection", () => {
    const kml = geojsonToKml(fc());
    expect(kml).toContain("<Document>");
    expect(kml).not.toContain("<Placemark>");
  });

  it("flattens MultiPoint into individual placemarks", () => {
    const multi: GeoJSON.Feature = {
      type: "Feature",
      properties: { name: "Multi" },
      geometry: {
        type: "MultiPoint",
        coordinates: [
          [10, 60],
          [11, 61],
        ],
      },
    };
    const kml = geojsonToKml(fc(multi));
    const matches = kml.match(/<Point>/g);
    expect(matches).toHaveLength(2);
  });
});

describe("geojsonToGpx", () => {
  it("produces valid GPX structure", () => {
    const gpx = geojsonToGpx(fc(point(10, 60)));
    expect(gpx).toContain('<?xml version="1.0"');
    expect(gpx).toContain("<gpx");
    expect(gpx).toContain("</gpx>");
    expect(gpx).toContain("<metadata>");
  });

  it("uses custom name and creator", () => {
    const gpx = geojsonToGpx(fc(point(10, 60)), {
      name: "My Track",
      creator: "Test App",
    });
    expect(gpx).toContain("<name>My Track</name>");
    expect(gpx).toContain('creator="Test App"');
  });

  it("renders Point as waypoint", () => {
    const gpx = geojsonToGpx(fc(point(10.5, 60.5)));
    expect(gpx).toContain("<wpt");
    expect(gpx).toContain('lat="60.5"');
    expect(gpx).toContain('lon="10.5"');
    expect(gpx).toContain("<name>Test Point</name>");
  });

  it("renders LineString as track", () => {
    const gpx = geojsonToGpx(
      fc(
        line([
          [10, 60],
          [11, 61],
        ]),
      ),
    );
    expect(gpx).toContain("<trk>");
    expect(gpx).toContain("<trkseg>");
    expect(gpx).toContain("<trkpt");
  });

  it("renders Polygon as track with closed ring", () => {
    const gpx = geojsonToGpx(
      fc(
        polygon([
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ]),
      ),
    );
    expect(gpx).toContain("<trk>");
    expect(gpx).toContain("<trkseg>");
  });

  it("handles empty feature collection", () => {
    const gpx = geojsonToGpx(fc());
    expect(gpx).toContain("<gpx");
    expect(gpx).not.toContain("<wpt");
    expect(gpx).not.toContain("<trk>");
  });

  it("falls back to Feature N naming when no name property", () => {
    const feat: GeoJSON.Feature = {
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [10, 60] },
    };
    const gpx = geojsonToGpx(fc(feat));
    expect(gpx).toContain("<name>Feature 1</name>");
  });
});
