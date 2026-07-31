// @ts-nocheck -- Expo sensor DTOs are runtime-validated and shared with the JS navigation core.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, findNodeHandle, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

import { ACTIVE_KEY, BREADCRUMB_TASK } from "./navigation-background";
import { createBreadcrumb, navigationSnapshot, transitionBreadcrumb } from "./navigation-core";
import { ensureForegroundLocationPermission } from "./location-control";
import { breadcrumbLocationTaskOptions, startUserInitiatedLocationTask, stopLocationTaskIfStarted } from "./location-tracking";
import { createBreadcrumbRecord, deleteBreadcrumbRecord, updateBreadcrumbRecord } from "./api";

export function NavigationPanel(props: any): any;
export function NavigationPanel({ analysisJobId, waypoints = [], selectedTarget = null, navigationRequestNonce = 0, onRequestVisible, onSelectTarget }) {
  const [selected, setSelected] = useState(null);
  const [location, setLocation] = useState(null);
  const [follow, setFollow] = useState(false);
  const [track, setTrack] = useState(null);
  const [message, setMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const titleRef = useRef(null);
  const watchRef = useRef(null);
  const locatingRef = useRef(false);
  const mountedRef = useRef(true);
  const desiredFollowRef = useRef(false);
  const lastNavigationRequestRef = useRef(0);

  useEffect(() => {
    setSelected(selectedTarget?.geometry?.type === "Point" ? selectedTarget : null);
  }, [analysisJobId, selectedTarget?.id]);

  const stopLocationWatch = useCallback(() => {
    watchRef.current?.remove();
    watchRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    lastNavigationRequestRef.current = 0;
    return () => {
      mountedRef.current = false;
      locatingRef.current = false;
      desiredFollowRef.current = false;
      stopLocationWatch();
    };
  }, [analysisJobId, stopLocationWatch]);

  const destination = selected?.geometry?.coordinates
    ? { longitude: selected.geometry.coordinates[0], latitude: selected.geometry.coordinates[1] }
    : null;
  const nav = useMemo(
    () => navigationSnapshot(location, destination, { arrivalRadiusMeters: 30 }),
    [location, destination],
  );

  const locate = useCallback(async () => {
    desiredFollowRef.current = true;
    if (locatingRef.current) return false;
    if (watchRef.current) {
      if (mountedRef.current) {
        setFollow(true);
        setMessage("");
      }
      return true;
    }

    locatingRef.current = true;
    if (mountedRef.current) {
      setLocating(true);
      setMessage("Requesting current location…");
    }
    try {
      const permission = await ensureForegroundLocationPermission(Location);
      if (!mountedRef.current) return false;
      if (permission.status !== "granted") {
        desiredFollowRef.current = false;
        setFollow(false);
        setMessage(permission.status === "unavailable"
          ? "Location permission could not be checked. Try again."
          : "Foreground location permission is required while navigation or breadcrumb recording is active.");
        return false;
      }

      const next = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (!mountedRef.current) return false;
      setLocation({ ...next.coords, recordedAt: new Date(next.timestamp).toISOString() });
      if (!desiredFollowRef.current) {
        setFollow(false);
        return false;
      }
      setFollow(true);
      setMessage("");

      const subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 5 },
        (value) => {
          if (mountedRef.current) {
            setLocation({ ...value.coords, recordedAt: new Date(value.timestamp).toISOString() });
          }
        },
      );
      if (!mountedRef.current || !desiredFollowRef.current) {
        subscription.remove();
        if (mountedRef.current) setFollow(false);
        return false;
      }
      stopLocationWatch();
      watchRef.current = subscription;
      return true;
    } catch {
      desiredFollowRef.current = false;
      if (mountedRef.current) {
        setFollow(false);
        setMessage("Current location is unavailable. Check location services and try again.");
      }
      return false;
    } finally {
      locatingRef.current = false;
      if (mountedRef.current) setLocating(false);
    }
  }, [stopLocationWatch]);

  useEffect(() => {
    const nonce = Number(navigationRequestNonce) || 0;
    if (nonce <= 0 || lastNavigationRequestRef.current === nonce) return;
    lastNavigationRequestRef.current = nonce;
    const frame = requestAnimationFrame(() => {
      const titleNode = findNodeHandle(titleRef.current);
      if (titleNode) {
        onRequestVisible?.(titleNode);
        AccessibilityInfo.setAccessibilityFocus(titleNode);
      }
    });
    void locate();
    return () => cancelAnimationFrame(frame);
  }, [navigationRequestNonce, locate, onRequestVisible]);

  function toggleFollow() {
    if (follow) {
      desiredFollowRef.current = false;
      stopLocationWatch();
      setFollow(false);
      return;
    }
    void locate();
  }

  async function persist(next) {
    setTrack(next);
    if (next) await SecureStore.setItemAsync(ACTIVE_KEY, JSON.stringify({ ...next, analysisJobId }));
    else await SecureStore.deleteItemAsync(ACTIVE_KEY);
  }

  async function start() {
    if (!analysisJobId) {
      setMessage("Save this analysis before recording a breadcrumb.");
      return;
    }
    if (!await locate()) return;
    const next = createBreadcrumb({ id: Crypto.randomUUID(), name: "Field breadcrumb" });
    await persist(next);
    try {
      const result = await startUserInitiatedLocationTask(
        Location,
        BREADCRUMB_TASK,
        breadcrumbLocationTaskOptions(Location),
      );
      if (result.status !== "started") {
        await persist(null);
        setMessage("Foreground location permission is required to record a breadcrumb.");
        return;
      }
    } catch {
      await persist(null);
      setMessage("Breadcrumb tracking could not start. Keep the app visible and try again.");
      return;
    }
    await createBreadcrumbRecord(analysisJobId, next).catch(() => setMessage("Breadcrumb is pending synchronization."));
  }

  async function action(name) {
    const next = transitionBreadcrumb(
      track,
      name,
      name === "rename" ? { name: `Field breadcrumb ${new Date().toLocaleTimeString()}` } : {},
      new Date().toISOString(),
    );
    await persist(next);
    if (name === "delete") {
      await deleteBreadcrumbRecord(analysisJobId, track.id).catch(() => setMessage("Delete is pending synchronization."));
      setTrack(null);
    } else {
      await updateBreadcrumbRecord(analysisJobId, track.id, {
        name: next.name,
        status: next.status,
        endedAt: next.endedAt,
      }).catch(() => setMessage("Breadcrumb change is pending synchronization."));
    }
    if (name === "finish" || name === "delete") {
      await stopLocationTaskIfStarted(Location, BREADCRUMB_TASK);
    }
  }

  async function handoff() {
    if (!destination) return;
    const query = `${destination.latitude},${destination.longitude}`;
    await Linking.openURL(
      Platform.OS === "ios"
        ? `http://maps.apple.com/?daddr=${query}`
        : `https://www.google.com/maps/dir/?api=1&destination=${query}`,
    );
  }

  return <View style={s.card}>
    <Text ref={titleRef} accessibilityRole="header" style={s.title}>Field Navigation</Text>
    <Text style={s.meta}>Location starts only when requested. Guidance and destination line are straight-line; confirm field conditions.</Text>
    <View style={s.row}>
      <Button label={locating ? "Locating…" : "Center / Follow"} onPress={locate} disabled={locating} busy={locating} />
      <Button label={follow ? "Following" : "Follow off"} onPress={toggleFollow} />
    </View>
    {location && <Text style={s.meta}>Accuracy ±{Math.round(location.accuracy || 0)} m · updated {new Date(location.recordedAt).toLocaleTimeString()} {nav?.stale ? "· STALE" : ""}{location.altitude != null ? ` · altitude ${Math.round(location.altitude)} m` : ""}{location.heading != null ? ` · heading ${Math.round(location.heading)}°` : ""}{location.speed != null ? ` · speed ${location.speed.toFixed(1)} m/s` : ""}</Text>}
    <Text style={s.meta}>Destination</Text>
    {waypoints.map((waypoint) => <Button key={waypoint.id} label={waypoint.title || "Untitled waypoint"} onPress={() => { setSelected(waypoint); onSelectTarget?.(waypoint); }} primary={selected?.id === waypoint.id} />)}
    {nav && <>
      <View style={s.line} />
      <Text style={s.metric}>{Math.round(nav.distanceMeters)} m · {Math.round(nav.bearingDegrees)}° · arrival radius {nav.arrivalRadiusMeters} m {nav.arrived ? "· ARRIVED" : ""}</Text>
      <Button label="Open road navigation" onPress={handoff} />
    </>}
    <View style={s.row}>
      {!track && <Button label="Start Breadcrumb" onPress={start} primary />}
      {track?.status === "active" && <Button label="Pause" onPress={() => action("pause")} />}
      {track?.status === "paused" && <Button label="Resume" onPress={() => action("resume")} primary />}
      {track && track.status !== "finished" && <Button label="Finish / Stop" onPress={() => action("finish")} />}
      {track && <Button label="Rename" onPress={() => action("rename")} />}
      {track && <Button label="Delete" onPress={() => action("delete")} />}
    </View>
    {track && <Text style={s.active}>● Background breadcrumb {track.status}. Use Finish / Stop to end.</Text>}
    {message && <Text accessibilityLiveRegion="polite" style={s.warn}>{message}</Text>}
  </View>;
}

