import React, { Component, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { createMapRetryController, parseTerrainMapMessage, terrainMapDiagnostic, TERRAIN_MAP_FAILURE_MESSAGE } from "./map-runtime";

type MapSourceResult = { ok: true; source: { html: string }; code: null; userMessage: null } | { ok: false; source: null; code: string; userMessage: string };
type MapStatus = "idle" | "loading" | "ready" | "error";

function MapFailureCard({ message = TERRAIN_MAP_FAILURE_MESSAGE, retrying = false, onRetry, onBack }: { message?: string; retrying?: boolean; onRetry: () => void; onBack: () => void }) {
  return <View accessibilityRole="alert" style={styles.failure}>
    <Text style={styles.failureTitle}>The terrain map could not be loaded.</Text>
    <Text style={styles.failureMessage}>{message === TERRAIN_MAP_FAILURE_MESSAGE ? "Check your connection and try again." : message}</Text>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel="Retry terrain map" accessibilityState={{ disabled: retrying, busy: retrying }} disabled={retrying} onPress={onRetry} style={[styles.button, styles.primary, retrying && styles.disabled]}>
        {retrying && <ActivityIndicator size="small" color="#19140d" />}
        <Text style={styles.primaryText}>{retrying ? "Retrying…" : "Retry Map"}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Back from terrain map" onPress={onBack} style={styles.button}><Text style={styles.buttonText}>Back</Text></Pressable>
    </View>
  </View>;
}

export class TerrainMapErrorBoundary extends Component<{ children: React.ReactNode; onBack: () => void; resetKey: string }, { failed: boolean; retry: number }> {
  state = { failed: false, retry: 0 };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() {
    terrainMapDiagnostic("terrain_map_error_boundary", { platform: Platform.OS, stage: "react", category: "MAP_REACT_BOUNDARY", setupActive: true });
  }
  componentDidUpdate(previous: Readonly<{ resetKey: string }>) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }
  retry = () => {
    terrainMapDiagnostic("terrain_map_retry", { platform: Platform.OS, stage: "react", category: "MAP_REACT_BOUNDARY", setupActive: true });
    this.setState((state) => ({ failed: false, retry: state.retry + 1 }));
  };
  render() {
    if (this.state.failed) return <MapFailureCard onRetry={this.retry} onBack={this.props.onBack} />;
    return React.createElement(React.Fragment, { key: this.state.retry }, this.props.children);
  }
}

