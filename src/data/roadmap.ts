import type { RoadmapItem } from "../types/roadmap";
import {
  ROADMAP_CATEGORY_ORDER,
  IMPLEMENTED_ROADMAP_ITEMS_DATA,
  PLANNED_ROADMAP_ITEMS_DATA,
} from "./roadmap.data";
import { validateRoadmapItems } from "./validation";

export { ROADMAP_CATEGORY_ORDER };

export const IMPLEMENTED_ROADMAP_ITEMS: RoadmapItem[] = validateRoadmapItems(
  IMPLEMENTED_ROADMAP_ITEMS_DATA,
  "IMPLEMENTED_ROADMAP_ITEMS",
);

export const PLANNED_ROADMAP_ITEMS: RoadmapItem[] = validateRoadmapItems(
  PLANNED_ROADMAP_ITEMS_DATA,
  "PLANNED_ROADMAP_ITEMS",
);

export const ROADMAP_ITEMS: RoadmapItem[] = validateRoadmapItems(
  [...IMPLEMENTED_ROADMAP_ITEMS, ...PLANNED_ROADMAP_ITEMS],
  "ROADMAP_ITEMS",
);
