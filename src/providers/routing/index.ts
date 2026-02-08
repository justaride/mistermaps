import { MapboxRoutingProvider } from "./mapbox-routing-provider";
import { OSRMRoutingProvider } from "./osrm-routing-provider";
import { ValhallaRoutingProvider } from "./valhalla-routing-provider";
import { createRoutingService, type RoutingService } from "./create-routing-service";

export const mapboxRoutingProvider = new MapboxRoutingProvider();
export const osrmRoutingProvider = new OSRMRoutingProvider();
export const valhallaRoutingProvider = new ValhallaRoutingProvider();

export { 
  MapboxRoutingProvider, 
  OSRMRoutingProvider, 
  ValhallaRoutingProvider,
  createRoutingService,
  type RoutingService 
};
