import { motion, AnimatePresence } from "framer-motion";
import type { MrMapsProps, Expression, Pose } from "./types";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import { mouthPaths, stateColors } from "./mrMapsVariants";

const STATE_MAPPING: Record<string, { expression: Expression; pose: Pose }> = {
  offline: { expression: "neutral", pose: "idle" },
  online: { expression: "neutral", pose: "idle" },
  scanning: { expression: "thinking", pose: "scan" },
  alert: { expression: "alert", pose: "point" },
  presenting: { expression: "happy", pose: "idle" },
};

const EYE_SCALES: Record<Expression, { scaleY: number; y: number }> = {
  neutral: { scaleY: 1, y: 0 },
  happy: { scaleY: 0.6, y: 0 },
  alert: { scaleY: 1.2, y: -1 },
  thinking: { scaleY: 0.8, y: 1 },
  wink: { scaleY: 1, y: 0 },
};

const BROW_TRANSFORMS: Record<Expression, { left: string; right: string }> = {
  neutral: { left: "rotate(0)", right: "rotate(0)" },
  happy: { left: "rotate(-5deg)", right: "rotate(5deg)" },
  alert: { left: "rotate(8deg)", right: "rotate(-8deg)" },
  thinking: { left: "rotate(-12deg)", right: "rotate(0)" },
  wink: { left: "rotate(-5deg)", right: "rotate(5deg)" },
};

const ARM_TRANSFORMS: Record<Pose, { leftArm: string; rightArm: string }> = {
  idle: { leftArm: "rotate(0)", rightArm: "rotate(0)" },
  wave: { leftArm: "rotate(30deg)", rightArm: "rotate(-30deg)" },
  scan: { leftArm: "rotate(15deg)", rightArm: "rotate(-15deg)" },
  stamp: { leftArm: "rotate(0)", rightArm: "rotate(-90deg) translateY(-5px)" },
  point: { leftArm: "rotate(0)", rightArm: "rotate(-45deg) translateX(5px)" },
};

const idleAnimation = {
  y: [0, -2, 0],
  transition: { duration: 2.5, repeat: Infinity, ease: "easeInOut" as const },
};

const compassPingAnimation = {
  scale: [1, 1.3, 1],
  opacity: [1, 0.6, 1],
  transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" as const },
};

const scanArmAnimation = {
  rotate: [0, 8, -8, 0],
  transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" as const },
};

