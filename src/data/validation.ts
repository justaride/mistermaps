import type { CatalogEntry, PatternCategory } from "../types";
import type { RoadmapArtifact, RoadmapItem, RoadmapStatus } from "../types/roadmap";

const VALID_PATTERN_CATEGORIES = new Set<PatternCategory>([
  "layers",
  "data-viz",
  "markers",
  "navigation",
]);

const VALID_PROVIDERS = new Set<CatalogEntry["provider"]>([
  "mapbox",
  "maplibre",
]);

const VALID_ROADMAP_STATUS = new Set<RoadmapStatus>([
  "implemented",
  "planned",
]);

const VALID_ROADMAP_ARTIFACTS = new Set<RoadmapArtifact>([
  "pattern",
  "provider",
  "project",
]);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[data validation] ${message}`);
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateCatalogEntry(
  entry: CatalogEntry,
  indexLabel: number | string,
): CatalogEntry {
  const label = `catalog entry ${indexLabel}`;

  assert(isNonEmptyString(entry.patternId), `${label}: patternId is required`);
  assert(isNonEmptyString(entry.name), `${label}: name is required`);
  assert(isNonEmptyString(entry.description), `${label}: description is required`);

  assert(
    VALID_PATTERN_CATEGORIES.has(entry.category),
    `${label}: invalid category "${entry.category}"`,
  );
  assert(
    VALID_PROVIDERS.has(entry.provider),
    `${label}: invalid provider "${entry.provider}"`,
  );

  assert(Array.isArray(entry.capabilities), `${label}: capabilities must be an array`);
  assert(entry.capabilities.length > 0, `${label}: capabilities must not be empty`);
  for (const capability of entry.capabilities) {
    assert(
      isNonEmptyString(capability),
      `${label}: capability values must be non-empty strings`,
    );
  }

  assert(Array.isArray(entry.tags), `${label}: tags must be an array`);
  for (const tag of entry.tags) {
    assert(isNonEmptyString(tag), `${label}: tag values must be non-empty strings`);
  }

  return entry;
}

export function validateCatalogEntries(entries: readonly CatalogEntry[]): CatalogEntry[] {
  const ids = new Set<string>();
  const validated: CatalogEntry[] = [];

  for (const [index, entry] of entries.entries()) {
    const next = validateCatalogEntry(entry, index);
    assert(!ids.has(next.patternId), `duplicate catalog patternId "${next.patternId}"`);
    ids.add(next.patternId);
    validated.push(next);
  }

  return validated;
}

function validateRoadmapItem(item: RoadmapItem, index: number, label: string): RoadmapItem {
  const itemLabel = `${label} item ${index}`;

  assert(isNonEmptyString(item.id), `${itemLabel}: id is required`);
  assert(isNonEmptyString(item.name), `${itemLabel}: name is required`);
  assert(isNonEmptyString(item.category), `${itemLabel}: category is required`);
  assert(isNonEmptyString(item.description), `${itemLabel}: description is required`);

  assert(
    VALID_ROADMAP_STATUS.has(item.status),
    `${itemLabel}: invalid status "${item.status}"`,
  );
  assert(
    VALID_ROADMAP_ARTIFACTS.has(item.artifact),
    `${itemLabel}: invalid artifact "${item.artifact}"`,
  );

  assert(Array.isArray(item.tags), `${itemLabel}: tags must be an array`);
  for (const tag of item.tags) {
    assert(isNonEmptyString(tag), `${itemLabel}: tag values must be non-empty strings`);
  }

  assert(
    typeof item.engineSupport?.mapbox === "boolean",
    `${itemLabel}: engineSupport.mapbox must be boolean`,
  );
  assert(
    typeof item.engineSupport?.maplibre === "boolean",
    `${itemLabel}: engineSupport.maplibre must be boolean`,
  );
  assert(
    item.engineSupport.mapbox || item.engineSupport.maplibre,
    `${itemLabel}: at least one engine must be supported`,
  );

  assert(
    Array.isArray(item.acceptanceCriteria),
    `${itemLabel}: acceptanceCriteria must be an array`,
  );

  if (item.status === "planned") {
    assert(
      item.acceptanceCriteria.length > 0,
      `${itemLabel}: planned items must include acceptance criteria`,
    );
  }

  if (item.status === "implemented") {
    const path = item.links?.demoPath;
    assert(
      isNonEmptyString(path),
      `${itemLabel}: implemented items must include links.demoPath`,
    );

    if (item.artifact === "project") {
      assert(
        path.startsWith("/projects/"),
        `${itemLabel}: project demoPath must start with /projects/`,
      );
    } else {
      assert(
        path.startsWith("/maps/"),
        `${itemLabel}: non-project demoPath must start with /maps/`,
      );
    }
  }

  return item;
}

export function validateRoadmapItems(
  items: readonly RoadmapItem[],
  label = "ROADMAP_ITEMS",
): RoadmapItem[] {
  const ids = new Set<string>();
  const validated: RoadmapItem[] = [];

  for (const [index, item] of items.entries()) {
    const next = validateRoadmapItem(item, index, label);
    assert(!ids.has(next.id), `${label}: duplicate id "${next.id}"`);
    ids.add(next.id);
    validated.push(next);
  }

  return validated;
}
