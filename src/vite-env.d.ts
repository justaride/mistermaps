/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPBOX_TOKEN: string;
  readonly VITE_GEOCODING_PRIMARY_PROVIDER?: string;
  readonly VITE_ENABLE_GEOCODING_FALLBACK?: string;
  readonly VITE_GEOCODING_FALLBACK_ORDER?: string;
  readonly VITE_NOMINATIM_ENDPOINT?: string;
  readonly VITE_PHOTON_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
