import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MrMaps, SpeechBubble } from "../mascot";
import type { Expression, Pose, MascotState } from "../mascot";

type Scene = {
  expression: Expression;
  pose: Pose;
  state: MascotState;
  message: string;
  navigateOnClick?: string;
};

const SCENES: Scene[] = [
  {
    expression: "happy",
    pose: "wave",
    state: "presenting",
    message: "Welcome to Mister Maps!",
  },
  {
    expression: "thinking",
    pose: "scan",
    state: "scanning",
    message: "Scanning Norwegian data...",
  },
  {
    expression: "alert",
    pose: "stamp",
    state: "alert",
    message: "Rendalen Kommune ready!",
  },
  {
    expression: "wink",
    pose: "point",
    state: "online",
    message: "Ready to explore?",
    navigateOnClick: "/map",
  },
];

const SCENE_DURATION = 6000;

export function LandingMascot() {
  const navigate = useNavigate();
  const [sceneIndex, setSceneIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setSceneIndex((i) => (i + 1) % SCENES.length);
    }, SCENE_DURATION);
    return () => clearInterval(timer);
  }, [paused]);

  const scene = SCENES[sceneIndex];

  const handleClick = useCallback(() => {
    if (scene.navigateOnClick) {
      navigate(scene.navigateOnClick);
    }
  }, [scene.navigateOnClick, navigate]);

  return (
    <div
      className="flex flex-col items-center gap-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <SpeechBubble message={scene.message} state={scene.state} visible />
      <div
        onClick={handleClick}
        className={scene.navigateOnClick ? "cursor-pointer" : undefined}
        role={scene.navigateOnClick ? "button" : undefined}
        tabIndex={scene.navigateOnClick ? 0 : undefined}
        onKeyDown={(e) => {
          if (e.key === "Enter" && scene.navigateOnClick) handleClick();
        }}
      >
        <MrMaps
          expression={scene.expression}
          pose={scene.pose}
          state={scene.state}
          size={180}
        />
      </div>
      <div className="flex gap-1.5">
        {SCENES.map((_, i) => (
          <button
            key={i}
            onClick={() => setSceneIndex(i)}
            className={`h-2 w-2 rounded-full border border-border transition-colors ${
              i === sceneIndex ? "bg-accent" : "bg-muted/30"
            }`}
            aria-label={`Scene ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
