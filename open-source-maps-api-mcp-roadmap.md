# Open-Source Maps, API, and MCP Roadmap

Date: 2026-02-07  
Scope: Extend Mister Maps with open-source map providers, open APIs, and MCP integrations.

## Goals

1. Reduce dependence on single-vendor map APIs.
2. Add open-source provider demos that fit the existing pattern catalog.
3. Introduce MCP integrations for agent-assisted map workflows.
4. Keep current app quality and UX stable while expanding coverage.

## Current Baseline

- Existing providers: Mapbox + one MapLibre provider pattern.
- Existing APIs: Mapbox Geocoding + Norwegian public APIs in Rendalen pattern.
- Existing MCP setup in repo: none detected.

Reference inventory: `/Users/gabrielboen/Documents/Mister Maps/open-source-maps-api-mcp.md`

## Implementation Status (2026-02-08)

Completed (Week 1 foundation + Week 2 geocoding groundwork + Week 3 routing):
- Provider contracts + adapter structure added under `src/providers/` (`GeocodingProvider`, `RoutingProvider`, `BasemapProvider`).
- `SearchBox` refactored to use a provider-neutral geocoding service with abort/cancellation.
- Feature flags + dev telemetry hooks added for provider calls and fallback.
- Nominatim + Photon geocoding adapters added.
- **OSRM routing provider added** with configurable endpoint.
- **Valhalla routing provider added** with isochrone support.
- **RoutingService** with fallback logic implemented.
- **Route Display** pattern updated to support provider switching (Mapbox/OSRM).
- **Isochrones** pattern added using Valhalla API.
- **OpenFreeMap vector tiles** integrated into the MapLibre demo.
- **MCP Pilot** documentation created (`MCP.md`) with configuration for Mapbox and OSM servers.
- Search results now label the provider source (Mapbox/Nominatim/Photon).

Environment flags:
- `VITE_GEOCODING_PRIMARY_PROVIDER` (default: `mapbox`)
- `VITE_ENABLE_GEOCODING_FALLBACK` (default: `false`)
- `VITE_GEOCODING_FALLBACK_ORDER` (default: `nominatim,photon`)
- `VITE_NOMINATIM_ENDPOINT` (default: `https://nominatim.openstreetmap.org`)
- `VITE_PHOTON_ENDPOINT` (default: `https://photon.komoot.io`)
- `VITE_OSRM_ENDPOINT` (default: `https://router.project-osrm.org/route/v1`)
- `VITE_VALHALLA_ENDPOINT` (default: `https://valhalla1.openstreetmap.de`)

## Assumptions

1. One primary developer executing with periodic review.
2. Existing stack remains React + TypeScript + Vite + Mapbox/MapLibre.
3. Initial rollout prioritizes browser-side integration before heavy infra.
4. Time budget: 6 to 8 weeks part-time, or 3 to 4 weeks focused.

## Effort Estimate (Three-Point)

| Track | Optimistic | Most Likely | Pessimistic | PERT |
|---|---:|---:|---:|---:|
| Open geocoding fallback (Nominatim/Photon) | 2d | 4d | 7d | 4.2d |
| Open routing integration (OSRM) | 3d | 6d | 10d | 6.2d |
| Advanced routing (Valhalla/openrouteservice) | 3d | 7d | 12d | 7.2d |
| Open vector tile provider page | 4d | 8d | 14d | 8.3d |
| MCP pilot + tool workflows | 2d | 5d | 9d | 5.2d |
| Docs + hardening + QA | 3d | 5d | 9d | 5.3d |

Total PERT: ~36.4 working days (~7.3 weeks at 5d/week)

## Week-by-Week Plan

## Week 1: Foundation and Abstractions

- Define provider-neutral service interfaces:
  - `GeocodingProvider`
  - `RoutingProvider`
  - `BasemapProvider`
- Create adapter folder structure and feature flags.
- Add telemetry/error logging hooks for API fallback behavior.

