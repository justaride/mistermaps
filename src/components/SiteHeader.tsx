import { Link } from "react-router-dom";
import { Compass, ArrowRight } from "lucide-react";
import { MrMaps } from "./mascot";

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

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 bg-bg/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-3 no-underline text-fg">
          <MrMaps size={48} expression="happy" state="online" />
          <span className="font-display text-2xl tracking-wide">
            MISTER MAPS
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            to="/maps"
            className="inline-flex items-center gap-2 border-2 border-border bg-accent px-4 py-2 font-mono text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
            style={{ boxShadow: "3px 3px 0 var(--color-border)" }}
          >
            <Compass className="h-4 w-4" /> Browse Maps{" "}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <div className="relative border-b-2 border-border">
        <TopoWaveBorder />
      </div>
    </header>
  );
}
