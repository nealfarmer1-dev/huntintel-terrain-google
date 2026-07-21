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

export type TerrainGeometry =
  | { type: "Point"; coordinates: [number, number] }
  | { type: "LineString"; coordinates: [number, number][] }
  | { type: "Polygon"; coordinates: [number, number][][] }
  | { type: "MultiPoint"; coordinates: [number, number][] }
  | { type: "MultiLineString"; coordinates: [number, number][][] }
  | { type: "MultiPolygon"; coordinates: [number, number][][][] };

export interface TerrainFeature {
  id: string;
  featureType: string;
  score: number;
  confidence: number;
  explanation?: string;
  geometry?: TerrainGeometry;
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
  geometry?: TerrainGeometry;
  reason?: string;
  notes?: string[];
  properties?: Record<string, unknown>;
}

export interface TerrainReport {
  title: string;
  overview: string;
  keyFindings: string[];
  huntingStrategy?: string | string[];
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
  analysisName?: string;
  createdAt?: string;
  completedAt?: string | null;
  requestPolygon?: TerrainAnalysisRequest["polygon"] | null;
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
export type TerrainAnalysisPackageKey="standard_analysis"|"large_analysis";
export type TerrainPaymentProvider="development_bypass"|"stripe"|"apple_iap"|"google_play";
export interface TerrainAnalysisDraft {draftId:string;analysisName:string|null;analysisMode:TerrainAnalysisRequest["analysisMode"];propertyId:string|null;requestPolygon:TerrainAnalysisRequest["polygon"];acreage:number;tierKey:TerrainAnalysisPackageKey;amountMinor:999|1499;currency:"USD";status:string;analysisJobId:string|null;failureCode:string|null;}
export interface TerrainPaymentQuote {quoteId:string;draftId:string;acreage:number;tierKey:TerrainAnalysisPackageKey;label:string;amountMinor:999|1499;currency:"USD";displayPrice:string;expiresAt:string;provider:TerrainPaymentProvider;providerProductId:string|null;}
