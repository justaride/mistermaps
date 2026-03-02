import { MapboxRoutingProvider } from "./mapbox-routing-provider";
import { MapboxMapMatchingProvider } from "./mapbox-map-matching-provider";
import { OSRMRoutingProvider } from "./osrm-routing-provider";
import { ValhallaRoutingProvider } from "./valhalla-routing-provider";
import { createRoutingService, type RoutingService } from "./create-routing-service";

export const mapboxRoutingProvider = new MapboxRoutingProvider();
export const mapboxMapMatchingProvider = new MapboxMapMatchingProvider();
export const osrmRoutingProvider = new OSRMRoutingProvider();
export const valhallaRoutingProvider = new ValhallaRoutingProvider();

export { 
  MapboxRoutingProvider, 
  MapboxMapMatchingProvider,
  OSRMRoutingProvider, 
  ValhallaRoutingProvider,
  createRoutingService,
  type RoutingService 
};
