// @ts-nocheck -- API aliases are normalized at this app-owned lifecycle boundary.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";

import { endSarSession, fetchActiveSarSession, fetchFeatureFlags, fetchSarPositions, fetchSarSession, fetchTeamAnalyses, fetchTeams, publishSarPosition, startSarSession, startSarSharing, stopSarSharing } from "./api";
import { restoreSarBackground, startSarBackground, stopSarBackground } from "./sar-background";
import { nextSarPosition } from "./sar-core";
import { normalizeSarSessionResponse, safeSarFailure, sarStartReadiness, teamAccessRole } from "./sar-workflow";

export const SAR_SESSION_KEY = "terrain.liveSar.session.v1";

function sessionAnalysisId(session: any) { return session?.analysisJobId ?? session?.analysis_job_id ?? ""; }
function sessionTeamId(session: any) { return session?.teamId ?? session?.team_id ?? ""; }
function sharingId(sharing: any) { return sharing?.sharingSessionId ?? sharing?.sharing_session_id ?? ""; }
function ended(detail: any) { return ["ended", "closed", "complete", "completed", "cancelled", "canceled"].includes(String(detail?.session?.status ?? detail?.sarSession?.status ?? detail?.sar_session?.status ?? detail?.status ?? "").toLowerCase()); }
function revoked(error: any) { return [401, 403, 404, 410].includes(Number(error?.status)) || ["SAR_SESSION_ENDED", "SAR_ACCESS_REVOKED", "SAR_SESSION_NOT_FOUND"].includes(error?.code); }
function storedJson(value: string | null) { try { return JSON.parse(value || "null"); } catch { return null; } }

