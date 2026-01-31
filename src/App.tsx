import { Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import MapView from "./pages/MapView";
import MapLibreView from "./pages/MapLibreView";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/map" element={<MapView />} />
      <Route path="/maplibre" element={<MapLibreView />} />
    </Routes>
  );
}
