// @ts-nocheck -- API response aliases are normalized by the app-owned SAR controller.
import React, { useEffect, useState } from "react";
import * as Crypto from "expo-crypto";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { createSarAssignment, createSarObservationOffline, updateSarAssignmentOffline } from "./api";
import { sarParticipantLabel } from "./sar-map";
import { sarPositionState } from "./sar-core";
import { teamAccessRole } from "./sar-workflow";

function Button({ label, onPress, primary = false, danger = false, disabled = false, busy = false, accessibilityLabel }: any) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel || label} accessibilityState={{ disabled, busy }} disabled={disabled} style={[s.button, primary && s.primary, danger && s.danger, disabled && s.disabled]} onPress={onPress}>{busy ? <ActivityIndicator color="#142012" /> : <Text style={s.buttonText}>{label}</Text>}</Pressable>;
}

export function SarScreen({ controller, onBackToAnalysis, onSelectAnalysis, onSessionEnded, onRequestLocation, map, teamPositionsVisible, onToggleTeamPositions, currentUserId }: any) {
  const { teamId, analysisId, session, details, positions, sharing, backgroundSharing, foregroundSuspended, message, diagnostic, teams, analyses, loading, analysesLoading, starting, sharingBusy, ending, liveSarEnabled, selectedTeam, selectedAnalysis, readiness, canManage } = controller;
  const [observation, setObservation] = useState("");
  const [assignee, setAssignee] = useState("");
  const [waypoint, setWaypoint] = useState("");
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const observations = details?.observations || (details?.events || []).filter((event: any) => ["observation", "note"].includes(String(event?.type || event?.eventType || event?.event_type || "").toLowerCase()));

  useEffect(() => { if (analysisId) onSelectAnalysis?.(analysisId); }, [analysisId]);

  const endWithConfirmation = () => {
    Alert.alert(
      "End Live SAR Session?",
      "This will end the SAR session for all participants and stop active location sharing. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "End Session", style: "destructive", onPress: async () => { if (await controller.end()) onSessionEnded?.(); } },
      ],
      { cancelable: true },
    );
  };

  if (!session) return <View style={s.card}>
    <Text style={s.eyebrow}>AUTHORIZED TEAM COORDINATION</Text><Text style={s.title}>Live SAR Coordination</Text>
    <Text style={s.warning}>Terrain intelligence does not replace incident command, emergency services, training, or official procedures.</Text>
    <Text style={s.meta}>Find Active opens an existing session. Start Session creates one for a shared analysis and requires an owner/coordinator. Sharing is explicit and stoppable.</Text>
    <Button label={analysisId ? "Back to Analysis" : "Back to Terrain"} onPress={onBackToAnalysis} />
    {loading && <View accessibilityRole="progressbar" style={s.loading}><ActivityIndicator color="#d0a65d"/><Text style={s.meta}>Loading authorized teams…</Text></View>}
    <Text style={s.subtitle}>Choose a team</Text><View style={s.row}>{teams.map((team: any) => <Button key={team.id} label={`${team.name} · ${teamAccessRole(team)}`} primary={teamId === team.id} onPress={() => { void controller.chooseTeam(team); }} />)}</View>
    <Text style={s.meta}>Selected team: {selectedTeam?.name || "None"} · role: {teamAccessRole(selectedTeam) || "not selected"}</Text>
    <Text style={s.subtitle}>Choose a team-shared analysis</Text>{analysesLoading ? <ActivityIndicator color="#d0a65d"/> : <View style={s.row}>{analyses.map((item: any) => { const id = item.analysisJobId || item.analysis_job_id; return <Button key={id} label={item.name || "Terrain Analysis"} primary={analysisId === id} onPress={() => controller.chooseAnalysis(id)} />; })}</View>}
    {!analysesLoading && selectedTeam && !analyses.length && <Text style={s.meta}>No analyses are shared with this team. Open Teams and explicitly share an owned analysis first.</Text>}
    <Text style={s.meta}>Selected analysis: {selectedAnalysis?.name || "None"} · shared with team: {selectedAnalysis ? "Yes" : "No"}</Text>
    <Text accessibilityLiveRegion="polite" style={readiness.ready ? s.live : s.meta}>{readiness.reason}</Text>
    <View style={s.row}><Button label="Find Active Session" disabled={!teamId || !analysisId || starting || liveSarEnabled !== true} onPress={() => { void controller.findActive(); }} /><Button label="Start Session" primary busy={starting} disabled={!readiness.ready} onPress={() => { void controller.start(); }} /></View>
    {!!message && <Text accessibilityLiveRegion="polite" style={s.meta}>{message}</Text>}{diagnostic?.correlationId && <Text style={s.meta}>Support reference: {diagnostic.correlationId}</Text>}
  </View>;

  return <View style={s.card}>
    <Text style={s.eyebrow}>AUTHORIZED TEAM COORDINATION</Text><Text style={s.title}>Live SAR Coordination</Text>
    <Text style={s.meta}>Connected · {details?.accessRole || details?.access_role || "authorized member"}{__DEV__ ? ` · session ${session.id}` : ""}</Text>
    <Button label="Back to Analysis" accessibilityLabel="Back to selected analysis without stopping Live SAR" onPress={onBackToAnalysis} />
    <View style={s.realMap}>{map}</View>
    {!positions.length && <Text accessibilityLiveRegion="polite" style={s.mapNotice}>No opted-in team positions are currently available.</Text>}
    <View style={s.row}>
      {sharing ? <><Text style={foregroundSuspended ? s.paused : s.live}>● {foregroundSuspended ? "FOREGROUND SHARING PAUSED WHILE APP IS INACTIVE" : backgroundSharing ? "LIVE SHARING ACTIVE · BACKGROUND" : "LIVE SHARING ACTIVE · FOREGROUND ONLY"}</Text><Button label="Stop sharing" danger busy={sharingBusy} disabled={sharingBusy} onPress={() => { void controller.stopShare(); }} /></> : <><Button label="Start foreground sharing" primary disabled={sharingBusy} onPress={() => { void controller.startShare(false, onRequestLocation); }} /><Button label="Enable background sharing" disabled={sharingBusy} onPress={() => { void controller.startShare(true, onRequestLocation); }} /></>}
      <Button label={teamPositionsVisible ? "Hide Team Positions" : "Show Team Positions"} accessibilityLabel={`${teamPositionsVisible ? "Hide" : "Show"} Live SAR team-position layer`} onPress={onToggleTeamPositions} />
    </View>
    {!!positions.length && <View style={s.participantList}><Text style={s.subtitle}>Team position status</Text>{positions.map((position: any, index: number) => { const value = sarPositionState(position); const updated = position.receivedAt || position.received_at || position.recordedAt || position.recorded_at; const self=String(position.sharingSessionId??position.sharing_session_id??"")===String(sharing?.sharingSessionId??sharing?.sharing_session_id??"__none__"); return <View key={position.participantId || position.participant_id || position.userId || position.user_id || index} style={s.participant}><Text style={s.participantName}>{sarParticipantLabel(self?{...position,isCurrentUser:true}:position, currentUserId)}</Text><Text style={s.meta}>{value.offline ? "OFFLINE" : value.stale ? "STALE" : "Current"} · ±{Math.round(position.accuracyMeters || position.accuracy_meters || position.accuracy || 0)} m{updated ? ` · updated ${new Date(updated).toLocaleTimeString()}` : ""}{position.role ? ` · ${position.role}` : ""}</Text></View>; })}</View>}
    <Text style={s.subtitle}>Assignments</Text>{(details?.assignments || []).length ? (details.assignments || []).map((assignment: any) => <View key={assignment.id} style={s.item}><Text style={s.meta}>{assignment.title} · {assignment.status}</Text><View style={s.row}>{["in_progress", "complete"].map((status) => <Button key={status} label={status === "complete" ? "Complete" : "Start"} onPress={async () => { await updateSarAssignmentOffline(analysisId, session.id, assignment.id, status); void controller.refresh(); }} />)}</View></View>) : <Text style={s.meta}>No assignments have been added.</Text>}
    {__DEV__ && canManage && <><TextInput style={s.input} value={assignee} onChangeText={setAssignee} placeholder="Assigned member user ID"/><TextInput style={s.input} value={waypoint} onChangeText={setWaypoint} placeholder="Waypoint ID"/><TextInput style={s.input} value={assignmentTitle} onChangeText={setAssignmentTitle} placeholder="Assignment title"/><Button label="Create assignment" onPress={async () => { await createSarAssignment(session.id, { assignedUserId: assignee, waypointId: waypoint, title: assignmentTitle }); setAssignmentTitle(""); void controller.refresh(); }} /></>}
    <Text style={s.subtitle}>Observations</Text>{observations.length ? observations.map((item: any, index: number) => <View key={item.id || item.clientOperationId || item.client_operation_id || index} style={s.item}><Text style={s.meta}>{item.body || item.text || item.description || "Team observation"}</Text></View>) : <Text style={s.meta}>No observations have been added.</Text>}<TextInput accessibilityLabel="Team observation" style={s.input} value={observation} onChangeText={setObservation} placeholder="Team observation"/><Button label="Add observation" onPress={async () => { await createSarObservationOffline(analysisId, session.id, { clientOperationId: Crypto.randomUUID(), body: observation, clientTimestamp: new Date().toISOString() }); setObservation(""); void controller.refresh(); }} />
    {canManage && <View style={s.endSection}><Text style={s.warning}>Ending the session affects every participant. Ordinary navigation and Stop sharing do not end it.</Text><Button label="End SAR Session" danger busy={ending} disabled={ending} onPress={endWithConfirmation} /></View>}
    {!!message && <Text accessibilityLiveRegion="polite" style={s.meta}>{message}</Text>}{diagnostic?.correlationId && <Text style={s.meta}>Support reference: {diagnostic.correlationId}</Text>}
  </View>;
}

