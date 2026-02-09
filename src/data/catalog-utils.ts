import type {
  CatalogEntry,
  CatalogTag,
  PatternCategory,
  Subcategory,
} from "../types";

export type CatalogGroup = {
  category: PatternCategory;
  subcategory: Subcategory | null;
  label: string;
  entries: CatalogEntry[];
};

export function groupCatalog(
  entries: CatalogEntry[],
  category?: PatternCategory,
  tag?: CatalogTag,
): CatalogGroup[] {
  let filtered = entries;

  if (category) {
    filtered = filtered.filter((e) => e.category === category);
  }

  if (tag) {
    filtered = filtered.filter((e) => e.tags.includes(tag));
  }

  const groupMap = new Map<string, CatalogGroup>();

  for (const entry of filtered) {
    const key = `${entry.category}::${entry.subcategory ?? "__none__"}`;
    let group = groupMap.get(key);
    if (!group) {
      group = {
        category: entry.category,
        subcategory: entry.subcategory ?? null,
        label: entry.subcategory ?? entry.category,
        entries: [],
      };
      groupMap.set(key, group);
    }
    group.entries.push(entry);
  }

  return Array.from(groupMap.values());
}

export function getTagsForCategory(
  entries: CatalogEntry[],
  category?: PatternCategory,
): CatalogTag[] {
  const relevant = category
    ? entries.filter((e) => e.category === category)
    : entries;

  const tagSet = new Set<CatalogTag>();
  for (const entry of relevant) {
    for (const tag of entry.tags) {
      tagSet.add(tag);
    }
  }

  return Array.from(tagSet).sort();
}
