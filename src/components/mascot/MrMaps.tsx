import { motion } from "framer-motion";
import type { MrMapsProps } from "./types";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import {
  bodyVariants,
  armLeftVariants,
  armRightVariants,
  eyeVariants,
  browVariants,
  mouthPaths,
  compassVariants,
  badgeScrollVariants,
  stateColors,
} from "./mrMapsVariants";

export function MrMaps({
  expression = "neutral",
  pose = "idle",
  state = "online",
  size = 200,
  className,
}: MrMapsProps) {
  const reduced = usePrefersReducedMotion();

  return (
    <motion.svg
      viewBox="0 0 200 240"
      width={size}
      height={size * 1.2}
      className={className}
      variants={bodyVariants}
      initial="idle"
      whileHover={reduced ? undefined : "hover"}
      role="img"
      aria-label="MrMaps robot mascot"
    >
      {/* Antenna - Compass */}
      <g transform="translate(100, 20)">
        <line x1="0" y1="0" x2="0" y2="25" stroke="#4a4038" strokeWidth="3" />
        <motion.g
          variants={reduced ? undefined : compassVariants}
          animate={
            state === "scanning"
              ? "scanning"
              : state === "alert"
                ? "alert"
                : "idle"
          }
        >
          {/* Compass rose with contour detail */}
          <circle
            cx="0"
            cy="0"
            r="10"
            fill="#e8e0d0"
            stroke="#3d3530"
            strokeWidth="2"
          />
          <circle
            cx="0"
            cy="0"
            r="8"
            fill="none"
            stroke="#3d3530"
            strokeWidth="0.5"
            opacity="0.4"
          />
          <circle
            cx="0"
            cy="0"
            r="6"
            fill="none"
            stroke="#3d3530"
            strokeWidth="0.3"
            opacity="0.3"
          />
          {/* N-S needle */}
          <polygon points="0,-8 2,-1 -2,-1" fill="#c85a2a" />
          <polygon points="0,8 2,1 -2,1" fill="#b0a898" />
          {/* E-W ticks */}
          <line
            x1="-7"
            y1="0"
            x2="-4"
            y2="0"
            stroke="#3d3530"
            strokeWidth="1.5"
          />
          <line
            x1="4"
            y1="0"
            x2="7"
            y2="0"
            stroke="#3d3530"
            strokeWidth="1.5"
          />
          {/* Diagonal ticks */}
          <line
            x1="-5"
            y1="-5"
            x2="-3.5"
            y2="-3.5"
            stroke="#3d3530"
            strokeWidth="0.8"
          />
          <line
            x1="5"
            y1="-5"
            x2="3.5"
            y2="-3.5"
            stroke="#3d3530"
            strokeWidth="0.8"
          />
          <line
            x1="-5"
            y1="5"
            x2="-3.5"
            y2="3.5"
            stroke="#3d3530"
            strokeWidth="0.8"
          />
          <line
            x1="5"
            y1="5"
            x2="3.5"
            y2="3.5"
            stroke="#3d3530"
            strokeWidth="0.8"
          />
          <circle cx="0" cy="0" r="2" fill="#3d3530" />
        </motion.g>
      </g>

      {/* Head */}
      <rect
        x="60"
        y="45"
        width="80"
        height="60"
        rx="8"
        fill="#c8bfad"
        stroke="#3d3530"
        strokeWidth="2.5"
      />
      {/* Visor */}
      <rect x="68" y="55" width="64" height="30" rx="4" fill="#2c2c2c" />

      {/* Eyes */}
      <g transform="translate(88, 70)">
        {/* Left eye */}
        <motion.ellipse
          cx="0"
          cy="0"
          rx="6"
          ry="6"
          fill="#6b8f71"
          variants={eyeVariants}
          animate={expression}
        />
        {/* Right eye */}
        <motion.ellipse
          cx="24"
          cy="0"
          rx="6"
          ry="6"
          fill="#6b8f71"
          variants={expression === "wink" ? eyeVariants : undefined}
          animate={expression === "wink" ? "wink" : expression}
          style={
            expression !== "wink"
              ? { scaleY: expression === "happy" ? 0.6 : 1 }
              : undefined
          }
        />
      </g>

      {/* Brows */}
      <motion.line
        x1="80"
        y1="58"
        x2="94"
        y2="58"
        stroke="#6b8f71"
        strokeWidth="2"
        strokeLinecap="round"
        variants={browVariants}
        animate={expression}
      />
      <motion.line
        x1="106"
        y1="58"
        x2="120"
        y2="58"
        stroke="#6b8f71"
        strokeWidth="2"
        strokeLinecap="round"
        variants={browVariants}
        animate={expression}
      />

      {/* Mouth */}
      <motion.path
        d={mouthPaths[expression]}
        transform="translate(88, 82)"
        fill="none"
        stroke="#6b8f71"
        strokeWidth="2"
        strokeLinecap="round"
        initial={false}
        animate={{ d: mouthPaths[expression] }}
        transition={{ duration: 0.3 }}
      />

      {/* Status light */}
      <motion.circle
        cx="145"
        cy="50"
        r="4"
        animate={{
          fill: stateColors[state],
          opacity: state === "scanning" ? [1, 0.3, 1] : 1,
        }}
        transition={
          state === "scanning" ? { duration: 1, repeat: Infinity } : undefined
        }
      />

      {/* Body */}
      <rect
        x="55"
        y="110"
        width="90"
        height="70"
        rx="6"
        fill="#c8bfad"
        stroke="#3d3530"
        strokeWidth="2.5"
      />

      {/* Badge / LED panel */}
      <rect x="65" y="120" width="70" height="16" rx="2" fill="#2c2c2c" />
      <clipPath id="badge-clip">
        <rect x="65" y="120" width="70" height="16" rx="2" />
      </clipPath>
      <g clipPath="url(#badge-clip)">
        <motion.text
          x="67"
          y="133"
          fill="#c85a2a"
          fontSize="10"
          fontFamily="'JetBrains Mono', monospace"
          fontWeight="700"
          letterSpacing="2"
          variants={reduced ? undefined : badgeScrollVariants}
          animate="animate"
        >
          MISTER MAPS ★ MISTER MAPS ★
        </motion.text>
      </g>

      {/* Chest detail - grid lines */}
      <line
        x1="75"
        y1="142"
        x2="125"
        y2="142"
        stroke="#a09888"
        strokeWidth="0.5"
      />
      <line
        x1="75"
        y1="148"
        x2="125"
        y2="148"
        stroke="#a09888"
        strokeWidth="0.5"
      />
      <line
        x1="75"
        y1="154"
        x2="125"
        y2="154"
        stroke="#a09888"
        strokeWidth="0.5"
      />
      <line
        x1="90"
        y1="140"
        x2="90"
        y2="158"
        stroke="#a09888"
        strokeWidth="0.5"
      />
      <line
        x1="110"
        y1="140"
        x2="110"
        y2="158"
        stroke="#a09888"
        strokeWidth="0.5"
      />

      {/* Folded map sticking out of body */}
      <g transform="translate(130, 155)">
        <rect
          x="0"
          y="-4"
          width="12"
          height="18"
          fill="#e8e0d0"
          stroke="#3d3530"
          strokeWidth="1"
          rx="1"
        />
        <line
          x1="2"
          y1="0"
          x2="10"
          y2="0"
          stroke="#c85a2a"
          strokeWidth="0.5"
          opacity="0.6"
        />
        <line
          x1="2"
          y1="3"
          x2="10"
          y2="3"
          stroke="#c85a2a"
          strokeWidth="0.5"
          opacity="0.6"
        />
        <line
          x1="2"
          y1="6"
          x2="10"
          y2="6"
          stroke="#c85a2a"
          strokeWidth="0.5"
          opacity="0.6"
        />
        <line
          x1="6"
          y1="-2"
          x2="6"
          y2="12"
          stroke="#5b8fa8"
          strokeWidth="0.4"
          opacity="0.5"
          strokeDasharray="2 1"
        />
      </g>

      {/* Belly button / power indicator */}
      <circle
        cx="100"
        cy="165"
        r="5"
        fill="#333"
        stroke="#4a4038"
        strokeWidth="1"
      />
      <circle cx="100" cy="165" r="2" fill={stateColors[state]} />

      {/* Left arm */}
      <motion.g
        style={{ originX: "55px", originY: "120px" }}
        variants={armLeftVariants}
        animate={pose}
      >
        <rect
          x="30"
          y="115"
          width="25"
          height="12"
          rx="6"
          fill="#b0a898"
          stroke="#3d3530"
          strokeWidth="2"
        />
        <circle
          cx="28"
          cy="121"
          r="8"
          fill="#c4bdb2"
          stroke="#3d3530"
          strokeWidth="2"
        />
        {/* Scan pose: magnifying glass */}
        {pose === "scan" && (
          <g transform="translate(15, 108)">
            <circle
              cx="0"
              cy="0"
              r="9"
              fill="none"
              stroke="#3d3530"
              strokeWidth="2.5"
            />
            <circle cx="0" cy="0" r="7" fill="rgba(91,143,168,0.15)" />
            <line
              x1="6"
              y1="6"
              x2="12"
              y2="12"
              stroke="#3d3530"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </g>
        )}
        {/* Stamp pose: folded map */}
        {pose === "stamp" && (
          <g transform="translate(10, 108)">
            <rect
              x="-8"
              y="-6"
              width="16"
              height="12"
              fill="#e8e0d0"
              stroke="#3d3530"
              strokeWidth="1.5"
              rx="1"
            />
            <line
              x1="-6"
              y1="-3"
              x2="6"
              y2="-3"
              stroke="#c85a2a"
              strokeWidth="0.8"
              opacity="0.6"
            />
            <line
              x1="-6"
              y1="0"
              x2="6"
              y2="0"
              stroke="#c85a2a"
              strokeWidth="0.8"
              opacity="0.6"
            />
            <line
              x1="-6"
              y1="3"
              x2="3"
              y2="3"
              stroke="#c85a2a"
              strokeWidth="0.8"
              opacity="0.6"
            />
            <line
              x1="0"
              y1="-6"
              x2="0"
              y2="6"
              stroke="#5b8fa8"
              strokeWidth="0.5"
              strokeDasharray="2 1"
              opacity="0.5"
            />
          </g>
        )}
      </motion.g>

      {/* Right arm */}
      <motion.g
        style={{ originX: "145px", originY: "120px" }}
        variants={armRightVariants}
        animate={pose}
      >
        <rect
          x="145"
          y="115"
          width="25"
          height="12"
          rx="6"
          fill="#b0a898"
          stroke="#3d3530"
          strokeWidth="2"
        />
        <circle
          cx="172"
          cy="121"
          r="8"
          fill="#c4bdb2"
          stroke="#3d3530"
          strokeWidth="2"
        />
      </motion.g>

      {/* Legs */}
      <rect
        x="68"
        y="180"
        width="18"
        height="30"
        rx="4"
        fill="#b0a898"
        stroke="#3d3530"
        strokeWidth="2"
      />
      <rect
        x="114"
        y="180"
        width="18"
        height="30"
        rx="4"
        fill="#b0a898"
        stroke="#3d3530"
        strokeWidth="2"
      />

      {/* Feet */}
      <rect
        x="62"
        y="208"
        width="30"
        height="10"
        rx="5"
        fill="#8a8278"
        stroke="#3d3530"
        strokeWidth="2"
      />
      <rect
        x="108"
        y="208"
        width="30"
        height="10"
        rx="5"
        fill="#8a8278"
        stroke="#3d3530"
        strokeWidth="2"
      />
    </motion.svg>
  );
}
