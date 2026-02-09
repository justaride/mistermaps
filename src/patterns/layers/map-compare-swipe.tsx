import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react";
import mapboxgl from "mapbox-gl";
import type { Pattern, PatternViewProps } from "../../types";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

type StyleOption = { label: string; value: string };

const STYLE_OPTIONS: StyleOption[] = [
  { label: "Light", value: "mapbox://styles/mapbox/light-v11" },
  { label: "Dark", value: "mapbox://styles/mapbox/dark-v11" },
  { label: "Streets", value: "mapbox://styles/mapbox/streets-v12" },
  { label: "Outdoors", value: "mapbox://styles/mapbox/outdoors-v12" },
  {
    label: "Satellite Streets",
    value: "mapbox://styles/mapbox/satellite-streets-v12",
  },
];

const DEFAULT_LEFT_STYLE = STYLE_OPTIONS[0]?.value ?? "";
const DEFAULT_RIGHT_STYLE = STYLE_OPTIONS[1]?.value ?? DEFAULT_LEFT_STYLE;

export const mapCompareSwipePattern: Pattern = {
  id: "map-compare-swipe",
  name: "Map Compare / Swipe",
  category: "layers",
  description: "Compare two styles with a swipe divider and synced camera.",
  controls: [
    {
      id: "leftStyle",
      label: "Left style",
      type: "select",
      defaultValue: DEFAULT_LEFT_STYLE,
      options: STYLE_OPTIONS,
    },
    {
      id: "rightStyle",
      label: "Right style",
      type: "select",
      defaultValue: DEFAULT_RIGHT_STYLE,
      options: STYLE_OPTIONS,
    },
    {
      id: "swipe",
      label: "Swipe",
      type: "slider",
      defaultValue: 50,
      min: 0,
      max: 100,
      step: 1,
    },
    {
      id: "syncEnabled",
      label: "Sync camera",
      type: "toggle",
      defaultValue: true,
    },
    {
      id: "swapSides",
      label: "Swap",
      type: "button",
      defaultValue: "",
    },
  ],

  // This pattern is driven by a custom view (two maps + swipe UI).
  setup() {},
  cleanup() {},
  update() {},
  view: MapCompareSwipeView,

  snippet: `// Swipe compare (two maps, synced camera)
const left = new mapboxgl.Map({ container: leftEl, style: leftStyle });
const right = new mapboxgl.Map({ container: rightEl, style: rightStyle });

// Clip the top map to reveal left/right
rightWrapper.style.clipPath = \`inset(0 0 0 \${swipePct}%)\`;

// Sync camera both directions (guard against feedback loops)
left.on('move', () => right.jumpTo(getCamera(left)));
right.on('move', () => left.jumpTo(getCamera(right)));`,
};