export function NativeTerrainMap({ sourceResult, height, mapRef, onMessage, onStatusChange, onBack, onRetrySource, showLocationControl, locationControl, offline = false, WebViewComponent = WebView }: any) {
  const [status, setStatus] = useState<MapStatus>(sourceResult.ok ? "idle" : "error");
  const [errorMessage, setErrorMessage] = useState(sourceResult.userMessage || TERRAIN_MAP_FAILURE_MESSAGE);
  const [reload, setReload] = useState(0);
  const retry = useRef(createMapRetryController());
  const activeInstance = useRef(reload);
  const previousSourceOk = useRef(sourceResult.ok);
  activeInstance.current = reload;

  const updateStatus = (next: MapStatus) => {
    setStatus(next);
    onStatusChange?.(next);
  };
  const fail = (category: string, message = TERRAIN_MAP_FAILURE_MESSAGE, event = "terrain_map_webview_failed") => {
    retry.current.finish();
    setErrorMessage(message);
    updateStatus("error");
    terrainMapDiagnostic(event, { platform: Platform.OS, stage: "webview", category, setupActive: true });
  };
  const ready = () => {
    retry.current.finish();
    updateStatus("ready");
    terrainMapDiagnostic("terrain_map_mount_ready", { platform: Platform.OS, stage: "webview", category: offline ? "OFFLINE" : "ONLINE", setupActive: true });
  };
  const retryMap = () => {
    if (!retry.current.begin()) return;
    terrainMapDiagnostic("terrain_map_retry", { platform: Platform.OS, stage: "webview", category: "USER_RETRY", setupActive: true });
    updateStatus("loading");
    if (!sourceResult.ok) {
      onRetrySource?.();
      return;
    }
    setReload((value) => value + 1);
  };

  useEffect(() => {
    const wasValid = previousSourceOk.current;
    previousSourceOk.current = sourceResult.ok;
    if (!sourceResult.ok) fail(sourceResult.code, sourceResult.userMessage);
    else if (!wasValid) {
      retry.current.finish();
      setErrorMessage(TERRAIN_MAP_FAILURE_MESSAGE);
      updateStatus("idle");
    }
  }, [sourceResult]);
  useEffect(() => {
    if (status !== "loading") return;
    const timeout = setTimeout(() => fail("MAP_LOAD_TIMEOUT"), 12000);
    return () => clearTimeout(timeout);
  }, [status, reload]);

  if (!sourceResult.ok) return <MapFailureCard message={sourceResult.userMessage} retrying={retry.current.isInFlight()} onRetry={retryMap} onBack={onBack} />;

  const processProps = Platform.OS === "ios"
    ? { onContentProcessDidTerminate: () => { if (activeInstance.current === reload) fail("MAP_CONTENT_PROCESS_TERMINATED", TERRAIN_MAP_FAILURE_MESSAGE, "terrain_map_content_process_terminated"); } }
    : { onRenderProcessGone: () => { if (activeInstance.current === reload) fail("MAP_RENDER_PROCESS_GONE", TERRAIN_MAP_FAILURE_MESSAGE, "terrain_map_content_process_terminated"); } };

  return <View style={[styles.map, { height }]}>
    <WebViewComponent
      key={`terrain-map-${reload}`}
      originWhitelist={["*"]}
      {...(Platform.OS === "android" ? { geolocationEnabled: true } : {})}
      ref={mapRef}
      source={sourceResult.source}
      onLoadStart={() => {
        if (activeInstance.current !== reload) return;
        retry.current.begin();
        updateStatus("loading");
        terrainMapDiagnostic("terrain_map_mount_started", { platform: Platform.OS, stage: "webview", category: offline ? "OFFLINE" : "ONLINE", setupActive: true });
      }}
      onLoadEnd={() => { if (activeInstance.current === reload && offline) ready(); }}
      onError={() => { if (activeInstance.current === reload) fail("MAP_WEBVIEW_ERROR"); }}
      onHttpError={() => { if (activeInstance.current === reload) fail("MAP_HTTP_ERROR"); }}
      onMessage={(event: any) => {
        if (activeInstance.current !== reload) return;
        const parsed = parseTerrainMapMessage(event.nativeEvent?.data);
        if (!parsed.ok) {
          terrainMapDiagnostic("terrain_map_message_ignored", { platform: Platform.OS, stage: "bridge", category: parsed.code, setupActive: true });
          return;
        }
        if (parsed.message.type === "map-ready") ready();
        if (parsed.message.type === "map-error") fail("MAP_BRIDGE_ERROR");
        onMessage(parsed.message);
      }}
      renderError={() => <View style={styles.webFallback} />}
      {...processProps}
      style={styles.webView}
    />
    {status === "loading" && <View pointerEvents="none" style={styles.overlay}><ActivityIndicator color="#d0a65d" /><Text style={styles.meta}>Loading map…</Text></View>}
    {status === "error" && <View style={styles.overlay}><MapFailureCard message={errorMessage} retrying={retry.current.isInFlight()} onRetry={retryMap} onBack={onBack} /></View>}
    {showLocationControl && status !== "error" ? locationControl : null}
  </View>;
}

const styles = StyleSheet.create({
  map: { borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: "#314a35", marginVertical: 14, backgroundColor: "#0b0f0c", position: "relative" },
  webView: { flex: 1, backgroundColor: "#0b0f0c" },
  webFallback: { flex: 1, backgroundColor: "#0b0f0c" },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 12, padding: 20, backgroundColor: "rgba(11,15,12,.96)" },
  meta: { color: "#9cab97", lineHeight: 20 },
  failure: { width: "100%", maxWidth: 460, gap: 10, padding: 16, borderRadius: 16, backgroundColor: "#182019", borderWidth: 1, borderColor: "#5a3029" },
  failureTitle: { color: "#f0f3ea", fontSize: 17, fontWeight: "800" },
  failureMessage: { color: "#d68375", lineHeight: 20 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  button: { minHeight: 48, minWidth: 92, paddingHorizontal: 16, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, backgroundColor: "#243025", borderWidth: 1, borderColor: "#3b4b3a" },
  primary: { backgroundColor: "#d0a65d", borderColor: "#e5c682" },
  buttonText: { color: "#f0f3ea", fontWeight: "700" },
  primaryText: { color: "#19140d", fontWeight: "800" },
  disabled: { opacity: .55 },
});
