import { MapboxBasemapProvider } from "./mapbox-basemap-provider";
import { OpenFreeMapBasemapProvider } from "./openfreemap-basemap-provider";

export const mapboxBasemapProvider = new MapboxBasemapProvider();
export const openFreeMapBasemapProvider = new OpenFreeMapBasemapProvider();

export { MapboxBasemapProvider, OpenFreeMapBasemapProvider };
