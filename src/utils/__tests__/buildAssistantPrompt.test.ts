import { describe, it, expect } from "vitest";
import { buildAssistantPrompt } from "../buildAssistantPrompt";
import type { Pattern } from "../../types";

describe("buildAssistantPrompt", () => {
  it("includes pattern ids, controls, and snippets", () => {
    const p1: Pattern = {
      id: "layer-basics",
      name: "Layer Basics",
      category: "layers",
      description: "Fundamentals.",
      controls: [
        {
          id: "opacity",
          label: "Opacity",
          type: "slider",
          defaultValue: 0.5,
          min: 0,
          max: 1,
          step: 0.1,
        },
      ],
      setup() {},
      cleanup() {},
      update() {},
      snippet: "console.log('layer basics');",
    };

    const prompt = buildAssistantPrompt([p1], {
      "layer-basics": { opacity: 0.9 },
    });

    expect(prompt).toContain("Layer Basics (layer-basics)");
    expect(prompt).toContain('"opacity": 0.9');
    expect(prompt).toContain("console.log('layer basics');");
  });
});