function Button({ label, onPress, primary, disabled = false, busy = false }) {
  return <Pressable
    accessibilityRole="button"
    accessibilityState={{ selected: Boolean(primary), disabled, busy }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [s.button, primary && s.primary, disabled && s.disabled, pressed && s.pressed]}
  >
    <Text style={[s.buttonText, primary && s.primaryText]}>{label}</Text>
  </Pressable>;
}

const s = StyleSheet.create({
  card: { backgroundColor: "#111812", padding: 16, borderRadius: 18, gap: 10, borderWidth: 1, borderColor: "#344333" },
  title: { color: "#fff", fontWeight: "800", fontSize: 18 },
  meta: { color: "#aab7a5", lineHeight: 20 },
  metric: { color: "#f0d293", fontWeight: "700" },
  line: { height: 3, backgroundColor: "#5aa7ff", borderRadius: 3 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  button: { minHeight: 48, justifyContent: "center", backgroundColor: "#283329", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: "#3b4b3a" },
  primary: { backgroundColor: "#d0a65d", borderColor: "#e5c682" },
  disabled: { opacity: .55 },
  pressed: { opacity: .76, transform: [{ scale: .985 }] },
  buttonText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  primaryText: { color: "#19140d" },
  active: { color: "#8ed17c", fontWeight: "700" },
  warn: { color: "#e3b26d" },
});
