// @ts-nocheck -- API response aliases are normalized at the SAR boundary.
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { createSarAssignment, createSarObservationOffline, endSarSession, fetchActiveSarSession, fetchFeatureFlags, fetchSarPositions, fetchSarSession, fetchTeamAnalyses, fetchTeams, publishSarPosition, startSarSession, startSarSharing, stopSarSharing, updateSarAssignmentOffline } from "./api";
import { SAR_ACTIVE_KEY, startSarBackground, stopSarBackground } from "./sar-background";
import { nextSarPosition, sarPositionState } from "./sar-core";
import { normalizeSarSessionResponse, safeSarFailure, sarPositionPlot, sarStartReadiness, teamAccessRole } from "./sar-workflow";

export function SarScreen({ onClose, currentLocation = null, onRequestLocation }: any) {
  const [teamId, setTeamId] = useState("");
  const [analysisId, setAnalysisId] = useState("");
  const [session, setSession] = useState<any>(null);
  const [details, setDetails] = useState<any>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [sharing, setSharing] = useState<any>(null);
  const [backgroundSharing, setBackgroundSharing] = useState(false);
  const [message, setMessage] = useState("");
  const [diagnostic, setDiagnostic] = useState<any>(null);
  const [showPositions, setShowPositions] = useState(true);
  const [observation, setObservation] = useState("");
  const [assignee, setAssignee] = useState("");
  const [waypoint, setWaypoint] = useState("");
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [teams, setTeams] = useState<any[]>([]);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analysesLoading, setAnalysesLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [sharingBusy, setSharingBusy] = useState(false);
  const [liveSarEnabled, setLiveSarEnabled] = useState<boolean|null>(null);
  const sequence = useRef(0);
  const timer = useRef<any>(null);
  const startInFlight = useRef(false);
  const lastPublished = useRef("");
  const mounted = useRef(true);

  const selectedTeam = teams.find((team) => team.id === teamId) || null;
  const selectedAnalysis = analyses.find((item) => (item.analysisJobId || item.analysis_job_id) === analysisId) || null;
  const readiness = useMemo(() => sarStartReadiness({ team: selectedTeam, analysis: selectedAnalysis, loading: analysesLoading || liveSarEnabled == null, starting, liveSarEnabled: liveSarEnabled !== false }), [selectedTeam, selectedAnalysis, analysesLoading, starting, liveSarEnabled]);
  const canManage = ["owner", "coordinator"].includes(details?.accessRole || details?.access_role || teamAccessRole(selectedTeam));

  const stopPolling = () => { if (timer.current) clearInterval(timer.current); timer.current = null; };
  const showFailure = (error: any, fallback?: string) => { const safe = safeSarFailure(error, fallback); setMessage(safe.message); setDiagnostic(safe); };
  const refresh = async (activeSession = session) => {
    if (!activeSession) return;
    try {
      const [detail, current] = await Promise.all([fetchSarSession(activeSession.id), fetchSarPositions(activeSession.id)]);
      if (!mounted.current) return;
      setDetails(detail); setPositions(current.items || []); setMessage("Connected · authorized polling active");
    } catch (error) {
      if (!mounted.current) return;
      showFailure(error, "Access was revoked or the SAR session is unavailable.");
      setSharing(null); setBackgroundSharing(false); stopPolling();
    }
  };
  const beginPolling = (activeSession: any) => { stopPolling(); timer.current = setInterval(() => { void refresh(activeSession); }, 3000); void refresh(activeSession); };

  const chooseTeam = async (team: any) => {
    setTeamId(team.id); setAnalysisId(""); setAnalyses([]); setMessage(""); setDiagnostic(null); setAnalysesLoading(true);
    try { const result = await fetchTeamAnalyses(team.id); if (mounted.current) setAnalyses(result.items || []); }
    catch (error) { if (mounted.current) showFailure(error, "Analyses shared with this team could not be loaded."); }
    finally { if (mounted.current) setAnalysesLoading(false); }
  };

  useEffect(() => {
    mounted.current = true;
    Promise.all([fetchTeams(), fetchFeatureFlags(), SecureStore.getItemAsync(SAR_ACTIVE_KEY)]).then(async ([teamResult, featureResult, activeValue]) => {
      if (!mounted.current) return;
      setTeams(teamResult.items || []);
      setLiveSarEnabled(featureResult.features?.liveSar === true);
      const active = JSON.parse(activeValue || "null");
      if (active?.sessionId) {
        const detail = await fetchSarSession(active.sessionId);
        const restored = normalizeSarSessionResponse(detail) || detail?.session;
        if (mounted.current && restored) { setSession(restored); setDetails(detail); setSharing({ sharingSessionId: active.sharingSessionId }); setBackgroundSharing(true); setTeamId(restored.teamId || restored.team_id); setAnalysisId(restored.analysisJobId || restored.analysis_job_id); beginPolling(restored); }
      }
    }).catch((error) => { if (mounted.current) showFailure(error, "Teams could not be loaded. Try again."); }).finally(() => { if (mounted.current) setLoading(false); });
    return () => { mounted.current = false; stopPolling(); };
  }, []);

  useEffect(() => {
    if (!sharing || backgroundSharing || !session || !currentLocation?.recordedAt || lastPublished.current === currentLocation.recordedAt) return;
    lastPublished.current = currentLocation.recordedAt;
    void publishSarPosition(session.id, nextSarPosition(currentLocation, sharing.sharingSessionId || sharing.sharing_session_id, sequence.current++)).then(() => refresh(session)).catch(async (error) => { showFailure(error, "Foreground SAR sharing stopped."); await stopSarSharing(session.id).catch(() => {}); setSharing(null); });
  }, [currentLocation?.recordedAt, sharing, backgroundSharing, session?.id]);

  const findActive = async () => {
    if (liveSarEnabled === false) { setMessage("Live SAR is not currently enabled."); return; }
    if (!teamId || !analysisId) { setMessage("Choose a team and a shared analysis first."); return; }
    try { const result = await fetchActiveSarSession(teamId, analysisId); const active = normalizeSarSessionResponse(result); setSession(active); setDetails(result); if (active) { setMessage("Active SAR session found."); beginPolling(active); } else setMessage("No active SAR session was found for this team and analysis."); }
    catch (error) { showFailure(error, "The active SAR session could not be checked."); }
  };

  const start = async () => {
    if (!readiness.ready || startInFlight.current) return;
    startInFlight.current = true; setStarting(true); setMessage("Starting SAR session…"); setDiagnostic(null);
    const selectedTeamId = teamId, selectedAnalysisId = analysisId;
    try {
      const result = await startSarSession({ teamId: selectedTeamId, analysisJobId: selectedAnalysisId });
      const next = normalizeSarSessionResponse(result);
      if (!next) throw new Error("The SAR session response was incomplete.");
      setSession(next); setDetails(result); setMessage("SAR session started."); beginPolling(next);
    } catch (error: any) {
      if (error?.code === "SAR_SESSION_EXISTS") { try { const existing = normalizeSarSessionResponse(await fetchActiveSarSession(selectedTeamId, selectedAnalysisId)); if (existing) { setSession(existing); setMessage("An active session already existed and has been opened."); beginPolling(existing); return; } } catch {} }
      showFailure(error, "The SAR session could not be started. Your selections were kept; try again.");
    } finally { startInFlight.current = false; if (mounted.current) setStarting(false); }
  };

  const startShare = async (background: boolean) => {
    if (!session || sharingBusy) return;
    setSharingBusy(true); setMessage(background ? "Enabling background SAR sharing…" : "Starting foreground SAR sharing…");
    try {
      if (!background) { const result = await onRequestLocation?.({ follow: false }); if (result && !["started", "granted"].includes(result.status)) throw new Error("Foreground location permission is required to share your location."); }
      const participant = (await startSarSharing(session.id, background)).participant;
      const sharingSessionId = participant.sharingSessionId || participant.sharing_session_id;
      sequence.current = 0; setSharing(participant); setBackgroundSharing(background);
      if (background) await startSarBackground({ sessionId: session.id, sharingSessionId, sequence: 0 });
      setMessage(background ? "LIVE SHARING ACTIVE · Android foreground-service notification active" : "LIVE SHARING ACTIVE · foreground only");
    } catch (error) { await stopSarSharing(session.id).catch(() => {}); setSharing(null); setBackgroundSharing(false); showFailure(error, "Live SAR sharing could not start."); }
    finally { setSharingBusy(false); }
  };

  const stopShare = async () => { if (!session || sharingBusy) return; setSharingBusy(true); try { await stopSarSharing(session.id); await stopSarBackground().catch(() => {}); setSharing(null); setBackgroundSharing(false); setMessage("Live sharing stopped."); } catch (error) { showFailure(error, "Live sharing could not be stopped."); } finally { setSharingBusy(false); } };
  const close = async () => { stopPolling(); if (sharing && !backgroundSharing && session) await stopSarSharing(session.id).catch(() => {}); onClose(); };
  const markers = sarPositionPlot(positions).map(({position,xPercent,yPercent})=>({position,left:`${xPercent}%`,top:`${yPercent}%`}));

  return <View style={s.card}>
    <Text style={s.eyebrow}>AUTHORIZED TEAM COORDINATION</Text><Text style={s.title}>Live SAR Coordination</Text>
    <Text style={s.warning}>Terrain intelligence does not replace incident command, emergency services, training, or official procedures.</Text>
    <Text style={s.meta}>Find Active opens an existing session. Start Session creates one for a shared analysis and requires an owner/coordinator. Sharing is explicit and stoppable.</Text>
    <Pressable accessibilityRole="button" style={s.button} onPress={() => { void close(); }}><Text style={s.buttonText}>{Platform.OS === "ios" ? "Close Live SAR" : "Back"}</Text></Pressable>
    {loading && <View accessibilityRole="progressbar" style={s.loading}><ActivityIndicator color="#d0a65d"/><Text style={s.meta}>Loading authorized teams…</Text></View>}
    <Text style={s.subtitle}>Choose a team</Text><View style={s.row}>{teams.map((team) => <Pressable accessibilityRole="button" accessibilityState={{ selected: teamId === team.id }} key={team.id} style={teamId === team.id ? s.primary : s.button} onPress={() => { void chooseTeam(team); }}><Text style={s.buttonText}>{team.name} · {teamAccessRole(team)}</Text></Pressable>)}</View>
    <Text style={s.meta}>Selected team: {selectedTeam?.name || "None"} · role: {teamAccessRole(selectedTeam) || "not selected"}</Text>
    <Text style={s.subtitle}>Choose a team-shared analysis</Text>{analysesLoading ? <ActivityIndicator color="#d0a65d"/> : <View style={s.row}>{analyses.map((item) => { const id = item.analysisJobId || item.analysis_job_id; return <Pressable accessibilityRole="button" accessibilityState={{ selected: analysisId === id }} key={id} style={analysisId === id ? s.primary : s.button} onPress={() => setAnalysisId(id)}><Text style={s.buttonText}>{item.name || "Terrain Analysis"}</Text></Pressable>; })}</View>}
    {!analysesLoading && selectedTeam && !analyses.length && <Text style={s.meta}>No analyses are shared with this team. Open Teams and explicitly share an owned analysis first.</Text>}
    <Text style={s.meta}>Selected analysis: {selectedAnalysis?.name || "None"} · shared with team: {selectedAnalysis ? "Yes" : "No"}</Text>
    <Text accessibilityLiveRegion="polite" style={readiness.ready ? s.live : s.meta}>{readiness.reason}</Text>
    <View style={s.row}><Pressable accessibilityRole="button" disabled={!teamId || !analysisId || starting || liveSarEnabled !== true} style={[s.button, (!teamId || !analysisId || starting || liveSarEnabled !== true) && s.disabled]} onPress={() => { void findActive(); }}><Text style={s.buttonText}>Find Active Session</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ busy: starting, disabled: !readiness.ready }} disabled={!readiness.ready} style={[s.primary, !readiness.ready && s.disabled]} onPress={() => { void start(); }}>{starting ? <ActivityIndicator color="#142012"/> : <Text style={s.buttonText}>Start Session</Text>}</Pressable></View>
    {session && <><Text style={s.meta}>Connected · {details?.accessRole || details?.access_role || "authorized member"}{__DEV__ ? ` · session ${session.id}` : ""}</Text><View style={s.row}>{sharing ? <><Text style={s.live}>● LIVE SHARING ACTIVE</Text><Pressable disabled={sharingBusy} style={s.danger} onPress={() => { void stopShare(); }}><Text style={s.buttonText}>Stop sharing</Text></Pressable></> : <><Pressable disabled={sharingBusy} style={s.primary} onPress={() => { void startShare(false); }}><Text style={s.buttonText}>Start foreground sharing</Text></Pressable><Pressable disabled={sharingBusy} style={s.button} onPress={() => { void startShare(true); }}><Text style={s.buttonText}>Enable background sharing</Text></Pressable></>}<Pressable style={s.button} onPress={() => setShowPositions((value) => !value)}><Text style={s.buttonText}>{showPositions ? "Hide" : "Show"} Team Positions</Text></Pressable></View>
      {showPositions && <View style={s.map}>{markers.length ? markers.map(({ position, left, top }) => { const value = sarPositionState(position); return <View key={position.userId || position.user_id} style={[s.marker, { left, top, opacity: value.stale ? .45 : 1 }]}><Text style={s.markerText}>● {position.displayName || position.display_name || position.email || "Member"}</Text><Text style={s.markerMeta}>{value.stale ? "STALE" : "current"} · ±{Math.round(position.accuracyMeters || position.accuracy_meters || 0)}m</Text></View>; }) : <Text style={s.emptyMap}>No team positions have been shared.</Text>}</View>}
      <Text style={s.subtitle}>Assignments</Text>{(details?.assignments || []).map((assignment: any) => <View key={assignment.id} style={s.item}><Text style={s.meta}>{assignment.title} · {assignment.status}</Text><View style={s.row}>{["in_progress", "complete"].map((status) => <Pressable key={status} style={s.button} onPress={async () => { const result = await updateSarAssignmentOffline(analysisId, session.id, assignment.id, status); setMessage(result.queued ? "Assignment update pending encrypted offline sync." : "Assignment updated."); void refresh(); }}><Text style={s.buttonText}>{status === "complete" ? "Complete" : "Start"}</Text></Pressable>)}</View></View>)}
      {__DEV__&&canManage && <><TextInput style={s.input} value={assignee} onChangeText={setAssignee} placeholder="Assigned member user ID"/><TextInput style={s.input} value={waypoint} onChangeText={setWaypoint} placeholder="Waypoint ID"/><TextInput style={s.input} value={assignmentTitle} onChangeText={setAssignmentTitle} placeholder="Assignment title"/><Pressable style={s.button} onPress={async () => { await createSarAssignment(session.id, { assignedUserId: assignee, waypointId: waypoint, title: assignmentTitle }); setAssignmentTitle(""); void refresh(); }}><Text style={s.buttonText}>Create assignment</Text></Pressable></>}
      <TextInput accessibilityLabel="Team observation" style={s.input} value={observation} onChangeText={setObservation} placeholder="Team observation"/><Pressable style={s.button} onPress={async () => { const result = await createSarObservationOffline(analysisId, session.id, { clientOperationId: Crypto.randomUUID(), body: observation, clientTimestamp: new Date().toISOString() }); setObservation(""); setMessage(result.queued ? "Observation pending encrypted offline sync." : "Observation synchronized."); }}><Text style={s.buttonText}>Add observation</Text></Pressable>
      {canManage && <Pressable style={s.danger} onPress={async () => { try { await endSarSession(session.id); await stopSarBackground().catch(() => {}); stopPolling(); setSession(null); setSharing(null); setBackgroundSharing(false); setMessage("SAR session ended."); } catch (error) { showFailure(error, "The SAR session could not be ended."); } }}><Text style={s.buttonText}>End SAR session</Text></Pressable>}</>}
    {!!message && <Text accessibilityLiveRegion="polite" style={s.meta}>{message}</Text>}{diagnostic?.correlationId && <Text style={s.meta}>Support reference: {diagnostic.correlationId}</Text>}
  </View>;
}

