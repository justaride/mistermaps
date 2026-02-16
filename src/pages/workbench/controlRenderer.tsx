import type { ControlConfig, ControlValue, PatternId } from "../../types";
import styles from "../Workbench.module.css";

export function controlDomId(patternId: PatternId, controlId: string): string {
  return `${patternId}__${controlId}`;
}

export function renderControlInline(
  patternId: PatternId,
  config: ControlConfig,
  value: ControlValue | undefined,
  onChange: (controlId: string, value: ControlValue) => void,
) {
  const id = controlDomId(patternId, config.id);

  switch (config.type) {
    case "text": {
      const textValue = typeof value === "string" ? value : config.defaultValue;
      return (
        <input
          type="text"
          id={id}
          value={textValue}
          onChange={(e) => onChange(config.id, e.target.value)}
          className={styles.textInput}
        />
      );
    }

    case "textarea": {
      const textValue = typeof value === "string" ? value : config.defaultValue;
      return (
        <textarea
          id={id}
          value={textValue}
          onChange={(e) => onChange(config.id, e.target.value)}
          className={`${styles.textInput} ${styles.textarea}`}
          rows={7}
          spellCheck={false}
        />
      );
    }

    case "button":
      return (
        <button
          type="button"
          className={`secondary ${styles.inlineButton}`}
          onClick={() => onChange(config.id, Date.now())}
        >
          {config.label}
        </button>
      );

    case "slider": {
      const sliderValue = typeof value === "number" ? value : config.defaultValue;
      return (
        <div className={styles.sliderRow}>
          <input
            type="range"
            id={id}
            min={config.min}
            max={config.max}
            step={config.step}
            value={sliderValue}
            onChange={(e) => onChange(config.id, parseFloat(e.target.value))}
          />
          <span className={styles.sliderValue}>{sliderValue}</span>
        </div>
      );
    }

    case "toggle": {
      const checked = typeof value === "boolean" ? value : config.defaultValue;
      return (
        <div className={styles.toggleRow}>
          <div className={styles.toggleLabel}>{config.label}</div>
          <label className={styles.toggle} aria-label={config.label}>
            <input
              type="checkbox"
              id={id}
              checked={checked}
              onChange={(e) => onChange(config.id, e.target.checked)}
            />
            <span className={styles.toggleSlider} />
          </label>
        </div>
      );
    }

    case "select": {
      const selectedValue =
        typeof value === "string" ? value : config.defaultValue;
      return (
        <select
          id={id}
          value={selectedValue}
          onChange={(e) => onChange(config.id, e.target.value)}
        >
          {config.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    case "color": {
      const colorValue = typeof value === "string" ? value : config.defaultValue;
      return (
        <input
          type="color"
          id={id}
          value={colorValue}
          onChange={(e) => onChange(config.id, e.target.value)}
          className={styles.colorInput}
        />
      );
    }

    default:
      return null;
  }
}
