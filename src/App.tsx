import { Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import MapsCatalog from "./pages/MapsCatalog";
import MapDetail from "./pages/MapDetail";
import RendalenProject from "./pages/RendalenProject";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/maps" element={<MapsCatalog />} />
      <Route path="/maps/:id" element={<MapDetail />} />
      <Route path="/projects/rendalen" element={<RendalenProject />} />
    </Routes>
  );
}
