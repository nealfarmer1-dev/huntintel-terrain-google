const GROUPS = [
  { id: "travel", label: "Funnels & Travel Corridors", tokens: ["funnel", "pinch", "corridor", "travel", "draw", "crossing"] },
  { id: "bedding", label: "Bedding-related Terrain", tokens: ["bed", "bedding", "thermal"] },
  { id: "ridges", label: "Ridges, Saddles & Benches", tokens: ["ridge", "saddle", "bench", "spur", "knob", "hill"] },
  { id: "water", label: "Water-related Features", tokens: ["water", "creek", "stream", "river", "drain", "pond", "wet"] },
  { id: "feeding", label: "Feeding & Staging Areas", tokens: ["feed", "food", "staging", "field", "opening"] },
  { id: "access", label: "Access, Wind & Pressure", tokens: ["access", "wind", "pressure", "road", "trail", "route"] },
  { id: "other", label: "Other", tokens: [] },
];

export const RESULT_TABS = Object.freeze(["waypoints", "features", "navigation", "records"]);

export function requireAnalysisJobId(payload, requestedAnalysisJobId, label = "Analysis payload") {
  if (!payload || payload.analysisJobId !== requestedAnalysisJobId) {
    const error = new Error(`${label} did not match the requested analysis.`);
    error.code = "ANALYSIS_ID_MISMATCH";
    throw error;
  }
  return payload;
}

function finite(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function validPointCoordinates(value) {
  return Array.isArray(value) && value.length >= 2 && finite(value[0]) !== null && finite(value[1]) !== null
    && Number(value[0]) >= -180 && Number(value[0]) <= 180 && Number(value[1]) >= -90 && Number(value[1]) <= 90;
}

export function validGeometry(value) {
  if (!value || typeof value !== "object") return false;
  if (value.type === "Point") return validPointCoordinates(value.coordinates);
  if (value.type === "LineString") return Array.isArray(value.coordinates) && value.coordinates.length >= 2 && value.coordinates.every(validPointCoordinates);
  if (value.type === "Polygon") return Array.isArray(value.coordinates) && value.coordinates.length > 0 && value.coordinates.every((ring) => Array.isArray(ring) && ring.length >= 4 && ring.every(validPointCoordinates));
  if (value.type === "MultiPoint") return Array.isArray(value.coordinates) && value.coordinates.length > 0 && value.coordinates.every(validPointCoordinates);
  if (value.type === "MultiLineString") return Array.isArray(value.coordinates) && value.coordinates.length > 0 && value.coordinates.every((line) => Array.isArray(line) && line.length >= 2 && line.every(validPointCoordinates));
  if (value.type === "MultiPolygon") return Array.isArray(value.coordinates) && value.coordinates.length > 0 && value.coordinates.every((polygon) => Array.isArray(polygon) && polygon.length > 0 && polygon.every((ring) => Array.isArray(ring) && ring.length >= 4 && ring.every(validPointCoordinates)));
  return false;
}

export function entityGeometry(entity) {
  if (validGeometry(entity?.geometry)) return entity.geometry;
  const longitude = finite(entity?.longitude ?? entity?.properties?.longitude);
  const latitude = finite(entity?.latitude ?? entity?.properties?.latitude);
  return validPointCoordinates([longitude, latitude]) ? { type: "Point", coordinates: [longitude, latitude] } : null;
}

export function navigationTarget(entity) {
  const geometry = entityGeometry(entity);
  return geometry?.type === "Point" ? { id: String(entity.id), longitude: geometry.coordinates[0], latitude: geometry.coordinates[1] } : null;
}

export function featureGroup(feature) {
  const value = String(feature?.featureType || feature?.properties?.definitionKey || "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return GROUPS.find((group) => group.id !== "other" && group.tokens.some((token) => value.includes(token))) || GROUPS.at(-1);
}

export function groupTerrainFeatures(features = []) {
  const buckets = new Map(GROUPS.map((group) => [group.id, { id: group.id, label: group.label, items: [] }]));
  features.forEach((feature, sourceIndex) => {
    if (!feature?.id) return;
    buckets.get(featureGroup(feature).id).items.push({ ...feature, sourceIndex });
  });
  return [...buckets.values()].filter((group) => group.items.length > 0);
}

function ranked(items, sort = "score") {
  return items.map((item, sourceIndex) => ({ item, sourceIndex })).sort((left, right) => {
    const a = left.item; const b = right.item;
    if (sort === "type") {
      const byType = String(a.featureType || a.waypointType || "").localeCompare(String(b.featureType || b.waypointType || ""));
      if (byType) return byType;
    }
    if (sort === "confidence") {
      const byConfidence = (finite(b.confidence) ?? -Infinity) - (finite(a.confidence) ?? -Infinity);
      if (byConfidence) return byConfidence;
    }
    const explicitPriority = (finite(a.priority ?? a.properties?.priority) ?? Infinity) - (finite(b.priority ?? b.properties?.priority) ?? Infinity);
    if (explicitPriority) return explicitPriority;
    const byScore = (finite(b.score) ?? -Infinity) - (finite(a.score) ?? -Infinity);
    if (byScore) return byScore;
    const byConfidence = (finite(b.confidence) ?? -Infinity) - (finite(a.confidence) ?? -Infinity);
    return byConfidence || left.sourceIndex - right.sourceIndex;
  }).map(({ item }) => item);
}

export function sortResultEntities(items = [], sort = "score") {
  return ranked(items.filter((item) => item?.id), sort);
}

export function relatedWaypointIds(featureId, waypoints = []) {
  if (!featureId) return [];
  return waypoints.filter((waypoint) => waypoint?.id && waypoint.sourceFeatureId === featureId).map((waypoint) => waypoint.id);
}

/** @param {string | null} [analysisJobId] */
export function createResultsState(analysisJobId = null) {
  return {
    analysisJobId,
    activeResultsTab: "waypoints",
    selectedEntityType: null,
    selectedEntityId: null,
    activeCategoryFilter: null,
    expandedFeatureGroups: [],
    waypointSort: "score",
    featureSort: "score",
    waypointLimit: 20,
  };
}

export function stateForAnalysis(current, analysisJobId) {
  return current?.analysisJobId === analysisJobId ? current : createResultsState(analysisJobId);
}

export function selectedEntity(state, analysis) {
  if (!state || state.analysisJobId !== analysis?.analysisJobId || !state.selectedEntityId) return null;
  const items = state.selectedEntityType === "waypoint" ? analysis.waypoints : state.selectedEntityType === "terrainFeature" ? analysis.features : [];
  return (items || []).find((item) => item?.id === state.selectedEntityId) || null;
}

export function selectEntity(state, analysis, type, id) {
  const items = type === "waypoint" ? analysis?.waypoints : type === "terrainFeature" ? analysis?.features : [];
  const entity = (items || []).find((item) => item?.id === id);
  if (!entity || state?.analysisJobId !== analysis?.analysisJobId) {
    return { ...state, selectedEntityType: null, selectedEntityId: null };
  }
  const groupId = type === "terrainFeature" ? featureGroup(entity).id : null;
  const waypointLimit = type === "waypoint" ? Math.max(state.waypointLimit, (items || []).findIndex((item) => item?.id === id) + 1) : state.waypointLimit;
  return {
    ...state,
    activeResultsTab: type === "waypoint" ? "waypoints" : "features",
    selectedEntityType: type,
    selectedEntityId: id,
    waypointLimit,
    expandedFeatureGroups: groupId && !state.expandedFeatureGroups.includes(groupId) ? [...state.expandedFeatureGroups, groupId] : state.expandedFeatureGroups,
  };
}
