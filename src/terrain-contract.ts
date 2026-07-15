/*
 * The HuntIntel Terrain API contract is authoritative in
 * /workspaces/huntintel-terrain-api/docs/terrain_client_contract.md
 */

export interface TerrainAnalysisRequest {
  jobId?: string;
  userId?: string;
  propertyId?: string;
  analysisMode:
    | "whitetail"
    | "turkey"
    | "elk"
    | "wild_hog"
    | "search_and_rescue"
    | "military_terrain";
  species?: "whitetail" | "turkey" | "elk" | "wild_hog" | null;
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
  analysisMode?: TerrainAnalysisRequest["analysisMode"];
  species?: TerrainAnalysisRequest["species"];
  persisted: boolean;
  status: "complete" | "processing" | "error";
  summary: TerrainSummary;
  features: TerrainFeature[];
  relationships: TerrainRelationship[];
  waypoints: TerrainWaypoint[];
  report: TerrainReport;
  persistenceWarning?: string;
}

export interface TerrainAnalysisLibraryItem {
  analysisJobId: string;
  name: string;
  analysisMode: TerrainAnalysisRequest["analysisMode"];
  acreage: number | null;
  status: string;
  createdAt: string;
  completedAt: string | null;
  mapPreview: TerrainAnalysisRequest["polygon"] | null;
  topFinding: string | null;
  waypointCount: number;
  accessRole: "owner" | "coordinator" | "contributor" | "viewer";
  offlineAvailable: false;
}

export interface TerrainAnalysisLibraryPage {
  items: TerrainAnalysisLibraryItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface TerrainPdfExportOptions { includeFieldNotes?: boolean; includeAttachments?: boolean; includeBreadcrumbs?: boolean; }
export interface TerrainPdfExportArtifact { exportId:string; analysisJobId:string; status:"generating"|"ready"|"failed"|"delete_pending"; filename:string; schemaVersion:number; templateVersion:string; brandingVersion:string; sizeBytes:number|null; checksum:string|null; generatedAt:string|null; errorCode:string|null; accessRole:"owner"|"coordinator"|"contributor"|"viewer"; }
