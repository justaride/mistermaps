export type RoadmapStatus = "implemented" | "planned";

export type RoadmapArtifact = "pattern" | "provider" | "project";

export type RoadmapEngineSupport = {
  mapbox: boolean;
  maplibre: boolean;
};

export type RoadmapDependencies = {
  api?: string[];
  tokenRequired?: boolean;
  notes?: string;
};

export type RoadmapLinks = {
  demoPath?: string;
};

export type RoadmapItem = {
  id: string;
  name: string;
  artifact: RoadmapArtifact;
  status: RoadmapStatus;
  category: string;
  tags: string[];
  engineSupport: RoadmapEngineSupport;
  dependencies: RoadmapDependencies;
  links?: RoadmapLinks;
  description: string;
  acceptanceCriteria: string[];
};

