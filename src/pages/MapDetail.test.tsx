import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { Pattern } from "../types";

const mocks = vi.hoisted(() => ({
  useParams: vi.fn(),
  loadPatternById: vi.fn(),
  logError: vi.fn(),
  mapContainer: vi.fn(
    ({ pattern }: { pattern: Pattern | null }) => (
      <div data-testid="map-container">{pattern?.id ?? "no-pattern"}</div>
    ),
  ),
  mapLibreContainer: vi.fn(
    ({ theme }: { theme: string }) => (
      <div data-testid="maplibre-container">{theme}</div>
    ),
  ),
  searchBox: vi.fn(
    ({ map }: { map: unknown }) => (
      <div data-testid="search-box">{map ? "with-map" : "no-map"}</div>
    ),
  ),
  controlsPanel: vi.fn(() => <div data-testid="controls-panel" />),
  codeViewer: vi.fn(
    ({ isOpen }: { isOpen: boolean }) => (
      <div data-testid="code-viewer">{isOpen ? "open" : "closed"}</div>
    ),
  ),
  themeToggle: vi.fn(
    ({ theme, onToggle }: { theme: string; onToggle: () => void }) => (
      <button data-testid="theme-toggle" onClick={onToggle} type="button">
        {theme}
      </button>
    ),
  ),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );

  return {
    ...actual,
    Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
    useParams: () => mocks.useParams(),
  };
});

vi.mock("../components", () => ({
  MapContainer: mocks.mapContainer,
  MapLibreContainer: mocks.mapLibreContainer,
  SearchBox: mocks.searchBox,
  ControlsPanel: mocks.controlsPanel,
  CodeViewer: mocks.codeViewer,
  ThemeToggle: mocks.themeToggle,
}));

vi.mock("../patterns/loadCatalogPattern", () => ({
  loadPatternById: (...args: unknown[]) => mocks.loadPatternById(...args),
}));

vi.mock("../utils/logger", () => ({
  logError: (...args: unknown[]) => mocks.logError(...args),
}));

import MapDetail from "./MapDetail";

function createPattern(overrides: Partial<Pattern> = {}): Pattern {
  return {
    id: "layer-basics",
    name: "Layer Basics",
    category: "layers",
    description: "Pattern description",
    controls: [
      {
        id: "opacity",
        label: "Opacity",
        type: "slider",
        defaultValue: 0.5,
        min: 0,
        max: 1,
        step: 0.1,
      },
    ],
    setup: vi.fn(),
    cleanup: vi.fn(),
    update: vi.fn(),
    snippet: "// code",
    ...overrides,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("MapDetail", () => {
  beforeEach(() => {
    mocks.useParams.mockReturnValue({ id: "layer-basics" });
  });

  afterEach(() => {
    vi.clearAllMocks();
    document.documentElement.removeAttribute("data-theme");
  });

  it("shows a loading state while the pattern module is being fetched", () => {
    const deferred = createDeferred<Pattern | null>();
    mocks.loadPatternById.mockReturnValue(deferred.promise);

    render(<MapDetail />);

    expect(screen.getByText("Loading pattern...")).toBeInTheDocument();
  });

  it("renders the not found state when a pattern cannot be loaded", async () => {
    mocks.loadPatternById.mockResolvedValue(null);

    render(<MapDetail />);

    expect(await screen.findByText("Pattern not found")).toBeInTheDocument();
    expect(screen.queryByTestId("controls-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("search-box")).not.toBeInTheDocument();
  });

  it("renders the MapLibre route without trying to load a pattern", () => {
    mocks.useParams.mockReturnValue({ id: "maplibre" });

    render(<MapDetail />);

    expect(screen.getByTestId("maplibre-container")).toBeInTheDocument();
    expect(mocks.loadPatternById).not.toHaveBeenCalled();
    expect(screen.queryByTestId("search-box")).not.toBeInTheDocument();
  });

  it("renders view-based patterns through their custom view component", async () => {
    const mockView = vi.fn(
      (({ theme }: { theme: string }) => (
        <div data-testid="pattern-view">{theme}</div>
      )) as NonNullable<Pattern["view"]>,
    );
    mocks.loadPatternById.mockResolvedValue(
      createPattern({
        id: "feature-edit-export",
        controls: [],
        view: mockView,
      }),
    );

    render(<MapDetail />);

    expect(await screen.findByTestId("pattern-view")).toBeInTheDocument();
    expect(mocks.mapContainer).not.toHaveBeenCalled();
    expect(screen.getByTestId("search-box")).toBeInTheDocument();
    expect(screen.getByTestId("controls-panel")).toBeInTheDocument();
  });

  it("renders standard patterns through MapContainer with default control values", async () => {
    mocks.loadPatternById.mockResolvedValue(createPattern());

    render(<MapDetail />);

    expect(await screen.findByTestId("map-container")).toBeInTheDocument();

    await waitFor(() => {
      expect(mocks.mapContainer).toHaveBeenCalled();
    });

    expect(mocks.mapContainer.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        pattern: expect.objectContaining({ id: "layer-basics" }),
        controlValues: { opacity: 0.5 },
        theme: "light",
      }),
    );

    expect(screen.getByTestId("search-box")).toBeInTheDocument();
    expect(screen.getByTestId("controls-panel")).toBeInTheDocument();
    expect(screen.getByTestId("code-viewer")).toHaveTextContent("closed");
  });

  it("hides the global search box when a pattern opts out", async () => {
    mocks.loadPatternById.mockResolvedValue(
      createPattern({
        id: "geocoding-search",
        disableGlobalSearch: true,
      }),
    );

    render(<MapDetail />);

    expect(await screen.findByTestId("map-container")).toBeInTheDocument();
    expect(screen.queryByTestId("search-box")).not.toBeInTheDocument();
  });
});
