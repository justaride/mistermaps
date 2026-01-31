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
    color: "bg-water",
    title: "Interactive Layers",
    description: "Toggle, inspect, and style map layers in real time.",
  },
  {
    icon: <Code className="h-6 w-6 text-white" />,
    color: "bg-topo",
    title: "Code Snippets",
    description: "Copy-paste Mapbox GL JS patterns for your own projects.",
  },
];

const LAYER_CARDS = [
  {
    icon: <Mountain className="h-4 w-4" />,
    label: "Kommune",
    value: "2430",
    color: "#c85a2a",
  },
  {
    icon: <Trees className="h-4 w-4" />,
    label: "Nature",
    value: "14 areas",
    color: "#6b8f71",
  },
  {
    icon: <Droplets className="h-4 w-4" />,
    label: "Water",
    value: "3 rivers",
    color: "#5b8fa8",
  },
];

function TopoWaveBorder() {
  return (
    <svg
      className="absolute bottom-0 left-0 w-full"
      height="6"
      viewBox="0 0 1200 6"
      preserveAspectRatio="none"
    >
      <path
        d="M0,3 Q50,0 100,3 T200,3 T300,3 T400,3 T500,3 T600,3 T700,3 T800,3 T900,3 T1000,3 T1100,3 T1200,3"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="1.5"
        opacity="0.4"
      />
    </svg>
  );
}

