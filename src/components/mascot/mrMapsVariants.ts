import type { Variants } from "framer-motion";

export const bodyVariants: Variants = {
  idle: { y: 0 },
  hover: { y: -4, transition: { type: "spring", stiffness: 300 } },
};

export const armLeftVariants: Variants = {
  idle: { rotate: 0 },
  wave: {
    rotate: [-10, 20, -10, 15, 0],
    transition: { duration: 1.2, ease: "easeInOut" },
  },
  scan: { rotate: -30, transition: { duration: 0.4 } },
  stamp: { rotate: -20, transition: { duration: 0.3 } },
  point: { rotate: -45, transition: { duration: 0.4 } },
};

export const armRightVariants: Variants = {
  idle: { rotate: 0 },
  wave: { rotate: 0 },
  scan: { rotate: 25, transition: { duration: 0.4 } },
  stamp: { rotate: 30, transition: { duration: 0.3 } },
  point: { rotate: 0 },
};

export const eyeVariants: Variants = {
  neutral: { scaleY: 1 },
  happy: { scaleY: 0.6 },
  alert: { scaleY: 1.2, scaleX: 1.1 },
  thinking: { x: 2, scaleY: 1 },
  wink: { scaleY: 0.1 },
};

export const browVariants: Variants = {
  neutral: { y: 0, rotate: 0 },
  happy: { y: 1, rotate: 0 },
  alert: { y: -2, rotate: -5 },
  thinking: { y: -1, rotate: 8 },
  wink: { y: 0, rotate: 0 },
};

export const mouthPaths: Record<string, string> = {
  neutral: "M 8,0 Q 12,2 16,0",
  happy: "M 6,0 Q 12,6 18,0",
  alert: "M 8,2 Q 12,-1 16,2",
  thinking: "M 9,1 Q 12,0 15,1",
  wink: "M 6,0 Q 12,5 18,0",
};

export const compassVariants: Variants = {
  idle: {
    rotate: [0, 360],
    transition: { duration: 8, repeat: Infinity, ease: "linear" },
  },
  scanning: {
    rotate: [0, 360],
    transition: { duration: 2, repeat: Infinity, ease: "linear" },
  },
  alert: {
    rotate: [0, 30, -30, 15, -15, 0],
    transition: { duration: 0.6, repeat: 2 },
  },
};

export const badgeScrollVariants: Variants = {
  animate: {
    x: [0, -80],
    transition: { duration: 4, repeat: Infinity, ease: "linear" },
  },
};

export const stateColors: Record<string, string> = {
  offline: "#8a8278",
  online: "#6b8f71",
  scanning: "#d4a847",
  alert: "#c85a2a",
  presenting: "#5b8fa8",
};
