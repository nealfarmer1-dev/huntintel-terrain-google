// @ts-nocheck -- Expo location DTOs are normalized before persistence.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, findNodeHandle, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Crypto from "expo-crypto";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";

import { appendBreadcrumbPoints, createBreadcrumbRecord, deleteBreadcrumbRecord, updateBreadcrumbRecord } from "./api";
import { ACTIVE_KEY, BREADCRUMB_TASK } from "./navigation-background";
import { appendBreadcrumbPoint, createBreadcrumb, navigationSnapshot, transitionBreadcrumb } from "./navigation-core";
import { breadcrumbLocationTaskOptions, startUserInitiatedLocationTask } from "./location-tracking";

export function NavigationPanel(props: any): any;
export function NavigationPanel({ analysisJobId, waypoints = [], selectedTarget = null, locationRequestNonce = 0, currentLocation = null, follow = false, onRequestVisible, onRequestLocation, onSetFollow, onBreadcrumbChange, onSelectTarget }) {
  const [selected, setSelected] = useState(null);
  const [track, setTrack] = useState(null);
  const [message, setMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const [taskRecordsPoints, setTaskRecordsPoints] = useState(false);
  const titleRef = useRef(null);
  const handledLocationRequest = useRef(0);
  const lastRecordedAt = useRef("");
  const mounted = useRef(true);

  useEffect(() => { setSelected(selectedTarget?.geometry?.type === "Point" ? selectedTarget : null); }, [analysisJobId, selectedTarget?.id]);
  useEffect(() => {
    mounted.current = true; handledLocationRequest.current = 0;
    Promise.all([SecureStore.getItemAsync(ACTIVE_KEY), Location.hasStartedLocationUpdatesAsync(BREADCRUMB_TASK)]).then(([value, started]) => { if (!mounted.current) return; const active = JSON.parse(value || "null"); const scoped = active?.analysisJobId === analysisJobId ? active : null; setTrack(scoped); setTaskRecordsPoints(Boolean(started && scoped)); onBreadcrumbChange?.(scoped); }).catch(() => {});
    return () => { mounted.current = false; };
  }, [analysisJobId]);

  const destination = selected?.geometry?.coordinates ? { longitude: selected.geometry.coordinates[0], latitude: selected.geometry.coordinates[1] } : null;
  const nav = useMemo(() => navigationSnapshot(currentLocation, destination, { arrivalRadiusMeters: 30 }), [currentLocation, destination]);

  async function locate() { if (locating) return false; setLocating(true); try { const result = await onRequestLocation?.({ follow: true }); if (!result || result.status !== "started") { setMessage("Foreground location permission is required while navigation is active."); return false; } setMessage(""); return true; } finally { if (mounted.current) setLocating(false); } }
  function toggleFollow() { if (follow) onSetFollow?.(false); else if (currentLocation) onSetFollow?.(true); else void locate(); }

  useEffect(() => { if (!locationRequestNonce || handledLocationRequest.current === locationRequestNonce) return; handledLocationRequest.current = locationRequestNonce; const frame = requestAnimationFrame(() => { const node = findNodeHandle(titleRef.current); if (node) { onRequestVisible?.(node); AccessibilityInfo.setAccessibilityFocus(node); } }); void locate(); return () => cancelAnimationFrame(frame); }, [locationRequestNonce]);

  useEffect(() => {
    if (!track || track.status !== "active" || !currentLocation?.recordedAt || lastRecordedAt.current === currentLocation.recordedAt) return;
    lastRecordedAt.current = currentLocation.recordedAt;
    const point = { clientPointId: Crypto.randomUUID(), latitude: currentLocation.latitude, longitude: currentLocation.longitude, accuracyMeters: currentLocation.accuracy, altitudeMeters: currentLocation.altitude, headingDegrees: currentLocation.heading, speedMps: currentLocation.speed, recordedAt: currentLocation.recordedAt };
    const next = appendBreadcrumbPoint(track, point); setTrack(next); onBreadcrumbChange?.(next);
    if (!taskRecordsPoints) { void SecureStore.setItemAsync(ACTIVE_KEY, JSON.stringify({ ...next, analysisJobId, nextSequence: next.points.length })); void appendBreadcrumbPoints(analysisJobId, next.id, [next.points.at(-1)]).catch(() => setMessage("Breadcrumb point retained locally and is pending synchronization.")); }
  }, [currentLocation?.recordedAt, track?.id, track?.status, taskRecordsPoints, analysisJobId]);

  async function persist(next) { setTrack(next); onBreadcrumbChange?.(next); if (next) await SecureStore.setItemAsync(ACTIVE_KEY, JSON.stringify({ ...next, analysisJobId, nextSequence: next.points?.length || 0 })); else await SecureStore.deleteItemAsync(ACTIVE_KEY); }
  async function start() {
    if (!analysisJobId) { setMessage("Save this analysis before recording a breadcrumb."); return; }
    if (!await locate()) return;
    const next = createBreadcrumb({ id: Crypto.randomUUID(), name: "Field breadcrumb" }); await persist(next);
    await createBreadcrumbRecord(analysisJobId, next).catch(() => setMessage("Breadcrumb is pending synchronization."));
    const started = await startUserInitiatedLocationTask(Location, BREADCRUMB_TASK, breadcrumbLocationTaskOptions(Location));
    if (started.status === "started") setTaskRecordsPoints(true);
    else { setTaskRecordsPoints(false); setMessage("Foreground location permission is required to record a breadcrumb."); }
  }
  async function action(name) {
    const stored = JSON.parse((await SecureStore.getItemAsync(ACTIVE_KEY)) || "null");
    const source = stored?.analysisJobId === analysisJobId && stored?.id === track?.id ? { ...track, ...stored, points: [...(track?.points || []), ...(stored.points || [])] } : track;
    const next = transitionBreadcrumb(source, name, name === "rename" ? { name: `Field breadcrumb ${new Date().toLocaleTimeString()}` } : {}, new Date().toISOString());
    await persist(next);
    if (name === "delete") { await deleteBreadcrumbRecord(analysisJobId, track.id).catch(() => setMessage("Delete is pending synchronization.")); }
    else await updateBreadcrumbRecord(analysisJobId, track.id, { name: next.name, status: next.status, endedAt: next.endedAt }).catch(() => setMessage("Breadcrumb change is pending synchronization."));
    if ((name === "finish" || name === "delete") && await Location.hasStartedLocationUpdatesAsync(BREADCRUMB_TASK)) await Location.stopLocationUpdatesAsync(BREADCRUMB_TASK);
    if (name === "finish" || name === "delete") setTaskRecordsPoints(false);
  }
  async function handoff() { if (!destination) return; const query = `${destination.latitude},${destination.longitude}`; await Linking.openURL(Platform.OS === "ios" ? `http://maps.apple.com/?daddr=${query}` : `https://www.google.com/maps/dir/?api=1&destination=${query}`); }

  return <View style={s.card}><Text ref={titleRef} accessibilityRole="header" style={s.title}>Field Navigation</Text><Text style={s.meta}>Location starts only when requested. The marker keeps updating when Follow is off; only the camera stops moving.</Text><View style={s.row}><Button label={locating ? "Locating…" : "Center / Follow"} onPress={locate} disabled={locating}/><Button label={follow ? "Following" : "Follow off"} onPress={toggleFollow}/></View>{currentLocation && <Text style={s.meta}>Accuracy ±{Math.round(currentLocation.accuracy || 0)} m · updated {new Date(currentLocation.recordedAt).toLocaleTimeString()} {nav?.stale ? "· STALE" : ""}{currentLocation.altitude != null ? ` · altitude ${Math.round(currentLocation.altitude)} m` : ""}{currentLocation.heading != null ? ` · heading ${Math.round(currentLocation.heading)}°` : ""}{currentLocation.speed != null ? ` · speed ${currentLocation.speed.toFixed(1)} m/s` : ""}</Text>}<Text style={s.meta}>Destination</Text>{waypoints.map((waypoint) => <Button key={waypoint.id} label={waypoint.title || "Untitled waypoint"} onPress={() => { setSelected(waypoint); onSelectTarget?.(waypoint); }} primary={selected?.id === waypoint.id}/>)}{nav && <Text style={s.metric}>{Math.round(nav.distanceMeters)} m · {Math.round(nav.bearingDegrees)}° · {nav.arrived ? "ARRIVED" : "en route"}</Text>}<Button label="Open road navigation" onPress={handoff} disabled={!destination}/>{!track ? <Button label="Start Breadcrumb" onPress={start} primary/> : <View style={s.row}>{track.status === "active" && <Button label="Pause" onPress={() => action("pause")}/>}{track.status === "paused" && <Button label="Resume" onPress={() => action("resume")}/>}<Button label="Rename" onPress={() => action("rename")}/><Button label="Finish / Stop" onPress={() => action("finish")}/><Button label="Delete" onPress={() => action("delete")}/></View>}{track && <Text style={s.meta}>{track.name} · {track.status} · {track.points?.length || 0} visible points</Text>}{!!message && <Text accessibilityLiveRegion="polite" style={s.warning}>{message}</Text>}</View>;
}
function Button({ label, onPress, disabled = false, primary = false }) { return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[s.button, primary && s.primary, disabled && s.disabled]}><Text style={s.buttonText}>{label}</Text></Pressable>; }
const s=StyleSheet.create({card:{padding:16,borderWidth:1,borderColor:"#334333",borderRadius:18,backgroundColor:"#172016",gap:10},title:{color:"#eef3e8",fontSize:21,fontWeight:"900"},meta:{color:"#b5c0ae",lineHeight:19},metric:{color:"#f0d293",fontWeight:"800"},warning:{color:"#f0c784"},row:{flexDirection:"row",flexWrap:"wrap",gap:8},button:{backgroundColor:"#ccd6c4",paddingHorizontal:13,paddingVertical:11,borderRadius:12,minHeight:46,justifyContent:"center"},primary:{backgroundColor:"#99b583"},disabled:{opacity:.4},buttonText:{color:"#142012",fontWeight:"800"}});
