import { accessToken } from "./auth";
import { queueOfflineOperation } from "./offline";

const baseUrl = (process.env.EXPO_PUBLIC_TERRAIN_API_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");

export async function request(path, options = {}) {
  const token = await accessToken();
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Terrain API request failed.");
  }

  return payload;
}

export function accountRequest(path, body, method = "POST") { return request(`/api/account${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body) }); }
export function fetchAccount() { return request("/api/account/session"); }

export function createAnalysis(input) {
  return request("/api/terrain/analyses", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchAnalyses(page = 1, pageSize = 20) {
  return request(`/api/terrain/analyses?page=${encodeURIComponent(page)}&pageSize=${encodeURIComponent(pageSize)}`);
}

export async function fetchAnalysis(analysisJobId) {
  const encodedId = encodeURIComponent(analysisJobId);
  const base = await request(`/api/terrain/analyses/${encodedId}`);
  const resolvedId = base.analysisJobId || analysisJobId;
  const encodedResolvedId = encodeURIComponent(resolvedId);
  const [features, relationships, waypoints, report] = await Promise.all([
    request(`/api/terrain/analyses/${encodedResolvedId}/features`),
    request(`/api/terrain/analyses/${encodedResolvedId}/relationships`),
    request(`/api/terrain/analyses/${encodedResolvedId}/waypoints`),
    request(`/api/terrain/analyses/${encodedResolvedId}/report`),
  ]);
  return { ...base, analysisJobId: resolvedId, features: features.features || [], relationships: relationships.relationships || [], waypoints: waypoints.waypoints || [], report: report.report || base.report || {} };
}

export const fetchAnalysisNotes = (id) => request(`/api/terrain/analyses/${encodeURIComponent(id)}/notes?page=1&pageSize=100`);
export const createAnalysisNote = async (id, body) => { try { return await request(`/api/terrain/analyses/${encodeURIComponent(id)}/notes`, { method: "POST", body: JSON.stringify({ body }) }); } catch (error) { if (!(error instanceof TypeError)) throw error; return { queued: true, pendingCount: await queueOfflineOperation(id, "note.create", { body }) }; } };
export const updateAnalysisNote = (id, noteId, body) => request(`/api/terrain/analyses/${encodeURIComponent(id)}/notes/${encodeURIComponent(noteId)}`, { method: "PATCH", body: JSON.stringify({ body }) });
export const deleteAnalysisNote = (id, noteId) => request(`/api/terrain/analyses/${encodeURIComponent(id)}/notes/${encodeURIComponent(noteId)}`, { method: "DELETE" });
export const fetchWaypointFieldData = (id, waypointId) => request(`/api/terrain/analyses/${encodeURIComponent(id)}/waypoints/${encodeURIComponent(waypointId)}/field-data`);
export const saveWaypointFieldData = async (id, waypointId, value) => { try { return await request(`/api/terrain/analyses/${encodeURIComponent(id)}/waypoints/${encodeURIComponent(waypointId)}/field-data`, { method: "PUT", body: JSON.stringify(value) }); } catch (error) { if (!(error instanceof TypeError)) throw error; return { queued: true, pendingCount: await queueOfflineOperation(id, "waypoint.put", { waypointId, value }) }; } };
export const fetchAttachments = (id) => request(`/api/terrain/analyses/${encodeURIComponent(id)}/attachments?page=1&pageSize=100`);
export const createAttachmentUpload = (id, value) => request(`/api/terrain/analyses/${encodeURIComponent(id)}/attachments/uploads`, { method: "POST", body: JSON.stringify(value) });
export const finalizeAttachment = (id, attachmentId, value) => request(`/api/terrain/analyses/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}/finalize`, { method: "POST", body: JSON.stringify(value) });
export const deleteAttachment = (id, attachmentId) => request(`/api/terrain/analyses/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`, { method: "DELETE" });
export const fetchAttachmentDownload = (id, attachmentId) => request(`/api/terrain/analyses/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}/download`);
export const fetchStorageQuota = () => request("/api/storage/quota");
export const fetchOfflineManifest = (id, attachmentIds = []) => request(`/api/terrain/analyses/${encodeURIComponent(id)}/offline/manifest?attachments=${encodeURIComponent(attachmentIds.join(","))}`);
export const pushOfflineSync = (id, operations) => request(`/api/terrain/analyses/${encodeURIComponent(id)}/offline/sync`, { method: "POST", body: JSON.stringify({ operations }) });
export const pullOfflineSync = (id, cursor = 0) => request(`/api/terrain/analyses/${encodeURIComponent(id)}/offline/sync?cursor=${encodeURIComponent(cursor)}`);

export { baseUrl as terrainApiBaseUrl };
