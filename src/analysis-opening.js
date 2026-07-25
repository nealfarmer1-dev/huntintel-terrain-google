export function validAnalysisBoundary(value) {
  const ring = value?.type === "Polygon" ? value.coordinates?.[0] : null;
  if (!Array.isArray(ring) || ring.length < 4) return false;
  if (!ring.every((point) => Array.isArray(point) && point.length >= 2 && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])) && Number(point[0]) >= -180 && Number(point[0]) <= 180 && Number(point[1]) >= -90 && Number(point[1]) <= 90)) return false;
  const first = ring[0]; const last = ring.at(-1);
  return Number(first[0]) === Number(last[0]) && Number(first[1]) === Number(last[1]);
}

export function withAnalysisBoundary(payload, fallbackBoundary = null) {
  const requestPolygon = validAnalysisBoundary(payload?.requestPolygon) ? payload.requestPolygon : fallbackBoundary;
  if (!validAnalysisBoundary(requestPolygon)) {
    const error = new Error("The saved analysis boundary is unavailable.");
    error.code = "ANALYSIS_BOUNDARY_MISSING";
    throw error;
  }
  return { ...payload, requestPolygon };
}

export function requireOpenedAnalysis(payload, requestedAnalysisJobId) {
  if (!payload || payload.analysisJobId !== requestedAnalysisJobId) {
    const error = new Error("Opened analysis did not match the requested analysis.");
    error.code = "ANALYSIS_ID_MISMATCH";
    throw error;
  }
  return withAnalysisBoundary(payload);
}