const s = StyleSheet.create({ card:{width:"100%",maxWidth:980,alignSelf:"center",backgroundColor:"#172016",padding:18,borderRadius:20,gap:14,borderWidth:1,borderColor:"#334333"},eyebrow:{color:"#d0a65d",fontSize:11,fontWeight:"800",letterSpacing:1.5},title:{color:"#eef3e8",fontSize:28,fontWeight:"900"},subtitle:{color:"#eef3e8",fontSize:18,fontWeight:"800",marginTop:6},warning:{color:"#f0c784",fontWeight:"700",lineHeight:21,backgroundColor:"#2c2419",borderRadius:14,padding:12,borderWidth:1,borderColor:"#514027"},meta:{color:"#b5c0ae",lineHeight:20},live:{color:"#9bdb87",fontWeight:"900",minHeight:24,textAlignVertical:"center"},paused:{color:"#f0c784",fontWeight:"900",minHeight:24,textAlignVertical:"center"},input:{color:"#10140f",backgroundColor:"#edf1e9",paddingHorizontal:14,paddingVertical:12,borderRadius:12,minHeight:48,fontSize:16},row:{flexDirection:"row",flexWrap:"wrap",gap:8,alignItems:"center"},button:{backgroundColor:"#ccd6c4",paddingHorizontal:14,paddingVertical:12,borderRadius:12,minHeight:48,justifyContent:"center",alignItems:"center"},primary:{backgroundColor:"#99b583"},danger:{backgroundColor:"#c87568"},buttonText:{color:"#142012",fontWeight:"800"},disabled:{opacity:.4},loading:{minHeight:96,alignItems:"center",justifyContent:"center",gap:10},realMap:{minHeight:320},mapNotice:{color:"#cbd6c5",paddingHorizontal:12,paddingVertical:10,borderRadius:12,backgroundColor:"#243124",textAlign:"center"},participantList:{gap:8},participant:{padding:10,borderRadius:12,backgroundColor:"#202a20",borderWidth:1,borderColor:"#3b4b3a"},participantName:{color:"#eef3e8",fontWeight:"800"},item:{backgroundColor:"#263126",padding:14,borderRadius:14,gap:8,borderWidth:1,borderColor:"#3b4b3a"},endSection:{gap:10,marginTop:8,paddingTop:12,borderTopWidth:1,borderTopColor:"#4e3b34"} });
