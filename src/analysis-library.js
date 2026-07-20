export const ANALYSIS_LIBRARY_LIMIT = 150;
export const ANALYSIS_LIMIT_CODE = "ANALYSIS_LIBRARY_LIMIT_REACHED";
export const ANALYSIS_LIMIT_TITLE = "You've reached your limit of 150 saved analyses.";
export const ANALYSIS_LIMIT_MESSAGE = "Delete one or more analyses from My Analyses to save another.";

export function removeDeletedAnalyses(library, deletedIds, ownedTotal) {
  if (!library) return library;
  const removed = new Set(deletedIds), total = Math.max(0, Number(library.total || 0) - removed.size), pageSize = Number(library.pageSize || 20);
  return { ...library, items: (library.items || []).filter((item) => !removed.has(item.analysisJobId)), total, ownedTotal: Number(ownedTotal), limit: ANALYSIS_LIBRARY_LIMIT, totalPages: Math.ceil(total / pageSize) };
}
