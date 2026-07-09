const PLACEHOLDER_TOKENS = new Set([
  "your_mapbox_token_here",
  "YOUR_MAPBOX_TOKEN_HERE",
  "<your_mapbox_token_here>",
]);

export function getUsableMapboxToken(
  rawToken: string | null | undefined,
): string | null {
  if (typeof rawToken !== "string") return null;

  const token = rawToken.trim();
  if (!token) return null;
  if (PLACEHOLDER_TOKENS.has(token)) return null;

  // Secret tokens (sk.) grant account-management scopes and must never be
  // shipped to the browser. Reject them loudly instead of using them.
  if (token.startsWith("sk.")) {
    console.error(
      "VITE_MAPBOX_TOKEN is a secret (sk.) token. Secret tokens must never be " +
        "used client-side — create a public (pk.) token at " +
        "https://account.mapbox.com/access-tokens/ and rotate the leaked secret.",
    );
    return null;
  }

  // Only public tokens are usable in the browser.
  if (!token.startsWith("pk.")) return null;

  return token;
}
