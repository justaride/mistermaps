import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Globe, ListTree, Map } from "lucide-react";
import { SiteHeader } from "../components";
import { CATALOG, MAPLIBRE_ENTRY } from "../data/catalog";
import {
  CATEGORY_META,
  SUBCATEGORY_LABELS,
  TAG_LABELS,
} from "../data/catalog-meta";
import { groupCatalog, getTagsForCategory } from "../data/catalog-utils";
import type { CatalogTag, PatternCategory } from "../types";

const CATEGORIES: PatternCategory[] = [
  "layers",
  "data-viz",
  "markers",
  "navigation",
];

const CATEGORY_COLORS: Record<string, string> = {
  layers: "bg-topo text-topo",
  "data-viz": "bg-accent/10 text-accent",
  markers: "bg-warn/10 text-warn",
  navigation: "bg-water/10 text-water",
};

export default function MapsCatalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const catParam = searchParams.get("cat") ?? "all";
  const tagParam = searchParams.get("tag") as CatalogTag | null;

  const activeCategory =
    catParam !== "all" && CATEGORIES.includes(catParam as PatternCategory)
      ? (catParam as PatternCategory)
      : undefined;

  const availableTags = useMemo(
    () => getTagsForCategory(CATALOG, activeCategory),
    [activeCategory],
  );

  const activeTag =
    tagParam && availableTags.includes(tagParam) ? tagParam : undefined;

  const groups = useMemo(
    () => groupCatalog(CATALOG, activeCategory, activeTag),
    [activeCategory, activeTag],
  );

  const totalFiltered = useMemo(
    () => groups.reduce((sum, g) => sum + g.entries.length, 0),
    [groups],
  );

  const countByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of CATEGORIES) {
      counts[cat] = CATALOG.filter((e) => e.category === cat).length;
    }
    return counts;
  }, []);

  const setCategory = (cat: string) => {
    const next = new URLSearchParams();
    if (cat !== "all") next.set("cat", cat);
    setSearchParams(next);
  };

  const toggleTag = (tag: CatalogTag) => {
    const next = new URLSearchParams(searchParams);
    if (activeTag === tag) {
      next.delete("tag");
    } else {
      next.set("tag", tag);
    }
    setSearchParams(next);
  };

  return (
    <div className="min-h-screen bg-bg text-fg">
      <div className="noise-overlay" />
      <SiteHeader />

      <div className="mx-auto max-w-6xl px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="mb-2 font-display text-4xl tracking-wide md:text-5xl">
            Maps Catalog
          </h1>
          <p className="mb-8 font-mono text-sm text-muted">
            Interactive map patterns and providers to explore.
          </p>

          <div
            className="mb-4 flex flex-col gap-3 border-2 border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between"
            style={{ boxShadow: "3px 3px 0 var(--color-border)" }}
          >
            <div>
              <div className="font-display text-xl tracking-wide">
                Workbench
              </div>
              <div className="mt-1 font-mono text-xs text-muted">
                One map, many features. Toggle multiple patterns and copy an
                assistant prompt for your exact configuration.
              </div>
            </div>
            <Link
              to="/workbench"
              className="inline-flex items-center justify-center gap-2 border-2 border-border bg-topo px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white transition-transform hover:-translate-y-0.5"
              style={{ boxShadow: "2px 2px 0 var(--color-border)" }}
            >
              Open Workbench <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <Link
            to="/maps/roadmap"
            className="mb-4 flex items-center gap-4 border-2 border-border bg-card p-5 transition-transform hover:-translate-y-0.5"
            style={{ boxShadow: "3px 3px 0 var(--color-border)" }}
          >
            <div className="flex h-10 w-10 items-center justify-center border-2 border-border bg-warn/10 text-warn">
              <ListTree className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="font-display text-lg tracking-wide">
                Maps Roadmap
              </div>
              <div className="font-mono text-xs text-muted">
                The map of maps: inventory, coverage, and what to build next.
              </div>
            </div>
            <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-accent">
              Explore <ArrowRight className="h-3 w-3" />
            </span>
          </Link>

          <Link
            to="/maps/maplibre"
            className="mb-8 flex items-center gap-4 border-2 border-border bg-card p-5 transition-transform hover:-translate-y-0.5"
            style={{ boxShadow: "3px 3px 0 var(--color-border)" }}
          >
            <div className="flex h-10 w-10 items-center justify-center border-2 border-border bg-topo/10 text-topo">
              <Globe className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="font-display text-lg tracking-wide">
                {MAPLIBRE_ENTRY.name}
              </div>
              <div className="font-mono text-xs text-muted">
                {MAPLIBRE_ENTRY.description}
              </div>
            </div>
            <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-accent">
              Explore <ArrowRight className="h-3 w-3" />
            </span>
          </Link>

          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={() => setCategory("all")}
              className={`border-2 border-border px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition-transform hover:-translate-y-0.5 ${
                !activeCategory ? "bg-accent text-white" : "bg-card text-fg"
              }`}
              style={{ boxShadow: "2px 2px 0 var(--color-border)" }}
            >
              All ({CATALOG.length})
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`border-2 border-border px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition-transform hover:-translate-y-0.5 ${
                  activeCategory === cat
                    ? "bg-accent text-white"
                    : "bg-card text-fg"
                }`}
                style={{ boxShadow: "2px 2px 0 var(--color-border)" }}
              >
                {CATEGORY_META[cat].label} ({countByCategory[cat]})
              </button>
            ))}
          </div>

          {availableTags.length > 0 && (
            <div className="mb-8 flex flex-wrap gap-1.5">
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`border px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors ${
                    activeTag === tag
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border/40 bg-bg/50 text-muted hover:border-border hover:text-fg"
                  }`}
                >
                  {TAG_LABELS[tag]}
                </button>
              ))}
            </div>
          )}

          {activeTag && (
            <div className="mb-4 font-mono text-xs text-muted">
              {totalFiltered} result{totalFiltered !== 1 ? "s" : ""}
            </div>
          )}

          {groups.map((group) => (
            <div
              key={`${group.category}::${group.subcategory ?? "none"}`}
              className="mb-8"
            >
              {(groups.length > 1 || group.subcategory) && (
                <div className="mb-4 flex items-center gap-3">
                  {!activeCategory && (
                    <span
                      className={`inline-block rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest ${CATEGORY_COLORS[group.category] || ""}`}
                    >
                      {CATEGORY_META[group.category].label}
                    </span>
                  )}
                  {group.subcategory && (
                    <>
                      {!activeCategory && <span className="text-muted">/</span>}
                      <span className="font-display text-sm tracking-wide text-muted">
                        {SUBCATEGORY_LABELS[group.subcategory]}
                      </span>
                    </>
                  )}
                  <div className="flex-1 border-t border-border/30" />
                </div>
              )}

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {group.entries.map((entry) => (
                  <Link
                    key={entry.patternId}
                    to={`/maps/${entry.patternId}`}
                    className="group flex flex-col gap-3 border-2 border-border bg-card p-5 transition-transform hover:-translate-y-1"
                    style={{ boxShadow: "3px 3px 0 var(--color-border)" }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center border-2 border-border bg-topo/10 text-topo">
                        <Map className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-display text-lg tracking-wide">
                          {entry.name}
                        </h3>
                        <span
                          className={`inline-block rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest ${CATEGORY_COLORS[entry.category] || ""}`}
                        >
                          {entry.category}
                        </span>
                      </div>
                    </div>
                    <p className="font-mono text-xs text-muted">
                      {entry.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {entry.capabilities.map((cap) => (
                        <span
                          key={cap}
                          className="border border-border/40 bg-bg/50 px-1.5 py-0.5 font-mono text-[10px] text-muted"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                    <div className="mt-auto flex items-center gap-2">
                      <div className="flex flex-wrap gap-1">
                        {entry.tags.map((tag) => (
                          <span
                            key={tag}
                            className="border border-accent/20 bg-accent/5 px-1 py-0.5 font-mono text-[9px] uppercase tracking-widest text-accent/70"
                          >
                            {TAG_LABELS[tag]}
                          </span>
                        ))}
                      </div>
                      <span className="ml-auto inline-flex items-center gap-1 font-mono text-xs font-bold text-accent group-hover:underline">
                        Explore <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