function CompassRoseWatermark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" fill="none" opacity="0.04">
      <circle
        cx="100"
        cy="100"
        r="90"
        stroke="var(--color-border)"
        strokeWidth="1"
      />
      <circle
        cx="100"
        cy="100"
        r="70"
        stroke="var(--color-border)"
        strokeWidth="0.5"
      />
      <circle
        cx="100"
        cy="100"
        r="50"
        stroke="var(--color-border)"
        strokeWidth="0.5"
      />
      <polygon
        points="100,15 105,90 100,80 95,90"
        fill="var(--color-accent)"
        opacity="0.5"
      />
      <polygon
        points="100,185 105,110 100,120 95,110"
        fill="var(--color-muted)"
        opacity="0.3"
      />
      <polygon
        points="15,100 90,95 80,100 90,105"
        fill="var(--color-muted)"
        opacity="0.3"
      />
      <polygon
        points="185,100 110,95 120,100 110,105"
        fill="var(--color-muted)"
        opacity="0.3"
      />
      <text
        x="100"
        y="12"
        textAnchor="middle"
        fontSize="8"
        fill="var(--color-border)"
        fontFamily="var(--font-display)"
      >
        N
      </text>
      <text
        x="100"
        y="198"
        textAnchor="middle"
        fontSize="8"
        fill="var(--color-border)"
        fontFamily="var(--font-display)"
      >
        S
      </text>
      <text
        x="8"
        y="103"
        textAnchor="middle"
        fontSize="8"
        fill="var(--color-border)"
        fontFamily="var(--font-display)"
      >
        W
      </text>
      <text
        x="192"
        y="103"
        textAnchor="middle"
        fontSize="8"
        fill="var(--color-border)"
        fontFamily="var(--font-display)"
      >
        E
      </text>
    </svg>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <div className="noise-overlay" />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <MrMaps size={48} expression="happy" state="online" />
            <span className="font-display text-2xl tracking-wide">
              MISTER MAPS
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/maplibre"
              className="inline-flex items-center gap-2 border-2 border-border bg-card px-4 py-2 font-mono text-sm font-bold text-fg transition-transform hover:-translate-y-0.5"
              style={{ boxShadow: "3px 3px 0 var(--color-border)" }}
            >
              <Globe className="h-4 w-4" /> MapLibre Peek
            </Link>
            <Link
              to="/map"
              className="inline-flex items-center gap-2 border-2 border-border bg-accent px-4 py-2 font-mono text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
              style={{ boxShadow: "3px 3px 0 var(--color-border)" }}
            >
              <Compass className="h-4 w-4" /> Enter Map{" "}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <div className="relative border-b-2 border-border">
          <TopoWaveBorder />
        </div>
      </header>

      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative mx-auto max-w-6xl px-4 py-16 md:py-24"
      >
        <CompassRoseWatermark className="pointer-events-none absolute right-0 top-0 h-[400px] w-[400px] -translate-y-10 translate-x-10 md:h-[500px] md:w-[500px]" />

        <div className="grid items-center gap-12 md:grid-cols-2">
          {/* Left */}
          <div className="relative z-10 flex flex-col gap-6">
            <span
              className="inline-block w-fit border-2 border-border bg-warn px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider"
              style={{ boxShadow: "2px 2px 0 var(--color-border)" }}
            >
              61.8°N 11.1°E · RENDALEN
            </span>
            <h1 className="font-display text-5xl leading-tight tracking-wide md:text-6xl lg:text-7xl">
              Explore
              <br />
              <span className="relative text-accent">
                Rendalen
                <svg
                  className="absolute -bottom-2 left-0 w-full"
                  height="8"
                  viewBox="0 0 300 8"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0,4 Q30,0 60,4 T120,4 T180,4 T240,4 T300,4"
                    fill="none"
                    stroke="var(--color-contour)"
                    strokeWidth="1.5"
                    opacity="0.5"
                  />
                  <path
                    d="M0,6 Q30,2 60,6 T120,6 T180,6 T240,6 T300,6"
                    fill="none"
                    stroke="var(--color-contour)"
                    strokeWidth="1"
                    opacity="0.3"
                  />
                </svg>
              </span>
            </h1>
            <p className="max-w-md border-l-2 border-accent pl-4 font-mono text-sm text-muted">
              Interactive map patterns powered by Norwegian public APIs.
              Kartverket, Naturbase, NVE — all in one place.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/map"
                className="inline-flex items-center gap-2 border-2 border-border bg-accent px-5 py-2.5 font-mono text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
                style={{ boxShadow: "3px 3px 0 var(--color-border)" }}
              >
                <Compass className="h-4 w-4" /> View Map
              </Link>
              <Link
                to="/maplibre"
                className="inline-flex items-center gap-2 border-2 border-border bg-card px-5 py-2.5 font-mono text-sm font-bold text-fg transition-transform hover:-translate-y-0.5"
                style={{ boxShadow: "3px 3px 0 var(--color-border)" }}
              >
                <Globe className="h-4 w-4" /> MapLibre Peek
              </Link>
              <a
                href="#patterns"
                className="inline-flex items-center gap-2 border-2 border-border bg-card px-5 py-2.5 font-mono text-sm font-bold text-fg transition-transform hover:-translate-y-0.5"
                style={{ boxShadow: "3px 3px 0 var(--color-border)" }}
              >
                Browse Patterns
              </a>
            </div>
          </div>

          {/* Right - Mascot + Field Station Console */}
          <div className="flex flex-col items-center gap-6">
            <LandingMascot />

            {/* Field Station Console */}
            <div
              className="topo-lines relative w-full max-w-sm overflow-hidden border-2 border-border bg-card"
              style={{ boxShadow: "3px 3px 0 var(--color-border)" }}
            >
              <div className="scanlines" />
              {/* Station header */}
              <div className="flex items-center justify-between border-b-2 border-border bg-border/5 px-3 py-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted">
                  Field Station
                </span>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-topo animate-pulse" />
                  <span className="font-mono text-[10px] text-topo font-bold">
                    LIVE
                  </span>
                </div>
              </div>
              {/* Content */}
              <div className="p-4">
                {/* Compass + coordinates */}
                <div className="mb-3 flex items-center gap-2">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 8,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  >
                    <Compass className="h-5 w-5 text-accent" />
                  </motion.div>
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted">
                    Rendalen · 61.8°N 11.1°E
                  </span>
                </div>
                {/* Field readings */}
                <div className="flex flex-col gap-2">
                  {LAYER_CARDS.map((card) => (
                    <div
                      key={card.label}
                      className="flex items-center gap-2 border border-border/30 bg-bg/50 px-3 py-1.5 font-mono text-xs"
                    >
                      <span style={{ color: card.color }}>{card.icon}</span>
                      <span className="font-bold">{card.label}</span>
                      <span className="ml-auto text-[10px] text-muted">
                        {card.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Field log ticker */}
              <div className="overflow-hidden border-t-2 border-border bg-border/5 py-1.5">
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
                    FIELD LOG &middot; KARTVERKET &middot; NATURBASE &middot;
                    NVE &middot; RENDALEN KOMMUNE &middot; FIELD LOG &middot;
                    KARTVERKET &middot; NATURBASE &middot; NVE &middot; RENDALEN
                    KOMMUNE
                  </span>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Patterns */}
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
            {patterns.map((pattern, idx) => (
              <Link
                key={pattern.id}
                to={`/map?pattern=${pattern.id}`}
                className="group flex flex-col gap-3 border-2 border-border bg-card p-5 transition-transform hover:-translate-y-1"
                style={{ boxShadow: "3px 3px 0 var(--color-border)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center border-2 border-border bg-topo/10 text-topo">
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
                  <span className="ml-auto font-mono text-[10px] text-muted/50">
                    ELV {(idx + 1) * 340}m
                  </span>
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
      <section className="grid-paper border-y-2 border-border bg-card">
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
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-border ${feature.color}`}
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
      <footer className="relative overflow-hidden border-t-2 border-border bg-fg text-bg">
        <CompassRoseWatermark className="pointer-events-none absolute right-4 top-1/2 h-32 w-32 -translate-y-1/2 opacity-[0.06]" />
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center border-2 border-bg/20 font-display text-xl">
              M
            </span>
            <div className="flex flex-col">
              <span className="font-mono text-xs text-bg/60">
                &copy; {new Date().getFullYear()} Mister Maps
              </span>
              <span className="font-mono text-[10px] text-bg/40">
                Made in Norway &middot; 59.9°N 10.7°E
              </span>
            </div>
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
