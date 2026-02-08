import type { Theme } from "../../types";
import type { BasemapProvider } from "../types";

const MAPBOX_STYLES: Record<Theme, string> = {
  light: "mapbox://styles/mapbox/light-v11",
  dark: "mapbox://styles/mapbox/dark-v11",
};

export class MapboxBasemapProvider implements BasemapProvider<string> {
  readonly id = "mapbox";

  getStyle(theme: Theme): string {
    return MAPBOX_STYLES[theme];
  }
}
