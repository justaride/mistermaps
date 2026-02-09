import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Check, Clock, Filter, Map as MapIcon } from "lucide-react";
import { SiteHeader } from "../components";
import { ROADMAP_CATEGORY_ORDER, ROADMAP_ITEMS } from "../data/roadmap";
import type {
  RoadmapArtifact,
  RoadmapItem,
  RoadmapStatus,
} from "../types/roadmap";

type StatusFilter = RoadmapStatus | "all";
type ArtifactFilter = RoadmapArtifact | "all";
type EngineFilter = "any" | "mapbox" | "maplibre" | "both";

function engineMatches(item: RoadmapItem, filter: EngineFilter): boolean {
  switch (filter) {
    case "mapbox":
      return item.engineSupport.mapbox;
    case "maplibre":
      return item.engineSupport.maplibre;
    case "both":
      return item.engineSupport.mapbox && item.engineSupport.maplibre;
    case "any":
    default:
      return true;
  }
}

function artifactLabel(artifact: RoadmapArtifact): string {
  switch (artifact) {
    case "pattern":
      return "Pattern";
    case "provider":
      return "Provider";
    case "project":
      return "Project";
    default:
      return artifact;
  }
}

function statusLabel(status: RoadmapStatus): string {
  return status === "implemented" ? "Implemented" : "Planned";
}