export function MrMaps({
  expression: expressionProp,
  pose: poseProp,
  state,
  size = 64,
  className,
}: MrMapsProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const shouldAnimate = !prefersReducedMotion;

  const expression: Expression = state
    ? STATE_MAPPING[state].expression
    : (expressionProp ?? "neutral");

  const pose: Pose = state ? STATE_MAPPING[state].pose : (poseProp ?? "idle");

  const eyeStyle = EYE_SCALES[expression];
  const browStyle = BROW_TRANSFORMS[expression];
  const armStyle = ARM_TRANSFORMS[pose];

  const transitionConfig = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 300, damping: 20 };

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`Mister Maps mascot - ${expression} expression, ${pose} pose`}
      className={className}
      animate={shouldAnimate && pose === "idle" ? idleAnimation : undefined}
    >
      {/* Compass Antenna */}
      <g id="antenna">
        <line
          x1="50"
          y1="8"
          x2="50"
          y2="18"
          stroke="#3d3530"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <motion.g animate={shouldAnimate ? compassPingAnimation : undefined}>
          <circle
            cx="50"
            cy="6"
            r="5"
            fill="#e8e0d0"
            stroke="#3d3530"
            strokeWidth="2"
          />
          <polygon points="50,2 51.5,5.5 48.5,5.5" fill="#c85a2a" />
          <polygon points="50,10 51.5,6.5 48.5,6.5" fill="#b0a898" />
          <line
            x1="46"
            y1="6"
            x2="48"
            y2="6"
            stroke="#3d3530"
            strokeWidth="1"
          />
          <line
            x1="52"
            y1="6"
            x2="54"
            y2="6"
            stroke="#3d3530"
            strokeWidth="1"
          />
          <circle cx="50" cy="6" r="1" fill="#3d3530" />
        </motion.g>
      </g>

      {/* Body Container */}
      <g id="body-group">
        {/* Main Body */}
        <rect
          x="25"
          y="20"
          width="50"
          height="55"
          rx="8"
          fill="#d4cbb5"
          stroke="#3d3530"
          strokeWidth="3"
        />

        {/* Screen/Face Area */}
        <rect x="30" y="25" width="40" height="35" rx="4" fill="#2c2c2c" />

        {/* Face */}
        <g id="face">
          {/* Left Eye */}
          <motion.ellipse
            cx="40"
            cy="40"
            rx="5"
            ry="6"
            fill="#6b8f71"
            animate={{ scaleY: eyeStyle.scaleY, y: eyeStyle.y }}
            transition={transitionConfig}
            style={{ originX: "40px", originY: "40px" }}
          />

          {/* Right Eye */}
          <motion.ellipse
            cx="60"
            cy="40"
            rx="5"
            ry="6"
            fill="#6b8f71"
            animate={{
              scaleY: expression === "wink" ? 0.1 : eyeStyle.scaleY,
              y: eyeStyle.y,
            }}
            transition={transitionConfig}
            style={{ originX: "60px", originY: "40px" }}
          />

          {/* Left Brow */}
          <motion.line
            x1="34"
            y1="32"
            x2="46"
            y2="32"
            stroke="#6b8f71"
            strokeWidth="2.5"
            strokeLinecap="round"
            animate={{ transform: browStyle.left }}
            transition={transitionConfig}
            style={{ originX: "40px", originY: "32px" }}
          />

          {/* Right Brow */}
          <motion.line
            x1="54"
            y1="32"
            x2="66"
            y2="32"
            stroke="#6b8f71"
            strokeWidth="2.5"
            strokeLinecap="round"
            animate={{ transform: browStyle.right }}
            transition={transitionConfig}
            style={{ originX: "60px", originY: "32px" }}
          />

          {/* Mouth */}
          <AnimatePresence mode="wait">
            <motion.path
              key={expression}
              d={mouthPaths[expression]}
              fill="none"
              stroke="#6b8f71"
              strokeWidth="2.5"
              strokeLinecap="round"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
            />
          </AnimatePresence>
        </g>

        {/* Status Light */}
        <motion.circle
          cx="73"
          cy="24"
          r="3"
          animate={{
            fill: stateColors[state ?? "online"],
            opacity: state === "scanning" ? [1, 0.3, 1] : 1,
          }}
          transition={
            state === "scanning" ? { duration: 1, repeat: Infinity } : undefined
          }
        />

        {/* Badge Screen */}
        <defs>
          <clipPath id="maps-badge-clip">
            <rect x="39" y="63" width="22" height="8" rx="1" />
          </clipPath>
        </defs>
        <rect
          x="38"
          y="62"
          width="24"
          height="10"
          rx="2"
          fill="#3d3530"
          stroke="#3d3530"
          strokeWidth="2"
        />
        <rect x="39" y="63" width="22" height="8" rx="1" fill="#1a1a1a" />
        <g clipPath="url(#maps-badge-clip)">
          <motion.text
            y="69.5"
            fontSize="6"
            fontWeight="bold"
            fontFamily="'JetBrains Mono', monospace"
            fill="#c85a2a"
            initial={{ x: 62 }}
            animate={shouldAnimate ? { x: [62, 10] } : { x: 36 }}
            transition={
              shouldAnimate
                ? { duration: 4, repeat: Infinity, ease: "linear" }
                : { duration: 0 }
            }
          >
            MISTER MAPS
          </motion.text>
        </g>

        {/* Folded map poking out of body */}
        <g transform="translate(68, 54)">
          <rect
            x="0"
            y="0"
            width="6"
            height="10"
            rx="0.5"
            fill="#e8e0d0"
            stroke="#3d3530"
            strokeWidth="1"
          />
          <line
            x1="1"
            y1="2.5"
            x2="5"
            y2="2.5"
            stroke="#c85a2a"
            strokeWidth="0.5"
            opacity="0.6"
          />
          <line
            x1="1"
            y1="5"
            x2="5"
            y2="5"
            stroke="#c85a2a"
            strokeWidth="0.5"
            opacity="0.6"
          />
          <line
            x1="3"
            y1="0.5"
            x2="3"
            y2="9"
            stroke="#5b8fa8"
            strokeWidth="0.3"
            strokeDasharray="1.5 0.5"
            opacity="0.5"
          />
        </g>

        {/* Left Arm */}
        <motion.g
          id="left-arm"
          animate={{ transform: armStyle.leftArm }}
          transition={transitionConfig}
          style={{ originX: "25px", originY: "45px" }}
        >
          <rect
            x="12"
            y="40"
            width="15"
            height="8"
            rx="3"
            fill="#c4bdb2"
            stroke="#3d3530"
            strokeWidth="2"
          />
          <circle
            cx="14"
            cy="44"
            r="4"
            fill="#c4bdb2"
            stroke="#3d3530"
            strokeWidth="2"
          />

          {/* Magnifier for scan pose */}
          {pose === "scan" && (
            <g transform="translate(8, 30)">
              <circle
                cx="0"
                cy="0"
                r="6"
                fill="none"
                stroke="#3d3530"
                strokeWidth="2"
              />
              <circle cx="0" cy="0" r="4" fill="rgba(91,143,168,0.15)" />
              <line
                x1="4"
                y1="4"
                x2="9"
                y2="9"
                stroke="#3d3530"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>
          )}

          {/* Folded map for stamp pose */}
          {pose === "stamp" && (
            <g transform="translate(6, 30)">
              <rect
                x="-5"
                y="-4"
                width="10"
                height="12"
                rx="1"
                fill="#e8e0d0"
                stroke="#3d3530"
                strokeWidth="1.5"
              />
              <line
                x1="-3"
                y1="-1"
                x2="3"
                y2="-1"
                stroke="#c85a2a"
                strokeWidth="0.8"
                opacity="0.6"
              />
              <line
                x1="-3"
                y1="2"
                x2="3"
                y2="2"
                stroke="#c85a2a"
                strokeWidth="0.8"
                opacity="0.6"
              />
              <line
                x1="-3"
                y1="5"
                x2="1"
                y2="5"
                stroke="#c85a2a"
                strokeWidth="0.8"
                opacity="0.6"
              />
            </g>
          )}
        </motion.g>

        {/* Right Arm */}
        <motion.g
          id="right-arm"
          animate={{
            transform: armStyle.rightArm,
            ...(shouldAnimate && pose === "scan" ? scanArmAnimation : {}),
          }}
          transition={transitionConfig}
          style={{ originX: "75px", originY: "45px" }}
        >
          <rect
            x="73"
            y="40"
            width="15"
            height="8"
            rx="3"
            fill="#c4bdb2"
            stroke="#3d3530"
            strokeWidth="2"
          />
          <circle
            cx="86"
            cy="44"
            r="4"
            fill="#c4bdb2"
            stroke="#3d3530"
            strokeWidth="2"
          />
        </motion.g>

        {/* Legs */}
        <rect
          x="32"
          y="75"
          width="12"
          height="10"
          rx="2"
          fill="#c4bdb2"
          stroke="#3d3530"
          strokeWidth="2"
        />
        <rect
          x="56"
          y="75"
          width="12"
          height="10"
          rx="2"
          fill="#c4bdb2"
          stroke="#3d3530"
          strokeWidth="2"
        />

        {/* Feet */}
        <rect x="30" y="85" width="16" height="6" rx="2" fill="#8a8278" />
        <rect x="54" y="85" width="16" height="6" rx="2" fill="#8a8278" />
      </g>
    </motion.svg>
  );
}
