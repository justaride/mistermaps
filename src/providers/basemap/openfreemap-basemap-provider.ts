import type { Theme } from "../../types";
import type { BasemapProvider } from "../types";

const OPENFREEMAP_STYLES: Record<Theme, string> = {
  light: "https://tiles.openfreemap.org/styles/bright",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

export class OpenFreeMapBasemapProvider implements BasemapProvider<string> {
  readonly id = "openfreemap";

  getStyle(theme: Theme): string {
    return OPENFREEMAP_STYLES[theme];
  }
}
