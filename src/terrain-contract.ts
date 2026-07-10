/*
 * The HuntIntel Terrain API contract is authoritative in
 * /workspaces/huntintel-terrain-api/docs/terrain_client_contract.md
 */

export interface TerrainAnalysisRequest {
  jobId?: string;
  userId?: string;
  propertyId?: string;
  species: "whitetail";
  saveResults?: boolean;
  polygon: {
    type: "Polygon";
    coordinates: number[][][];
  };
}

export interface TerrainFeature {
  id: string;
  featureType: string;
  score: number;
  confidence: number;
  explanation?: string;
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: Record<string, unknown>;
}

export interface TerrainRelationship {
  id: string;
  relationshipType: string;
  sourceFeatureId: string;
  targetFeatureId: string;
  distanceYards?: number;
  score?: number;
  confidence?: number;
  reason?: string;
  properties?: Record<string, unknown>;
}

export interface TerrainWaypoint {
  id: string;
  sourceFeatureId: string;
  waypointType: string;
  title: string;
  score: number;
  confidence: number;
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  reason?: string;
  notes?: string[];
  properties?: Record<string, unknown>;
}

export interface TerrainReport {
  title: string;
  overview: string;
  keyFindings: string[];
  topWaypoints: Array<Record<string, unknown>>;
  terrainDefinitions: Array<Record<string, unknown>>;
  scoutingNotes: string[];
  limitations: string[];
}

export interface TerrainSummary {
  approximateAcreage?: number;
  demSource?: string;
  featureCount?: number;
  relationshipCount?: number;
  waypointCount?: number;
  topFeatureType?: string | null;
  topWaypointType?: string | null;
  [key: string]: unknown;
}

export interface TerrainAnalysisResponse {
  jobId: string;
  analysisJobId: string | null;
  persisted: boolean;
  status: "complete" | "processing" | "error";
  summary: TerrainSummary;
  features: TerrainFeature[];
  relationships: TerrainRelationship[];
  waypoints: TerrainWaypoint[];
  report: TerrainReport;
  persistenceWarning?: string;
}
