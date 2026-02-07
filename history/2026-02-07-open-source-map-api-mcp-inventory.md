# Open-Source Maps + API + MCP Inventory (2026-02-07)

## 1) Current project baseline (what already exists)

### Map stack in repo
- `mapbox-gl` and `maplibre-gl` are both installed (`/Users/gabrielboen/Documents/Mister Maps/package.json`).
- Catalog is mostly `provider: "mapbox"` with one `provider: "maplibre"` entry (`/Users/gabrielboen/Documents/Mister Maps/src/data/catalog.ts`).
- MapLibre route uses OSM raster (light) + CARTO Dark Matter raster (dark) (`/Users/gabrielboen/Documents/Mister Maps/src/hooks/useMapLibre.ts`).

### API usage already in repo
- Mapbox Geocoding API in search box (`/Users/gabrielboen/Documents/Mister Maps/src/components/SearchBox.tsx`).
- Norwegian public APIs in Rendalen pattern (`/Users/gabrielboen/Documents/Mister Maps/src/patterns/layers/rendalen-data.ts`):
  - Geonorge kommuneinfo
  - Miljodirektoratet ArcGIS REST
  - NVE Innsjodatabase + ELVIS (ArcGIS REST)
  - Geonorge WFS (trails)

### MCP in repo
- No project-local MCP config detected (`.cursor`, `.claude`, repo root).

---

## 2) Open-source map options not yet in project

## 2.1 Rendering engines/libraries (missing)

| Option | Type | Why it matters for Mister Maps | Source |
|---|---|---|---|
| Leaflet | 2D web map library | Lightweight 2D baseline demos and plugin ecosystem | https://leafletjs.com/ |
| OpenLayers | 2D/OGC-heavy web map library | Strong WMS/WFS/WMTS + enterprise GIS interoperability demos | https://openlayers.org/ |
| deck.gl | GPU visualization framework | High-density geospatial data viz layer demos | https://deck.gl/ |
| CesiumJS | 3D globe + terrain | 3D globe, terrain, and volumetric demo track | https://github.com/CesiumGS/cesium |

## 2.2 Open map data/style stacks (missing)

| Option | Type | Why it matters | Source |
|---|---|---|---|
| Protomaps + PMTiles | Vector tile packaging + hosted/self-host API | Cheap self-hosted vector maps and offline-friendly artifact model | https://protomaps.com/ |
| OpenMapTiles | Open vector tiles/schema/styles | Self-hostable OSM vector basemap pipeline | https://openmaptiles.org/ |
| OpenFreeMap | Open-source hosted/self-host stack | No-key public instance + open infra for demos | https://openfreemap.org/ |
| OpenTopoMap | OSM+SRTM topo style | Topographic style option for hiking/terrain demos | https://wiki.openstreetmap.org/wiki/OpenTopoMap |

---

## 3) Open API list not in project yet (map-focused)

| API | Capability | Self-host | Notes for Mister Maps | Source |
|---|---|---|---|---|
| Nominatim | Forward/reverse geocoding | Yes | Mapbox geocoder fallback/replacement path | https://nominatim.org/release-docs/latest/api/Overview/ |
| Overpass API | Query OSM features by tag/area | Yes | Live POI/category overlays without standing DB | https://wiki.openstreetmap.org/wiki/Overpass_API |
| OSRM | Routing API | Yes | Fast routing demos (route, table, match) | https://project-osrm.org/docs/v5.24.0/api/ |
| Valhalla | Routing + matrix + isochrones + map matching + elevation | Yes | Advanced multimodal routing demos | https://valhalla.github.io/valhalla/ |
| openrouteservice | Routing + isochrones + matrix + snap | Yes | Rich route analysis APIs and local deploy option | https://github.com/GIScience/openrouteservice |
| Pelias | Open geocoder stack | Yes | Full open geocoding backend for production-like setup | https://github.com/pelias/pelias |
| Photon | OSM geocoder | Yes | Simpler open geocoder alternative | https://github.com/komoot/photon |
| Open-Elevation / Open Topo Data | Elevation point/profile API | Yes | Elevation profile demos without proprietary provider | https://open-elevation.com/ / https://www.opentopodata.org/ |

---

## 4) MCP list to consider (geo/mapping)

| MCP Server | Status | Fit for Mister Maps | Source |
|---|---|---|---|
| Mapbox MCP Server | Official (Mapbox maintained) | Fastest way to add geocoding/routing/matrix/isochrone/static-map tools to agents | https://docs.mapbox.com/api/guides/mcp-server/ |
| wiseman/osm-mcp | Community | OSM + PostGIS map control tools; useful for local geo-agent experiments | https://github.com/wiseman/osm-mcp |
| jagan-shanmugam/open-streetmap-mcp | Community | Broad OSM geospatial tools (geocode/routing/POI workflows) | https://github.com/jagan-shanmugam/open-streetmap-mcp |
| NERVsystems/osmmcp | Community | Go-based OSM MCP with routing/geocoding/nearby analysis features | https://github.com/NERVsystems/osmmcp |
| mahdin75/gis-mcp | Community (active beta) | Spatial analysis/transforms/statistics toolset for GIS-heavy agent tasks | https://github.com/mahdin75/gis-mcp |
| mahdin75/geoserver-mcp | Community | MCP bridge to GeoServer REST for WMS/WFS-style workflows | https://github.com/mahdin75/geoserver-mcp |

### MCP caution
- The `modelcontextprotocol/servers` repo marks many old reference servers (including Google Maps/PostgreSQL references) as archived; use maintained official/community integrations instead of assuming legacy examples are current.
- Source: https://github.com/modelcontextprotocol/servers

---

## 5) Priority shortlist (recommended first additions)

1. **Open geocoding fallback:** Nominatim + Photon (keep Mapbox as optional primary).
2. **Open routing track:** OSRM first, then Valhalla for advanced multimodal/isochrone demos.
3. **Vector self-host experiment:** Protomaps (PMTiles) or OpenMapTiles as a new provider page.
4. **MCP pilot:** start with Mapbox MCP (official), then evaluate one OSM MCP server in a sandbox.

