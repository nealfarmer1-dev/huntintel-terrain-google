export function requireOpenedAnalysis(payload, requestedAnalysisJobId) {
  if (!payload || payload.analysisJobId !== requestedAnalysisJobId) {
    const error = new Error("Opened analysis did not match the requested analysis.");
    error.code = "ANALYSIS_ID_MISMATCH";
    throw error;
  }
  return payload;
}
