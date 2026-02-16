import type { CatalogEntry } from "../types";
import { CATALOG_DATA, MAPLIBRE_ENTRY_DATA } from "./catalog.data";
import { validateCatalogEntries, validateCatalogEntry } from "./validation";

export const CATALOG: CatalogEntry[] = validateCatalogEntries(CATALOG_DATA);

export const MAPLIBRE_ENTRY: CatalogEntry = validateCatalogEntry(
  MAPLIBRE_ENTRY_DATA,
  "maplibre provider",
);
