import { describe, it, expect } from "vitest";
import { parseBooleanFlag, parseCsvFlag } from "../feature-flags";

describe("parseBooleanFlag", () => {
  it("returns default when undefined", () => {
    expect(parseBooleanFlag(undefined, true)).toBe(true);
    expect(parseBooleanFlag(undefined, false)).toBe(false);
  });

  it("parses truthy values", () => {
    for (const v of ["1", "true", "yes", "on", "TRUE", " Yes ", " ON "]) {
      expect(parseBooleanFlag(v, false)).toBe(true);
    }
  });

  it("parses falsy values", () => {
    for (const v of ["0", "false", "no", "off", "FALSE", " No ", " OFF "]) {
      expect(parseBooleanFlag(v, true)).toBe(false);
    }
  });

  it("returns default for unrecognized values", () => {
    expect(parseBooleanFlag("maybe", true)).toBe(true);
    expect(parseBooleanFlag("maybe", false)).toBe(false);
    expect(parseBooleanFlag("", true)).toBe(true);
  });
});

describe("parseCsvFlag", () => {
  it("returns fallback when undefined", () => {
    expect(parseCsvFlag(undefined, ["a", "b"])).toEqual(["a", "b"]);
  });

  it("returns fallback for empty string", () => {
    expect(parseCsvFlag("", ["a"])).toEqual(["a"]);
  });

  it("splits comma-separated values", () => {
    expect(parseCsvFlag("x,y,z", [])).toEqual(["x", "y", "z"]);
  });

  it("trims whitespace", () => {
    expect(parseCsvFlag(" a , b , c ", [])).toEqual(["a", "b", "c"]);
  });

  it("filters empty entries", () => {
    expect(parseCsvFlag("a,,b,,,c", [])).toEqual(["a", "b", "c"]);
  });

  it("returns fallback if all entries are empty after filter", () => {
    expect(parseCsvFlag(",,,", ["default"])).toEqual(["default"]);
  });
});