function itemMatchesQuery(item: RoadmapItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    item.name,
    item.description,
    item.id,
    item.category,
    item.artifact,
    item.status,
    ...(item.tags ?? []),
    ...(item.dependencies.api ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function groupByCategory(items: RoadmapItem[]) {
  const groups = new Map<string, RoadmapItem[]>();
  for (const item of items) {
    const list = groups.get(item.category) ?? [];
    list.push(item);
    groups.set(item.category, list);
  }
  return groups;
}

export default function MapsRoadmap() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [artifact, setArtifact] = useState<ArtifactFilter>("all");
  const [engine, setEngine] = useState<EngineFilter>("any");
  const [tag, setTag] = useState<string>("all");
  const [query, setQuery] = useState("");

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    for (const item of ROADMAP_ITEMS) {
      for (const t of item.tags ?? []) tags.add(t);
    }
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, []);

  const filteredItems = useMemo(() => {
    return ROADMAP_ITEMS.filter((item) => {
      if (status !== "all" && item.status !== status) return false;
      if (artifact !== "all" && item.artifact !== artifact) return false;
      if (!engineMatches(item, engine)) return false;
      if (tag !== "all" && !(item.tags ?? []).includes(tag)) return false;
      if (!itemMatchesQuery(item, query)) return false;
      return true;
    });
  }, [artifact, engine, query, status, tag]);

  const counts = useMemo(() => {
    const implemented = ROADMAP_ITEMS.filter(
      (i) => i.status === "implemented",
    ).length;
    const planned = ROADMAP_ITEMS.filter((i) => i.status === "planned").length;
    const mapbox = ROADMAP_ITEMS.filter((i) => i.engineSupport.mapbox).length;
    const maplibre = ROADMAP_ITEMS.filter(
      (i) => i.engineSupport.maplibre,
    ).length;
    return { implemented, planned, mapbox, maplibre };
  }, []);

  const groups = useMemo(() => {
    const grouped = groupByCategory(filteredItems);
    const categories = new Set<string>([
      ...ROADMAP_CATEGORY_ORDER,
      ...Array.from(grouped.keys()),
    ]);

    const ordered = Array.from(categories).sort((a, b) => {
      const ia = ROADMAP_CATEGORY_ORDER.indexOf(a as never);
      const ib = ROADMAP_CATEGORY_ORDER.indexOf(b as never);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    return ordered
      .map((category) => {
        const entries = grouped.get(category) ?? [];
        entries.sort((a, b) => {
          if (a.status !== b.status) {
            return a.status === "implemented" ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
        return { category, entries };
      })
      .filter((g) => g.entries.length > 0);
  }, [filteredItems]);

  return (
    <div className="min-h-screen bg-bg text-fg">
      <div className="noise-overlay" />
      <SiteHeader />

      <div className="mx-auto max-w-6xl px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="mb-6">
            <h1 className="font-display text-4xl tracking-wide md:text-5xl">
              Maps Roadmap
            </h1>
            <p className="mt-2 max-w-2xl font-mono text-sm text-muted">
              A map of all maps: what exists today, what we want next, and how
              Mapbox and MapLibre parity should evolve.
            </p>
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div
              className="border-2 border-border bg-card p-4"
              style={{ boxShadow: "3px 3px 0 var(--color-border)" }}
            >
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
                Implemented
              </div>
              <div className="mt-1 font-display text-3xl tracking-wide">
                {counts.implemented}
              </div>
            </div>
            <div
              className="border-2 border-border bg-card p-4"
              style={{ boxShadow: "3px 3px 0 var(--color-border)" }}
            >
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
                Planned
              </div>
              <div className="mt-1 font-display text-3xl tracking-wide">
                {counts.planned}
              </div>
            </div>
            <div
              className="border-2 border-border bg-card p-4"
              style={{ boxShadow: "3px 3px 0 var(--color-border)" }}
            >
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
                Mapbox Support
              </div>
              <div className="mt-1 font-display text-3xl tracking-wide">
                {counts.mapbox}
              </div>
            </div>
            <div
              className="border-2 border-border bg-card p-4"
              style={{ boxShadow: "3px 3px 0 var(--color-border)" }}
            >
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
                MapLibre Support
              </div>
              <div className="mt-1 font-display text-3xl tracking-wide">
                {counts.maplibre}
              </div>
            </div>
          </div>

          <div
            className="mb-10 border-2 border-border bg-card p-5"
            style={{ boxShadow: "3px 3px 0 var(--color-border)" }}
          >
            <div className="mb-3 flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted" />
              <div className="font-display text-lg tracking-wide">Filters</div>
            </div>

            <div className="grid gap-3 md:grid-cols-5">
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                  Status
                </span>
                <select
                  className="border-2 border-border bg-bg px-3 py-2 font-mono text-xs"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as StatusFilter)}
                >
                  <option value="all">All</option>
                  <option value="implemented">Implemented</option>
                  <option value="planned">Planned</option>
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                  Type
                </span>
                <select
                  className="border-2 border-border bg-bg px-3 py-2 font-mono text-xs"
                  value={artifact}
                  onChange={(e) =>
                    setArtifact(e.target.value as ArtifactFilter)
                  }
                >
                  <option value="all">All</option>
                  <option value="pattern">Pattern</option>
                  <option value="provider">Provider</option>
                  <option value="project">Project</option>
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                  Engine
                </span>
                <select
                  className="border-2 border-border bg-bg px-3 py-2 font-mono text-xs"
                  value={engine}
                  onChange={(e) => setEngine(e.target.value as EngineFilter)}
                >
                  <option value="any">Any</option>
                  <option value="mapbox">Mapbox</option>
                  <option value="maplibre">MapLibre</option>
                  <option value="both">Both</option>
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                  Tag
                </span>
                <select
                  className="border-2 border-border bg-bg px-3 py-2 font-mono text-xs"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                >
                  <option value="all">All</option>
                  {availableTags.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 md:col-span-1">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                  Search
                </span>
                <input
                  className="border-2 border-border bg-bg px-3 py-2 font-mono text-xs"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. export, routing, terrain"
                />
              </label>
            </div>

            <div className="mt-3 font-mono text-xs text-muted">
              {filteredItems.length} result{filteredItems.length !== 1 ? "s" : ""}
            </div>
          </div>

          {groups.map((group) => (
            <div key={group.category} className="mb-10">
              <div className="mb-4 flex items-center gap-3">
                <span className="font-display text-xl tracking-wide">
                  {group.category}
                </span>
                <span className="rounded-sm border border-border/50 bg-bg/50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted">
                  {group.entries.length}
                </span>
                <div className="flex-1 border-t border-border/30" />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {group.entries.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 border-2 border-border bg-card p-5"
                    style={{ boxShadow: "3px 3px 0 var(--color-border)" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-display text-lg tracking-wide">
                          {item.name}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="rounded-sm border border-border/50 bg-bg/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted">
                            {artifactLabel(item.artifact)}
                          </span>

                          <span
                            className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${
                              item.status === "implemented"
                                ? "border-topo/40 bg-topo/10 text-topo"
                                : "border-warn/40 bg-warn/10 text-warn"
                            }`}
                          >
                            {item.status === "implemented" ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <Clock className="h-3 w-3" />
                            )}
                            {statusLabel(item.status)}
                          </span>

                          <span className="rounded-sm border border-border/50 bg-bg/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted">
                            {item.engineSupport.mapbox ? "Mapbox" : "No Mapbox"}
                            {" / "}
                            {item.engineSupport.maplibre
                              ? "MapLibre"
                              : "No MapLibre"}
                          </span>

                          {item.dependencies.tokenRequired && (
                            <span className="rounded-sm border border-accent/30 bg-accent/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-accent/80">
                              Token
                            </span>
                          )}
                        </div>
                      </div>

                      {item.links?.demoPath && (
                        <Link
                          to={item.links.demoPath}
                          className="inline-flex items-center justify-center gap-2 border-2 border-border bg-accent px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-white transition-transform hover:-translate-y-0.5"
                          style={{
                            boxShadow: "2px 2px 0 var(--color-border)",
                          }}
                        >
                          Open <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>

                    <p className="font-mono text-xs text-muted">
                      {item.description}
                    </p>

                    {(item.tags?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {item.tags.slice(0, 10).map((t) => (
                          <span
                            key={`${item.id}::tag::${t}`}
                            className="border border-border/40 bg-bg/50 px-1.5 py-0.5 font-mono text-[10px] text-muted"
                          >
                            {t}
                          </span>
                        ))}
                        {item.tags.length > 10 && (
                          <span className="border border-border/40 bg-bg/50 px-1.5 py-0.5 font-mono text-[10px] text-muted">
                            +{item.tags.length - 10}
                          </span>
                        )}
                      </div>
                    )}

                    {(item.dependencies.api?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {item.dependencies.api?.slice(0, 4).map((api) => (
                          <span
                            key={`${item.id}::api::${api}`}
                            className="border border-border/40 bg-bg/50 px-1.5 py-0.5 font-mono text-[10px] text-muted"
                          >
                            {api}
                          </span>
                        ))}
                        {(item.dependencies.api?.length ?? 0) > 4 && (
                          <span className="border border-border/40 bg-bg/50 px-1.5 py-0.5 font-mono text-[10px] text-muted">
                            +{(item.dependencies.api?.length ?? 0) - 4}
                          </span>
                        )}
                      </div>
                    )}

                    {item.dependencies.notes && (
                      <div className="rounded-sm border border-border/40 bg-bg/40 p-3 font-mono text-[11px] text-muted">
                        {item.dependencies.notes}
                      </div>
                    )}

                    {item.status === "planned" &&
                      (item.acceptanceCriteria?.length ?? 0) > 0 && (
                        <div className="mt-1">
                          <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted">
                            <MapIcon className="h-3 w-3" />
                            Acceptance Criteria
                          </div>
                          <ul className="list-disc pl-5 font-mono text-xs text-muted">
                            {item.acceptanceCriteria.map((ac) => (
                              <li key={`${item.id}::ac::${ac}`}>{ac}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {groups.length === 0 && (
            <div className="border-2 border-border bg-card p-10 text-center">
              <div className="font-display text-2xl tracking-wide">
                No matches
              </div>
              <div className="mt-2 font-mono text-sm text-muted">
                Try removing filters or searching for something broader.
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

