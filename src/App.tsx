import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";

const Landing = lazy(() => import("./pages/Landing"));
const MapsCatalog = lazy(() => import("./pages/MapsCatalog"));
const MapDetail = lazy(() => import("./pages/MapDetail"));
const RendalenProject = lazy(() => import("./pages/RendalenProject"));
const OsloSatellite = lazy(() => import("./pages/OsloSatellite"));

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-bg font-mono text-sm text-muted">
          Loading page...
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/maps" element={<MapsCatalog />} />
        <Route path="/maps/:id" element={<MapDetail />} />
        <Route path="/projects/rendalen" element={<RendalenProject />} />
        <Route path="/projects/oslo-satellite" element={<OsloSatellite />} />
      </Routes>
    </Suspense>
  );
}
