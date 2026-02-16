import type { ControlValues, Pattern, PatternId } from "../types";

function stableJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? "";
  } catch {
    return String(value);
  }
}

export function buildAssistantPrompt(
  enabledPatterns: Pattern[],
  controlValuesByPattern: Partial<Record<PatternId, ControlValues>>,
): string {
  const header = [
    "You are helping implement a Mapbox GL JS map in a React + TypeScript (Vite) project.",
    "Goal: combine multiple map features into ONE map instance with a clean, composable structure.",
    "",
    "Requirements:",
    "- Use unique, namespaced source/layer IDs per feature to avoid collisions.",
    "- Add/remove map event handlers safely (store handler refs; cleanup on unmount).",
    "- Support re-running setup on style reload (theme switch via map.setStyle).",
    "- Prefer feature modules: setup(map), update(map, controls), cleanup(map).",
    "",
    "Selected features (patterns) and their current controls/snippets are below.",
  ].join("\n");

  const blocks = enabledPatterns.map((pattern) => {
    const controls = controlValuesByPattern[pattern.id] ?? {};
    return [
      "",
      `## Pattern: ${pattern.name} (${pattern.id})`,
      pattern.description ? `Description: ${pattern.description}` : "",
      "",
      "Controls:",
      "```json",
      stableJson(controls),
      "```",
      "",
      "Snippet:",
      "```ts",
      pattern.snippet.trimEnd(),
      "```",
    ]
      .filter(Boolean)
      .join("\n");
  });

  const footer = [
    "",
    "Task:",
    "1) Propose a small file structure (components + feature modules).",
    "2) Generate the concrete TypeScript code needed to implement these features together.",
    "3) Call out any conflicts (shared click handlers, draw tools) and how you resolved them.",
  ].join("\n");

  return [header, ...blocks, footer].join("\n");
}
