import { describe, it, expect } from "vitest";
import { ProviderRequestError, isRateLimitError } from "../errors";

describe("ProviderRequestError", () => {
  it("sets name, message, and providerId", () => {
    const err = new ProviderRequestError("boom", { providerId: "mapbox" });
    expect(err.name).toBe("ProviderRequestError");
    expect(err.message).toBe("boom");
    expect(err.providerId).toBe("mapbox");
    expect(err).toBeInstanceOf(Error);
  });

  it("sets optional status and code", () => {
    const err = new ProviderRequestError("fail", {
      providerId: "nominatim",
      status: 503,
      code: "SERVICE_UNAVAILABLE",
    });
    expect(err.status).toBe(503);
    expect(err.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("attaches cause when provided", () => {
    const cause = new Error("root");
    const err = new ProviderRequestError("wrapped", {
      providerId: "photon",
      cause,
    });
    expect((err as Error & { cause?: unknown }).cause).toBe(cause);
  });

  it("does not set cause when omitted", () => {
    const err = new ProviderRequestError("no cause", { providerId: "osrm" });
    expect((err as Error & { cause?: unknown }).cause).toBeUndefined();
  });
});

describe("isRateLimitError", () => {
  it("returns true for 429 ProviderRequestError", () => {
    const err = new ProviderRequestError("rate limited", {
      providerId: "mapbox",
      status: 429,
    });
    expect(isRateLimitError(err)).toBe(true);
  });

  it("returns false for non-429 ProviderRequestError", () => {
    const err = new ProviderRequestError("server error", {
      providerId: "mapbox",
      status: 500,
    });
    expect(isRateLimitError(err)).toBe(false);
  });

  it("returns false for plain Error", () => {
    expect(isRateLimitError(new Error("oops"))).toBe(false);
  });

  it("returns false for non-error values", () => {
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
    expect(isRateLimitError("string")).toBe(false);
  });
});