export function useSarController({ enabled, currentLocation }: { enabled: boolean; currentLocation: any }) {
  const [teamId, setTeamId] = useState("");
  const [analysisId, setAnalysisId] = useState("");
  const [session, setSessionState] = useState<any>(null);
  const [details, setDetails] = useState<any>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [sharing, setSharingState] = useState<any>(null);
  const [backgroundSharing, setBackgroundSharing] = useState(false);
  const [foregroundSuspended, setForegroundSuspended] = useState(false);
  const [message, setMessage] = useState("");
  const [diagnostic, setDiagnostic] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [analysesLoading, setAnalysesLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [sharingBusy, setSharingBusy] = useState(false);
  const [ending, setEnding] = useState(false);
  const [liveSarEnabled, setLiveSarEnabled] = useState<boolean | null>(null);
  const timer = useRef<any>(null), mounted = useRef(true), wasEnabled = useRef(false), generation = useRef(0), sequence = useRef(0), startInFlight = useRef(false), sharingInFlight = useRef(false), endInFlight = useRef(false), refreshInFlight = useRef(false), lastPublished = useRef("");
  const sessionRef = useRef<any>(null), sharingRef = useRef<any>(null), backgroundRef = useRef(false);

  const setSession = useCallback((value: any) => { sessionRef.current = value; setSessionState(value); }, []);
  const setSharing = useCallback((value: any) => { sharingRef.current = value; setSharingState(value); }, []);
  const setBackground = useCallback((value: boolean) => { backgroundRef.current = value; setBackgroundSharing(value); }, []);
  const stopPolling = useCallback(() => { if (timer.current) clearInterval(timer.current); timer.current = null; }, []);
  const showFailure = useCallback((error: any, fallback?: string) => { const safe = safeSarFailure(error, fallback); setMessage(safe.message); setDiagnostic(safe); }, []);
  const rememberSession = useCallback(async (active: any) => {
    if (!active?.id) return;
    await SecureStore.setItemAsync(SAR_SESSION_KEY, JSON.stringify({ sessionId: active.id, teamId: sessionTeamId(active), analysisId: sessionAnalysisId(active), updatedAt: new Date().toISOString() }));
  }, []);
  const clearEndedState = useCallback(async (nextMessage = "The Live SAR session is no longer active.") => {
    stopPolling(); setSession(null); setDetails(null); setPositions([]); setSharing(null); setBackground(false); setForegroundSuspended(false);
    await Promise.all([SecureStore.deleteItemAsync(SAR_SESSION_KEY).catch(() => {}), stopSarBackground().catch(() => {})]);
    setMessage(nextMessage);
  }, [setBackground, setSession, setSharing, stopPolling]);

  const refresh = useCallback(async (activeSession = sessionRef.current) => {
    if (!activeSession?.id || refreshInFlight.current) return false;
    refreshInFlight.current = true;
    try {
      const [detail, current] = await Promise.all([fetchSarSession(activeSession.id), fetchSarPositions(activeSession.id)]);
      if (!mounted.current || sessionRef.current?.id !== activeSession.id) return false;
      if (ended(detail)) { await clearEndedState("The Live SAR session has ended."); return false; }
      setDetails(detail); setPositions(current.items || []); setMessage("Connected · authorized polling active"); setDiagnostic(null);
      return true;
    } catch (error) {
      if (!mounted.current) return false;
      if (revoked(error)) await clearEndedState("Access was revoked or the Live SAR session ended.");
      else showFailure(error, "Live SAR updates are temporarily unavailable; the last authorized positions remain visible.");
      return false;
    } finally { refreshInFlight.current = false; }
  }, [clearEndedState, showFailure]);

  const beginPolling = useCallback((activeSession: any) => {
    stopPolling();
    if (!activeSession?.id) return;
    timer.current = setInterval(() => { void refresh(activeSession); }, 3000);
    void refresh(activeSession);
  }, [refresh, stopPolling]);

  const loadAnalyses = useCallback(async (nextTeamId: string, preferredAnalysisId = "") => {
    if (!nextTeamId) { setAnalyses([]); return []; }
    setAnalysesLoading(true);
    try {
      const result = await fetchTeamAnalyses(nextTeamId), items = result.items || [];
      if (!mounted.current) return [];
      setAnalyses(items);
      if (preferredAnalysisId && items.some((item: any) => (item.analysisJobId || item.analysis_job_id) === preferredAnalysisId)) setAnalysisId(preferredAnalysisId);
      return items;
    } catch (error) { if (mounted.current) showFailure(error, "Analyses shared with this team could not be loaded."); return []; }
    finally { if (mounted.current) setAnalysesLoading(false); }
  }, [showFailure]);

  useEffect(() => {
    mounted.current = true;
    if (!enabled) {
      if (wasEnabled.current) void Promise.all([stopSarBackground().catch(() => {}), SecureStore.deleteItemAsync(SAR_SESSION_KEY).catch(() => {})]);
      wasEnabled.current = false;
      stopPolling(); setSession(null); setDetails(null); setPositions([]); setSharing(null); setBackground(false); setForegroundSuspended(false); setTeams([]); setAnalyses([]); setLoading(false); setLiveSarEnabled(null);
      return;
    }
    wasEnabled.current = true;
    const activeGeneration = ++generation.current;
    setLoading(true);
    Promise.all([fetchTeams(), fetchFeatureFlags(), SecureStore.getItemAsync(SAR_SESSION_KEY), restoreSarBackground()]).then(async ([teamResult, featureResult, sessionValue, backgroundState]) => {
      if (!mounted.current || generation.current !== activeGeneration) return;
      setTeams(teamResult.items || []); setLiveSarEnabled(featureResult.features?.liveSar === true);
      const stored = storedJson(sessionValue), background = backgroundState.active ? backgroundState.value : null;
      const sessionId = stored?.sessionId || background?.sessionId;
      if (!sessionId) return;
      try {
        const detail = await fetchSarSession(sessionId), restored = normalizeSarSessionResponse(detail) || detail?.session;
        if (!restored || ended(detail)) { await clearEndedState("The previously active Live SAR session has ended."); return; }
        if (!mounted.current || generation.current !== activeGeneration) return;
        const restoredTeamId = sessionTeamId(restored) || stored?.teamId || "", restoredAnalysisId = sessionAnalysisId(restored) || stored?.analysisId || "";
        setSession(restored); setDetails(detail); setTeamId(restoredTeamId); setAnalysisId(restoredAnalysisId); await rememberSession(restored);
        if (background?.sessionId === sessionId && background?.sharingSessionId) { setSharing({ sharingSessionId: background.sharingSessionId }); setBackground(true); }
        await loadAnalyses(restoredTeamId, restoredAnalysisId); beginPolling(restored);
      } catch (error) {
        if (revoked(error)) await clearEndedState("The previously active Live SAR session is no longer available.");
        else showFailure(error, "The active Live SAR session could not be restored yet.");
      }
    }).catch((error) => { if (mounted.current) showFailure(error, "Teams could not be loaded. Try again."); }).finally(() => { if (mounted.current && generation.current === activeGeneration) setLoading(false); });
    return () => { mounted.current = false; generation.current += 1; stopPolling(); };
  }, [enabled, beginPolling, clearEndedState, loadAnalyses, rememberSession, setBackground, setSession, setSharing, showFailure, stopPolling]);

  useEffect(() => {
    if (!enabled || !sharing || backgroundSharing || !session || !currentLocation?.recordedAt || foregroundSuspended || lastPublished.current === currentLocation.recordedAt) return;
    lastPublished.current = currentLocation.recordedAt;
    void publishSarPosition(session.id, nextSarPosition(currentLocation, sharingId(sharing), sequence.current++)).then(() => refresh(session)).catch((error) => {
      showFailure(error, "This foreground SAR position could not be published; sharing remains opted in while the app is active.");
    });
  }, [enabled, currentLocation?.recordedAt, sharing, backgroundSharing, session?.id, foregroundSuspended, refresh, showFailure]);

  const chooseTeam = useCallback(async (team: any) => {
    setTeamId(team.id); setAnalysisId(""); setAnalyses([]); setMessage(""); setDiagnostic(null);
    await loadAnalyses(team.id);
  }, [loadAnalyses]);
  const chooseAnalysis = useCallback((id: string) => { setAnalysisId(id); setMessage(""); setDiagnostic(null); }, []);
  const selectedTeam = teams.find((team: any) => team.id === teamId) || null;
  const selectedAnalysis = analyses.find((item: any) => (item.analysisJobId || item.analysis_job_id) === analysisId) || null;
  const readiness = useMemo(() => sarStartReadiness({ team: selectedTeam, analysis: selectedAnalysis, loading: analysesLoading || liveSarEnabled == null, starting, liveSarEnabled: liveSarEnabled !== false }), [selectedTeam, selectedAnalysis, analysesLoading, starting, liveSarEnabled]);
  const canManage = ["owner", "coordinator"].includes(details?.accessRole || details?.access_role || teamAccessRole(selectedTeam));

  const findActive = useCallback(async () => {
    if (liveSarEnabled === false) { setMessage("Live SAR is not currently enabled."); return null; }
    if (!teamId || !analysisId) { setMessage("Choose a team and a shared analysis first."); return null; }
    try {
      const result = await fetchActiveSarSession(teamId, analysisId), active = normalizeSarSessionResponse(result);
      setSession(active); setDetails(result);
      if (active) { await rememberSession(active); setMessage("Active SAR session found."); beginPolling(active); }
      else setMessage("No active SAR session was found for this team and analysis.");
      return active;
    } catch (error) { showFailure(error, "The active SAR session could not be checked."); return null; }
  }, [analysisId, beginPolling, liveSarEnabled, rememberSession, setSession, showFailure, teamId]);

  const start = useCallback(async () => {
    if (!readiness.ready || startInFlight.current) return null;
    startInFlight.current = true; setStarting(true); setMessage("Starting SAR session…"); setDiagnostic(null);
    try {
      const result = await startSarSession({ teamId, analysisJobId: analysisId }), next = normalizeSarSessionResponse(result);
      if (!next) throw new Error("The SAR session response was incomplete.");
      setSession(next); setDetails(result); await rememberSession(next); setMessage("SAR session started."); beginPolling(next); return next;
    } catch (error: any) {
      if (error?.code === "SAR_SESSION_EXISTS") {
        try { const existing = normalizeSarSessionResponse(await fetchActiveSarSession(teamId, analysisId)); if (existing) { setSession(existing); await rememberSession(existing); setMessage("An active session already existed and has been opened."); beginPolling(existing); return existing; } } catch {}
      }
      showFailure(error, "The SAR session could not be started. Your selections were kept; try again."); return null;
    } finally { startInFlight.current = false; if (mounted.current) setStarting(false); }
  }, [analysisId, beginPolling, readiness.ready, rememberSession, setSession, showFailure, teamId]);

  const startShare = useCallback(async (background: boolean, requestLocation?: any) => {
    const active = sessionRef.current;
    if (!active || sharingInFlight.current) return false;
    let serverSharingStarted = false;
    sharingInFlight.current = true;
    setSharingBusy(true); setMessage(background ? "Enabling background SAR sharing…" : "Starting foreground SAR sharing…");
    try {
      const locationResult = await requestLocation?.({ follow: false });
      if (!locationResult || !["started", "granted"].includes(locationResult.status)) throw new Error("Foreground location permission is required to share your location.");
      const participant = (await startSarSharing(active.id, background)).participant, activeSharingId = sharingId(participant);
      serverSharingStarted = true;
      if (!activeSharingId) throw new Error("The Live SAR sharing response was incomplete.");
      sequence.current = 0; lastPublished.current = ""; setSharing(participant); setBackground(background); setForegroundSuspended(false);
      if (background) await startSarBackground({ sessionId: active.id, sharingSessionId: activeSharingId, sequence: 0 });
      setMessage(background ? "LIVE SHARING ACTIVE · Android foreground-service notification active" : "LIVE SHARING ACTIVE · foreground only");
      return true;
    } catch (error) {
      if (serverSharingStarted) await stopSarSharing(active.id).catch(() => {});
      if (background) await stopSarBackground().catch(() => {});
      setSharing(null); setBackground(false); showFailure(error, "Live SAR sharing could not start."); return false;
    } finally { sharingInFlight.current = false; if (mounted.current) setSharingBusy(false); }
  }, [setBackground, setSharing, showFailure]);

  const stopShare = useCallback(async () => {
    const active = sessionRef.current;
    if (!active || sharingInFlight.current) return false;
    sharingInFlight.current = true;
    setSharingBusy(true);
    let serverFailure: any = null;
    try {
      try { await stopSarSharing(active.id); } catch (error) { serverFailure = error; }
      await stopSarBackground(); setSharing(null); setBackground(false); setForegroundSuspended(false);
      if (serverFailure) { showFailure(serverFailure, "Location publishing stopped on this device, but the server could not confirm the sharing opt-out yet."); return false; }
      setMessage("Live sharing stopped. The SAR session remains active."); return true;
    } catch (error) { showFailure(error, "Live sharing could not be stopped completely. Try again."); return false; }
    finally { sharingInFlight.current = false; if (mounted.current) setSharingBusy(false); }
  }, [setBackground, setSharing, showFailure]);

  const end = useCallback(async () => {
    const active = sessionRef.current;
    if (!active || endInFlight.current) return false;
    endInFlight.current = true; setEnding(true);
    try {
      await endSarSession(active.id); await clearEndedState("SAR session ended for all participants."); return true;
    } catch (error) { showFailure(error, "The SAR session could not be ended."); return false; }
    finally { endInFlight.current = false; if (mounted.current) setEnding(false); }
  }, [clearEndedState, showFailure]);

  const setAppActive = useCallback((active: boolean) => {
    if (!sharingRef.current || backgroundRef.current) return;
    setForegroundSuspended(!active);
    if (active) { setMessage("LIVE SHARING ACTIVE · foreground only"); void refresh(sessionRef.current); }
    else setMessage("Foreground-only sharing pauses while the app is not active.");
  }, [refresh]);

  return { teamId, analysisId, session, details, positions, sharing, backgroundSharing, foregroundSuspended, message, diagnostic, teams, analyses, loading, analysesLoading, starting, sharingBusy, ending, liveSarEnabled, selectedTeam, selectedAnalysis, readiness, canManage, chooseTeam, chooseAnalysis, findActive, start, startShare, stopShare, end, refresh, setAppActive };
}
