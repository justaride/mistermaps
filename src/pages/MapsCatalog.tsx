import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Map } from "lucide-react";
import { SiteHeader } from "../components";
import { CATALOG } from "../data/catalog";
import type { PatternCategory } from "../types";

type FilterTab = "all" | PatternCategory | "providers";

const TABS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "layers", label: "Layers" },
  { value: "data-viz", label: "Data Viz" },
  { value: "markers", label: "Markers" },
  { value: "navigation", label: "Navigation" },
  { value: "providers", label: "Providers" },
];

const CATEGORY_COLORS: Record<string, string> = {
  layers: "bg-topo text-topo",
  "data-viz": "bg-accent/10 text-accent",
  markers: "bg-warn/10 text-warn",
  navigation: "bg-water/10 text-water",
  providers: "bg-topo/10 text-topo",
};

export default function MapsCatalog() {
  const [filter, setFilter] = useState<FilterTab>("all");

  const filtered =
    filter === "all" ? CATALOG : CATALOG.filter((e) => e.category === filter);

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
            className="mb-8 flex flex-col gap-3 border-2 border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between"
            style={{ boxShadow: "3px 3px 0 var(--color-border)" }}
          >
            <div>
              <div className="font-display text-xl tracking-wide">Workbench</div>
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

          <div className="mb-8 flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className={`border-2 border-border px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition-transform hover:-translate-y-0.5 ${
                  filter === tab.value
                    ? "bg-accent text-white"
                    : "bg-card text-fg"
                }`}
                style={{ boxShadow: "2px 2px 0 var(--color-border)" }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((entry) => (
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
                <span className="mt-auto inline-flex items-center gap-1 font-mono text-xs font-bold text-accent group-hover:underline">
                  Explore <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