const s = StyleSheet.create({ card:{width:"100%",maxWidth:900,alignSelf:"center",backgroundColor:"#172016",padding:18,borderRadius:20,gap:14,borderWidth:1,borderColor:"#334333"},eyebrow:{color:"#d0a65d",fontSize:11,fontWeight:"800",letterSpacing:1.5},title:{color:"#eef3e8",fontSize:28,fontWeight:"900"},subtitle:{color:"#eef3e8",fontSize:18,fontWeight:"800",marginTop:6},warning:{color:"#f0c784",fontWeight:"700",lineHeight:21,backgroundColor:"#2c2419",borderRadius:14,padding:12,borderWidth:1,borderColor:"#514027"},meta:{color:"#b5c0ae",lineHeight:20},live:{color:"#9bdb87",fontWeight:"900",minHeight:24,textAlignVertical:"center"},input:{color:"#10140f",backgroundColor:"#edf1e9",paddingHorizontal:14,paddingVertical:12,borderRadius:12,minHeight:48,fontSize:16},row:{flexDirection:"row",flexWrap:"wrap",gap:8},button:{backgroundColor:"#ccd6c4",paddingHorizontal:14,paddingVertical:12,borderRadius:12,minHeight:48,justifyContent:"center",alignItems:"center"},primary:{backgroundColor:"#99b583",paddingHorizontal:14,paddingVertical:12,borderRadius:12,minHeight:48,justifyContent:"center",alignItems:"center"},danger:{backgroundColor:"#c87568",paddingHorizontal:14,paddingVertical:12,borderRadius:12,minHeight:48,justifyContent:"center",alignItems:"center"},buttonText:{color:"#142012",fontWeight:"800"},disabled:{opacity:.4},loading:{minHeight:96,alignItems:"center",justifyContent:"center",gap:10},map:{height:240,backgroundColor:"#243124",borderRadius:16,position:"relative",alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"#3b4b3a"},emptyMap:{color:"#b5c0ae",padding:16,textAlign:"center"},marker:{position:"absolute"},markerText:{color:"#eef3e8",fontWeight:"800",fontSize:11},markerMeta:{color:"#c7d0c0",fontSize:10},item:{backgroundColor:"#263126",padding:14,borderRadius:14,gap:8,borderWidth:1,borderColor:"#3b4b3a"} });
