import { describe, expect, it, vi } from "vitest";

import { getUsableMapboxToken } from "../mapbox-token";

describe("getUsableMapboxToken", () => {
  it("returns a valid public token unchanged", () => {
    expect(getUsableMapboxToken("pk.abc123")).toBe("pk.abc123");
  });

  it("trims whitespace around a valid token", () => {
    expect(getUsableMapboxToken("  pk.abc123  ")).toBe("pk.abc123");
  });

  it("rejects null, undefined, and empty values", () => {
    expect(getUsableMapboxToken(null)).toBeNull();
    expect(getUsableMapboxToken(undefined)).toBeNull();
    expect(getUsableMapboxToken("")).toBeNull();
    expect(getUsableMapboxToken("   ")).toBeNull();
  });

  it("rejects placeholder tokens", () => {
    expect(getUsableMapboxToken("your_mapbox_token_here")).toBeNull();
    expect(getUsableMapboxToken("YOUR_MAPBOX_TOKEN_HERE")).toBeNull();
    expect(getUsableMapboxToken("<your_mapbox_token_here>")).toBeNull();
  });

  it("rejects secret (sk.) tokens and logs an error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(getUsableMapboxToken("sk.secret123")).toBeNull();
      expect(spy).toHaveBeenCalledOnce();
      expect(String(spy.mock.calls[0][0])).toContain("secret");
    } finally {
      spy.mockRestore();
    }
  });

  it("rejects tokens without a known prefix", () => {
    expect(getUsableMapboxToken("abc123")).toBeNull();
    expect(getUsableMapboxToken("tk.something")).toBeNull();
  });
});
