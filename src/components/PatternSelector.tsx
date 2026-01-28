import type { PatternId, Pattern } from "../types";
import styles from "./PatternSelector.module.css";

type Props = {
  patterns: Pattern[];
  activePattern: PatternId;
  onSelect: (id: PatternId) => void;
};

const CATEGORY_LABELS: Record<string, string> = {
  "data-viz": "Data Visualization",
  navigation: "Navigation",
  markers: "Markers",
  layers: "Layers",
};

export function PatternSelector({ patterns, activePattern, onSelect }: Props) {
  const grouped = patterns.reduce(
    (acc, pattern) => {
      if (!acc[pattern.category]) {
        acc[pattern.category] = [];
      }
      acc[pattern.category].push(pattern);
      return acc;
    },
    {} as Record<string, Pattern[]>,
  );

  return (
    <div className={`panel ${styles.selector}`}>
      <select
        value={activePattern}
        onChange={(e) => onSelect(e.target.value as PatternId)}
        className={styles.select}
      >
        {Object.entries(grouped).map(([category, categoryPatterns]) => (
          <optgroup key={category} label={CATEGORY_LABELS[category]}>
            {categoryPatterns.map((pattern) => (
              <option key={pattern.id} value={pattern.id}>
                {pattern.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <p className={styles.description}>
        {patterns.find((p) => p.id === activePattern)?.description}
      </p>
    </div>
  );
}
