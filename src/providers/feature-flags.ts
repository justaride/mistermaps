const DEFAULT_GEOCODING_PRIMARY_PROVIDER = "mapbox";
const DEFAULT_GEOCODING_FALLBACK_ORDER = ["nominatim", "photon"];

function parseBooleanFlag(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

function parseCsvFlag(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;
  const parsed = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : fallback;
}

export const providerFeatureFlags = {
  geocodingPrimaryProvider:
    import.meta.env.VITE_GEOCODING_PRIMARY_PROVIDER ||
    DEFAULT_GEOCODING_PRIMARY_PROVIDER,
  geocodingFallbackEnabled: parseBooleanFlag(
    import.meta.env.VITE_ENABLE_GEOCODING_FALLBACK,
    false,
  ),
  geocodingFallbackOrder: parseCsvFlag(
    import.meta.env.VITE_GEOCODING_FALLBACK_ORDER,
    DEFAULT_GEOCODING_FALLBACK_ORDER,
  ),
} as const;
