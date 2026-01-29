import { motion, AnimatePresence } from "framer-motion";
import type { MascotState } from "./types";
import { stateColors } from "./mrMapsVariants";

type SpeechBubbleProps = {
  message: string;
  state?: MascotState;
  visible?: boolean;
};

export function SpeechBubble({
  message,
  state = "online",
  visible = true,
}: SpeechBubbleProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.9 }}
          className="relative border-2 border-border bg-card px-4 py-2 font-mono text-sm"
          style={{ boxShadow: "3px 3px 0 var(--color-border)" }}
        >
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: stateColors[state] }}
            />
            <TypewriterText text={message} />
          </div>
          <div
            className="absolute -bottom-2 left-6 h-0 w-0"
            style={{
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: "8px solid var(--color-border)",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TypewriterText({ text }: { text: string }) {
  return (
    <motion.span
      key={text}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {text}
    </motion.span>
  );
}
