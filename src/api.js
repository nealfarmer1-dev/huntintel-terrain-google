import { accessToken, clearSession } from "./auth";
import { queueOfflineOperation } from "./offline";

const baseUrl = (process.env.EXPO_PUBLIC_TERRAIN_API_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");

export async function request(path, options = {}) {
  const token = await accessToken();
  const { correlationId: suppliedCorrelationId, ...requestOptions } = options;
  const requestCorrelationId = suppliedCorrelationId || globalThis.crypto?.randomUUID?.() || `android-${Date.now()}`;
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "X-Correlation-ID": requestCorrelationId,
      ...(options.headers || {}),
    },
    ...requestOptions,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error=new Error(payload?.error?.message||"Terrain API request failed.");error.code=payload?.error?.code;error.details=payload?.error?.details;error.correlationId=response.headers?.get?.("X-Correlation-ID")||payload?.correlationId||requestCorrelationId;error.retryAfter=Number(response.headers?.get?.("Retry-After")||0)||null;if(response.status===401||error.code==="ACCOUNT_ACCESS_REVOKED")await clearSession();throw error;
  }

  return payload;
}

export function accountRequest(path, body, method = "POST") { return request(`/api/account${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body) }); }
export function fetchAccount() { return request("/api/account/session"); }
export const fetchFeatureFlags=()=>request("/api/terrain/features");
export const createSarObservationOffline=async(analysisId,sessionId,value)=>{try{return await createSarObservation(sessionId,value)}catch(error){if(!(error instanceof TypeError))throw error;return{queued:true,pendingCount:await queueOfflineOperation(analysisId,"sar.observation",{sessionId,...value})}}};export const updateSarAssignmentOffline=async(analysisId,sessionId,assignmentId,status)=>{try{return await updateSarAssignment(sessionId,assignmentId,status)}catch(error){if(!(error instanceof TypeError))throw error;return{queued:true,pendingCount:await queueOfflineOperation(analysisId,"sar.assignment.update",{sessionId,assignmentId,status})}}};
export const createSarAssignment=(id,value)=>request(`/api/terrain/sar-sessions/${encodeURIComponent(id)}/assignments`,{method:"POST",body:JSON.stringify(value)});export const updateSarAssignment=(id,assignmentId,status)=>request(`/api/terrain/sar-sessions/${encodeURIComponent(id)}/assignments/${encodeURIComponent(assignmentId)}`,{method:"PATCH",body:JSON.stringify({status})});
export const startSarSession=value=>request("/api/terrain/sar-sessions",{method:"POST",body:JSON.stringify({...value,safetyAcknowledged:true})});export const fetchActiveSarSession=(teamId,analysisJobId)=>request(`/api/terrain/sar-sessions/active?teamId=${encodeURIComponent(teamId)}&analysisJobId=${encodeURIComponent(analysisJobId)}`);export const fetchSarSession=id=>request(`/api/terrain/sar-sessions/${encodeURIComponent(id)}`);export const endSarSession=id=>request(`/api/terrain/sar-sessions/${encodeURIComponent(id)}/end`,{method:"POST",body:"{}"});export const startSarSharing=(id,backgroundAllowed=false)=>request(`/api/terrain/sar-sessions/${encodeURIComponent(id)}/sharing/start`,{method:"POST",body:JSON.stringify({optIn:true,backgroundAllowed})});export const stopSarSharing=id=>request(`/api/terrain/sar-sessions/${encodeURIComponent(id)}/sharing/stop`,{method:"POST",body:"{}"});export const publishSarPosition=(id,value)=>request(`/api/terrain/sar-sessions/${encodeURIComponent(id)}/positions`,{method:"POST",body:JSON.stringify(value)});export const fetchSarPositions=id=>request(`/api/terrain/sar-sessions/${encodeURIComponent(id)}/positions`);export const fetchSarEvents=(id,cursor=0)=>request(`/api/terrain/sar-sessions/${encodeURIComponent(id)}/events?cursor=${encodeURIComponent(cursor)}`);export const createSarObservation=(id,value)=>request(`/api/terrain/sar-sessions/${encodeURIComponent(id)}/observations`,{method:"POST",body:JSON.stringify(value)});
export const fetchTeams=()=>request("/api/terrain/teams");export const createTeam=v=>request("/api/terrain/teams",{method:"POST",body:JSON.stringify(v)});export const fetchTeamMembers=id=>request(`/api/terrain/teams/${encodeURIComponent(id)}/members`);export const fetchTeamInvitations=()=>request("/api/terrain/team-invitations");export const respondTeamInvitation=(id,d)=>request(`/api/terrain/team-invitations/${encodeURIComponent(id)}/${d}`,{method:"POST",body:"{}"});export const inviteTeamMember=(id,v)=>request(`/api/terrain/teams/${encodeURIComponent(id)}/invitations`,{method:"POST",body:JSON.stringify(v)});export const updateTeamMemberRole=(id,u,role)=>request(`/api/terrain/teams/${encodeURIComponent(id)}/members/${encodeURIComponent(u)}`,{method:"PATCH",body:JSON.stringify({role})});export const removeTeamMember=(id,u)=>request(`/api/terrain/teams/${encodeURIComponent(id)}/members/${encodeURIComponent(u)}`,{method:"DELETE"});export const shareAnalysisWithTeam=(id,a)=>request(`/api/terrain/teams/${encodeURIComponent(id)}/analyses/${encodeURIComponent(a)}`,{method:"POST",body:"{}"});export const revokeTeamAnalysis=(id,a)=>request(`/api/terrain/teams/${encodeURIComponent(id)}/analyses/${encodeURIComponent(a)}`,{method:"DELETE"});

export function createAnalysis(input) {
  return request("/api/terrain/analyses", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
export const createAnalysisDraft=input=>request("/api/terrain/analysis-drafts",{method:"POST",body:JSON.stringify({...input,platform:"android"})});
export const createPaymentAttempt=(id,input)=>request(`/api/terrain/analysis-drafts/${encodeURIComponent(id)}/payment-attempts`,{method:"POST",body:JSON.stringify({...input,platform:"android"})});
export const verifyPaymentAttempt=(id,attemptId,input)=>request(`/api/terrain/analysis-drafts/${encodeURIComponent(id)}/payment-attempts/${encodeURIComponent(attemptId)}/verify`,{method:"POST",body:JSON.stringify(input)});
export const reconcileAnalysisPurchase=id=>request(`/api/terrain/analysis-drafts/${encodeURIComponent(id)}/reconcile`,{method:"POST",body:"{}"});
export const submitPaidAnalysis=id=>request(`/api/terrain/analysis-drafts/${encodeURIComponent(id)}/analyze`,{method:"POST",body:"{}"});

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
export const fetchOfflineManifest = (id, attachmentIds = [], options = {}) => request(`/api/terrain/analyses/${encodeURIComponent(id)}/offline/manifest?attachments=${encodeURIComponent(attachmentIds.join(","))}&provider=${encodeURIComponent(options.provider || "")}&minZoom=${encodeURIComponent(options.minZoom || "")}&maxZoom=${encodeURIComponent(options.maxZoom || "")}`);
export const pushOfflineSync = (id, operations) => request(`/api/terrain/analyses/${encodeURIComponent(id)}/offline/sync`, { method: "POST", body: JSON.stringify({ operations }) });
export const pullOfflineSync = (id, cursor = 0) => request(`/api/terrain/analyses/${encodeURIComponent(id)}/offline/sync?cursor=${encodeURIComponent(cursor)}`);
export const fetchBreadcrumbs = (id) => request(`/api/terrain/analyses/${encodeURIComponent(id)}/breadcrumbs`);
export const createBreadcrumbRecord = (id, value) => request(`/api/terrain/analyses/${encodeURIComponent(id)}/breadcrumbs`, { method: "POST", body: JSON.stringify(value) });
export const updateBreadcrumbRecord = (id, breadcrumbId, value) => request(`/api/terrain/analyses/${encodeURIComponent(id)}/breadcrumbs/${encodeURIComponent(breadcrumbId)}`, { method: "PATCH", body: JSON.stringify(value) });
export const deleteBreadcrumbRecord = (id, breadcrumbId) => request(`/api/terrain/analyses/${encodeURIComponent(id)}/breadcrumbs/${encodeURIComponent(breadcrumbId)}`, { method: "DELETE" });
export const fetchMapConfig = () => request("/api/terrain/map-config");
export const fetchParcelOverlay = () => request("/api/terrain/maps/parcel-overlay");
export const fetchParcelDetail = (latitude,longitude,robustId) => request(`/api/terrain/maps/parcel-detail?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}${robustId?`&robustId=${encodeURIComponent(robustId)}`:""}`);
export const generatePdfReport = (id, options = {}) => request(`/api/terrain/analyses/${encodeURIComponent(id)}/pdf`, { method: "POST", body: JSON.stringify(options) });
export const fetchLatestPdfReport = (id) => request(`/api/terrain/analyses/${encodeURIComponent(id)}/pdf`);
export const fetchPdfReportDownload = (id, exportId) => request(`/api/terrain/analyses/${encodeURIComponent(id)}/pdf/${encodeURIComponent(exportId)}/download`);

export { baseUrl as terrainApiBaseUrl };