Deliverables:
- Provider adapter contracts merged.
- Existing Mapbox behavior unchanged via compatibility adapter.

Exit Criteria:
- Build passes.
- No regression in current map routes and search.

## Week 2: Open Geocoding Fallback

- Integrate Nominatim adapter.
- Integrate Photon adapter.
- Update search flow:
  - Try primary provider.
  - Fallback on failure/rate-limit.
- Add user-visible source labeling in search results.

Deliverables:
- Search works with at least one open provider when Mapbox is unavailable.

Exit Criteria:
- Manual tests for both success and fallback paths.
- Debounce and cancellation behavior still stable.

## Week 3: Open Routing Baseline (OSRM)

- Add OSRM route provider.
- Wire into existing route pattern(s) with provider switch.
- Support route geometry + summary distance/duration.

Deliverables:
- Route display pattern supports Mapbox and OSRM.

Exit Criteria:
- Route demo parity for basic use cases.
- Clear error states when OSRM endpoint is unavailable.

## Week 4: Advanced Routing Optional Layer

- Add Valhalla or openrouteservice adapter.
- Implement one advanced demo:
  - isochrone, or
  - matrix/travel-time table.
- Compare response shape and normalize into shared model.

Deliverables:
- One advanced routing demo in catalog.

Exit Criteria:
- Shared routing type model supports at least 2 open routing engines.

## Week 5: Open Vector Tile Provider

- Create new provider page for:
  - Protomaps/PMTiles, or
  - OpenMapTiles-based source.
- Add style/theme toggle parity with existing provider pages.
- Document attribution/licensing requirements.

Deliverables:
- New provider entry in catalog.
- Working open vector tile demo route.

Exit Criteria:
- Provider loads reliably in dev/prod.
- Attribution rendered correctly.

## Week 6: MCP Pilot

- Add Mapbox MCP as first official baseline.
- Evaluate one OSM-focused MCP server in sandbox mode.
- Define agent workflows:
  - geocode place,
  - fetch route,
  - inspect map feature set.

Deliverables:
- MCP setup notes and tested command examples.

Exit Criteria:
- At least 3 repeatable MCP workflows documented and validated.

## Week 7: QA, Docs, and DX

- Add test plan and regression checklist (maps, routing, search, provider switch).
- Update README sections:
  - provider matrix,
  - API matrix,
  - MCP setup.
- Add troubleshooting for rate limits, CORS, fallback behavior.

Deliverables:
- Updated documentation and verification checklist.

Exit Criteria:
- Team can run and validate all providers from fresh clone.

## Week 8: Stabilization and Release

- Performance pass:
  - request dedupe,
  - cancellation,
  - timeout tuning.
- UX polish:
  - clearer loading and source indicators,
  - fallback transparency.
- Release candidate and rollout notes.

Deliverables:
- Stable release with open-source map/API/MCP expansion.

Exit Criteria:
- No critical regressions.
- Final checklist completed.

## Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Public endpoint rate limits | High | High | Cache, fallback chaining, optional self-host path |
| API response schema differences | High | Medium | Normalize into shared domain models |
| CORS/infrastructure blockers | Medium | High | Proxy option + environment-based adapters |
| MCP server maintenance variability | Medium | Medium | Start official-first, sandbox community servers |
| Scope creep | High | Medium | Timebox each week, strict exit criteria |

## Recommended Order (If Time-Constrained)

1. Week 1 + Week 2 (provider abstraction + geocoding fallback)
2. Week 3 (OSRM routing)
3. Week 5 (open vector provider)
4. Week 6 (MCP pilot)
5. Remaining QA/polish work

## Definition of Done

1. At least two open APIs live in production path (geocoding + routing).
2. At least one additional open provider map page in catalog.
3. MCP setup documented with tested workflows.
4. README and troubleshooting docs fully updated.
5. Build/lint pass with no functional regressions in existing patterns.
