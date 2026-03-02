import { describe, expect, it } from "vitest";
import { lineDistance, parseTraceInput } from "../map-matching";

describe("map-matching helpers", () => {
  it("parses csv trace input", () => {
    const parsed = parseTraceInput("10.000000,59.000000\n10.100000,59.100000");
    expect(parsed.error).toBeNull();
    expect(parsed.coords).toEqual([
      [10, 59],
      [10.1, 59.1],
    ]);
  });

  it("parses JSON trace input", () => {
    const parsed = parseTraceInput("[[10,59],[10.2,59.2]]");
    expect(parsed.error).toBeNull();
    expect(parsed.coords).toEqual([
      [10, 59],
      [10.2, 59.2],
    ]);
  });

  it("returns helpful parse errors", () => {
    const parsed = parseTraceInput("10,59\ninvalid,line");
    expect(parsed.error).toContain("Invalid coordinate line");
  });

  it("computes line distance", () => {
    expect(lineDistance([[10, 59]])).toBe(0);
    expect(
      lineDistance([
        [10, 59],
        [10.1, 59.1],
      ]),
    ).toBeGreaterThan(0);
  });
});