function MapCompareSwipeView({
  values,
  onChange,
  onPrimaryMapReady,
}: PatternViewProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);

  const leftMapRef = useRef<mapboxgl.Map | null>(null);
  const rightMapRef = useRef<mapboxgl.Map | null>(null);

  const appliedLeftStyleRef = useRef<string | null>(null);
  const appliedRightStyleRef = useRef<string | null>(null);

  const isApplyingToLeftRef = useRef(false);
  const isApplyingToRightRef = useRef(false);
  const syncEnabledRef = useRef(true);

  const dragActiveRef = useRef(false);
  const lastSwapTsRef = useRef<number | null>(null);

  const leftStyle =
    typeof values.leftStyle === "string" ? values.leftStyle : DEFAULT_LEFT_STYLE;
  const rightStyle =
    typeof values.rightStyle === "string"
      ? values.rightStyle
      : DEFAULT_RIGHT_STYLE;

  const swipePct = clampNumber(values.swipe, 0, 100, 50);
  const syncEnabled = Boolean(values.syncEnabled);

  syncEnabledRef.current = syncEnabled;

  const clipStyle = useMemo(() => {
    // Show the right-side map on top, clipped from the left edge.
    // swipe=0 => right fully visible, swipe=100 => right hidden.
    return { clipPath: `inset(0 0 0 ${swipePct}%)` as const };
  }, [swipePct]);

  useEffect(() => {
    if (!leftRef.current || !rightRef.current) return;
    if (leftMapRef.current || rightMapRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const leftMap = new mapboxgl.Map({
      container: leftRef.current,
      style: leftStyle,
      center: [10.75, 59.91],
      zoom: 11.5,
      bearing: 0,
      pitch: 0,
      attributionControl: true,
    });

    const rightMap = new mapboxgl.Map({
      container: rightRef.current,
      style: rightStyle,
      center: [10.75, 59.91],
      zoom: 11.5,
      bearing: 0,
      pitch: 0,
      // Avoid double attribution and control overlaps.
      attributionControl: false,
    });

    leftMap.addControl(new mapboxgl.NavigationControl(), "top-right");

    leftMapRef.current = leftMap;
    rightMapRef.current = rightMap;

    appliedLeftStyleRef.current = leftStyle;
    appliedRightStyleRef.current = rightStyle;

    onPrimaryMapReady?.(leftMap);

    const syncFromLeft = () => {
      if (!syncEnabledRef.current) return;
      if (isApplyingToLeftRef.current) return;
      if (!leftMapRef.current || !rightMapRef.current) return;
      if (isApplyingToRightRef.current) return;

      isApplyingToRightRef.current = true;
      rightMap.jumpTo(getCamera(leftMap));
      requestAnimationFrame(() => {
        isApplyingToRightRef.current = false;
      });
    };

    const syncFromRight = () => {
      if (!syncEnabledRef.current) return;
      if (isApplyingToRightRef.current) return;
      if (!leftMapRef.current || !rightMapRef.current) return;
      if (isApplyingToLeftRef.current) return;

      isApplyingToLeftRef.current = true;
      leftMap.jumpTo(getCamera(rightMap));
      requestAnimationFrame(() => {
        isApplyingToLeftRef.current = false;
      });
    };

    leftMap.on("move", syncFromLeft);
    rightMap.on("move", syncFromRight);

    const ro = new ResizeObserver(() => {
      leftMap.resize();
      rightMap.resize();
    });
    if (rootRef.current) ro.observe(rootRef.current);

    return () => {
      ro.disconnect();
      leftMap.off("move", syncFromLeft);
      rightMap.off("move", syncFromRight);
      leftMap.remove();
      rightMap.remove();
      leftMapRef.current = null;
      rightMapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const swapTs = typeof values.swapSides === "number" ? values.swapSides : null;
    if (!swapTs || swapTs === lastSwapTsRef.current) return;
    lastSwapTsRef.current = swapTs;

    onChange("leftStyle", rightStyle);
    onChange("rightStyle", leftStyle);
  }, [values.swapSides, leftStyle, rightStyle, onChange]);

  useEffect(() => {
    const map = leftMapRef.current;
    if (!map) return;
    if (appliedLeftStyleRef.current === leftStyle) return;

    appliedLeftStyleRef.current = leftStyle;
    const camera = getCamera(map);
    map.setStyle(leftStyle);
    map.once("style.load", () => {
      map.jumpTo(camera);
      map.resize();
    });
  }, [leftStyle]);

  useEffect(() => {
    const map = rightMapRef.current;
    if (!map) return;
    if (appliedRightStyleRef.current === rightStyle) return;

    appliedRightStyleRef.current = rightStyle;
    const camera = getCamera(map);
    map.setStyle(rightStyle);
    map.once("style.load", () => {
      map.jumpTo(camera);
      map.resize();
    });
  }, [rightStyle]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onPointerMove = (e: globalThis.PointerEvent) => {
      if (!dragActiveRef.current) return;
      if (!rootRef.current) return;

      const rect = rootRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      onChange("swipe", clamp(pct, 0, 100));
    };

    const onPointerUp = () => {
      dragActiveRef.current = false;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [onChange]);

  const onDividerPointerDown = (e: ReactPointerEvent) => {
    dragActiveRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    // Immediate update so click-to-set works even without moving.
    if (rootRef.current) {
      const rect = rootRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      onChange("swipe", clamp(pct, 0, 100));
    }
  };

  return (
    <div ref={rootRef} className="absolute inset-0">
      <div ref={leftRef} className="absolute inset-0" />

      <div className="absolute inset-0" style={clipStyle}>
        <div ref={rightRef} className="absolute inset-0" />
      </div>

      {/* Divider + handle */}
      <div
        className="absolute top-0 h-full"
        style={{ left: `${swipePct}%`, transform: "translateX(-1px)" }}
      >
        <div
          className="h-full w-[2px] bg-border/80"
          style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.05)" }}
        />
      </div>

      <div
        role="button"
        aria-label="Drag to adjust swipe"
        className="absolute top-1/2 z-10 -translate-y-1/2 rounded-sm border-2 border-border bg-card"
        style={{
          left: `${swipePct}%`,
          transform: "translate(-50%, -50%)",
          width: 28,
          height: 44,
          touchAction: "none",
          boxShadow: "2px 2px 0 var(--color-border)",
          cursor: "ew-resize",
        }}
        onPointerDown={onDividerPointerDown}
      >
        <div className="flex h-full w-full items-center justify-center">
          <div className="flex flex-col gap-1">
            <div className="h-[2px] w-3 bg-border/80" />
            <div className="h-[2px] w-3 bg-border/80" />
            <div className="h-[2px] w-3 bg-border/80" />
          </div>
        </div>
      </div>
    </div>
  );
}

function getCamera(map: mapboxgl.Map): mapboxgl.CameraOptions {
  const center = map.getCenter();
  return {
    center: [center.lng, center.lat],
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  };
}

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return clamp(value, min, max);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
