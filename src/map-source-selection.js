function analysisId(value) {
  return typeof value?.analysisJobId === "string" && value.analysisJobId.trim()
    ? value.analysisJobId
    : null;
}

export function hasMatchingOfflineMap(offlineManifest, analysis) {
  const offlineAnalysisId = analysisId(offlineManifest);
  const selectedAnalysisId = analysisId(analysis);
  return Boolean(offlineAnalysisId && selectedAnalysisId && offlineAnalysisId === selectedAnalysisId);
}

export function selectTerrainMapSource({ offlineManifest, analysis, buildOnline, buildOffline } = {}) {
  if (typeof buildOnline !== "function" || typeof buildOffline !== "function") {
    throw new TypeError("MAP_SOURCE_BUILDERS_REQUIRED");
  }
  const usingOfflinePackage = hasMatchingOfflineMap(offlineManifest, analysis);
  return {
    usingOfflinePackage,
    sourceResult: usingOfflinePackage ? buildOffline(offlineManifest) : buildOnline(),
  };
}
