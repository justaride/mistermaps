import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Map,
  Layers,
  Code,
  Globe,
  Compass,
  Droplets,
  Trees,
  Mountain,
  ArrowRight,
  Github,
} from "lucide-react";
import { MrMaps } from "../components/mascot";
import { LandingMascot } from "../components/landing/LandingMascot";
import { patterns } from "../patterns";

const PATTERN_ICONS: Record<string, React.ReactNode> = {
  "rendalen-data": <Mountain className="h-6 w-6" />,
  "layer-inspector": <Layers className="h-6 w-6" />,
};

const FEATURES = [
  {
    icon: <Globe className="h-6 w-6 text-white" />,
    color: "bg-accent",
    title: "Norwegian APIs",
    description: "Live data from Kartverket, Naturbase, NVE and more.",
  },
  {
    icon: <Layers className="h-6 w-6 text-white" />,
    color: "bg-[#3b82f6]",
    title: "Interactive Layers",
    description: "Toggle, inspect, and style map layers in real time.",
  },
  {
    icon: <Code className="h-6 w-6 text-white" />,
    color: "bg-[#8b5cf6]",
    title: "Code Snippets",
    description: "Copy-paste Mapbox GL JS patterns for your own projects.",
  },
];

const LAYER_CARDS = [
  {
    icon: <Mountain className="h-4 w-4" />,
    label: "Kommune",
    color: "#ff5722",
  },
  { icon: <Trees className="h-4 w-4" />, label: "Nature", color: "#4caf50" },
  { icon: <Droplets className="h-4 w-4" />, label: "Water", color: "#2196f3" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <div className="noise-overlay" />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b-2 border-border bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <MrMaps size={48} expression="happy" state="online" />
            <span className="font-display text-2xl tracking-wide">
              MISTER MAPS
            </span>
          </div>
          <Link
            to="/map"
            className="inline-flex items-center gap-2 border-2 border-border bg-accent px-4 py-2 font-mono text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
            style={{ boxShadow: "3px 3px 0 var(--color-border)" }}
          >
            Enter Map <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-6xl px-4 py-16 md:py-24"
      >
        <div className="grid items-center gap-12 md:grid-cols-2">
          {/* Left */}
          <div className="flex flex-col gap-6">
            <span
              className="inline-block w-fit border-2 border-border bg-warn px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider"
              style={{ boxShadow: "2px 2px 0 var(--color-border)" }}
            >
              Live Norwegian Data
            </span>
            <h1 className="font-display text-5xl leading-tight tracking-wide md:text-6xl lg:text-7xl">
              Explore
              <br />
              <span className="text-accent">Rendalen</span>
            </h1>
            <p className="max-w-md font-mono text-sm text-muted">
              Interactive map patterns powered by Norwegian public APIs.
              Kartverket, Naturbase, NVE — all in one place.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/map"
                className="inline-flex items-center gap-2 border-2 border-border bg-accent px-5 py-2.5 font-mono text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
                style={{ boxShadow: "4px 4px 0 var(--color-border)" }}
              >
                <Map className="h-4 w-4" /> View Map
              </Link>
              <a
                href="#patterns"
                className="inline-flex items-center gap-2 border-2 border-border bg-card px-5 py-2.5 font-mono text-sm font-bold text-fg transition-transform hover:-translate-y-0.5"
                style={{ boxShadow: "4px 4px 0 var(--color-border)" }}
              >
                Browse Patterns
              </a>
            </div>
          </div>

          {/* Right - Mascot + Console */}
          <div className="flex flex-col items-center gap-6">
            <LandingMascot />

            {/* Console Mockup */}
            <div
              className="relative w-full max-w-sm overflow-hidden border-2 border-border bg-card"
              style={{ boxShadow: "4px 4px 0 var(--color-border)" }}
            >
              <div className="scanlines" />
              {/* Chrome bar */}
              <div className="flex items-center gap-2 border-b-2 border-border bg-fg/5 px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-danger" />
                <span className="h-2.5 w-2.5 rounded-full bg-warn" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#4caf50]" />
                <span className="ml-2 font-mono text-[10px] text-muted">
                  mister-maps://rendalen
                </span>
              </div>
              {/* Content */}
              <div className="p-4">
                {/* Mini compass */}
                <div className="mb-3 flex items-center gap-2">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 6,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  >
                    <Compass className="h-5 w-5 text-accent" />
                  </motion.div>
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted">
                    Rendalen, Innlandet
                  </span>
                </div>
                {/* Layer cards */}
                <div className="flex flex-col gap-2">
                  {LAYER_CARDS.map((card) => (
                    <div
                      key={card.label}
                      className="flex items-center gap-2 border border-border/50 bg-bg/50 px-3 py-1.5 font-mono text-xs"
                    >
                      <span style={{ color: card.color }}>{card.icon}</span>
                      <span className="font-bold">{card.label}</span>
                      <span className="ml-auto text-[10px] text-muted">
                        LIVE
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Ticker */}
              <div className="overflow-hidden border-t-2 border-border bg-fg/5 py-1.5">
                <motion.div
                  className="flex whitespace-nowrap font-mono text-[10px] font-bold uppercase tracking-widest text-muted"
                  animate={{ x: [0, -300] }}
                  transition={{
                    duration: 12,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                >
                  <span className="px-4">
                    LIVE &middot; KARTVERKET &middot; NATURBASE &middot; NVE
                    &middot; RENDALEN KOMMUNE &middot; LIVE &middot; KARTVERKET
                    &middot; NATURBASE &middot; NVE &middot; RENDALEN KOMMUNE
                  </span>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Map Types / Patterns */}
      <section id="patterns" className="mx-auto max-w-6xl px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="mb-2 font-display text-3xl tracking-wide md:text-4xl">
            Available Patterns
          </h2>
          <p className="mb-8 font-mono text-sm text-muted">
            Interactive map visualizations you can explore and learn from.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            {patterns.map((pattern) => (
              <Link
                key={pattern.id}
                to={`/map?pattern=${pattern.id}`}
                className="group flex flex-col gap-3 border-2 border-border bg-card p-5 transition-transform hover:-translate-y-1"
                style={{ boxShadow: "4px 4px 0 var(--color-border)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center border-2 border-border bg-bg">
                    {PATTERN_ICONS[pattern.id] || <Map className="h-5 w-5" />}
                  </div>
                  <div>
                    <h3 className="font-display text-lg tracking-wide">
                      {pattern.name}
                    </h3>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                      {pattern.category}
                    </span>
                  </div>
                </div>
                <p className="font-mono text-xs text-muted">
                  {pattern.description}
                </p>
                <span className="mt-auto inline-flex items-center gap-1 font-mono text-xs font-bold text-accent group-hover:underline">
                  Explore <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Features Strip */}
      <section className="border-y-2 border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="flex gap-4"
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center border-2 border-border ${feature.color}`}
                style={{ boxShadow: "3px 3px 0 var(--color-border)" }}
              >
                {feature.icon}
              </div>
              <div>
                <h3 className="font-display text-lg tracking-wide">
                  {feature.title}
                </h3>
                <p className="mt-1 font-mono text-xs text-muted">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-border bg-fg text-bg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center border-2 border-bg/20 font-display text-xl">
              M
            </span>
            <span className="font-mono text-xs text-bg/60">
              &copy; {new Date().getFullYear()} Mister Maps
            </span>
          </div>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-bg/60 transition-colors hover:text-bg"
            aria-label="GitHub"
          >
            <Github className="h-5 w-5" />
          </a>
        </div>
      </footer>
    </div>
  );
}
