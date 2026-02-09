import { useState } from "react";
import type { ControlConfig } from "../types";
import styles from "./ControlsPanel.module.css";

type Props = {
  controls: ControlConfig[];
  values: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
  onViewCode: () => void;
};

export function ControlsPanel({
  controls,
  values,
  onChange,
  onViewCode,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  if (controls.length === 0) {
    return null;
  }

  return (
    <div
      className={`panel ${styles.panel} ${collapsed ? styles.collapsed : ""}`}
    >
      <div className={styles.header}>
        <h3 className={styles.title}>Controls</h3>
        <button
          className="secondary"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? "+" : "-"}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className={styles.controls}>
            {controls.map((control) => (
              <div key={control.id} className={styles.control}>
                {control.type !== "button" && (
                  <label htmlFor={control.id}>{control.label}</label>
                )}
                {renderControl(control, values[control.id], onChange)}
              </div>
            ))}
          </div>
          <button className={styles.codeButton} onClick={onViewCode}>
            View Code
          </button>
        </>
      )}
    </div>
  );
}

function renderControl(
  config: ControlConfig,
  value: unknown,
  onChange: (id: string, value: unknown) => void,
) {
  switch (config.type) {
    case "text":
      return (
        <input
          type="text"
          id={config.id}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(config.id, e.target.value)}
          className={styles.textInput}
        />
      );

    case "textarea":
      return (
        <textarea
          id={config.id}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(config.id, e.target.value)}
          className={`${styles.textInput} ${styles.textarea}`}
          rows={7}
          spellCheck={false}
        />
      );

    case "button":
      return (
        <button
          type="button"
          className="secondary"
          onClick={() => onChange(config.id, Date.now())}
        >
          {config.label}
        </button>
      );

    case "slider":
      return (
        <div className={styles.sliderWrapper}>
          <input
            type="range"
            id={config.id}
            min={config.min}
            max={config.max}
            step={config.step}
            value={value as number}
            onChange={(e) => onChange(config.id, parseFloat(e.target.value))}
          />
          <span className={styles.sliderValue}>{value as number}</span>
        </div>
      );

    case "toggle":
      return (
        <label className={styles.toggle}>
          <input
            type="checkbox"
            id={config.id}
            checked={value as boolean}
            onChange={(e) => onChange(config.id, e.target.checked)}
          />
          <span className={styles.toggleSlider} />
        </label>
      );

    case "select":
      return (
        <select
          id={config.id}
          value={value as string}
          onChange={(e) => onChange(config.id, e.target.value)}
        >
          {config.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );

    case "color":
      return (
        <input
          type="color"
          id={config.id}
          value={value as string}
          onChange={(e) => onChange(config.id, e.target.value)}
          className={styles.colorInput}
        />
      );

    default:
      return null;
  }
}
