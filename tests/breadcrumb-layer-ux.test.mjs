import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { breadcrumbsFeatureCollection } from "../src/breadcrumb-geometry.js";
import { DEFAULT_LAYER_PREFERENCES, breadcrumbLayerStatus, shouldApplyHydratedActiveBreadcrumb, shouldShowBreadcrumbEmptyState, toggleLayer } from "../src/map-layers.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [app, tabs, navigation, support, offline] = await Promise.all([
  read("../App.tsx"),
  read("../src/AnalysisResultsTabs.tsx"),
  read("../src/NavigationPanel.tsx"),
  read("../src/support-content.js"),
  read("../src/offline-pipeline.js"),
]);

test("breadcrumb layer uses visibility-only copy and TalkBack semantics", () => {
  assert.match(app, />Show Breadcrumb Trails<\/Text>/);
  assert.doesNotMatch(app, /label=["']Breadcrumbs["']/);
  assert.match(app, /accessibilityRole="switch"/);
  assert.match(app, /accessibilityLabel="Show recorded breadcrumb trails"/);
  assert.match(app, /accessibilityHint="This does not start or stop breadcrumb recording\."/);
  assert.match(app, /accessibilityState=\{\{ checked: visible \}\}/);
  assert.match(app, /accessibilityValue=\{\{ text: status \}\}/);
  assert.match(app, /Shows recorded breadcrumb trails on the map\. To record a new trail, open Field Navigation and tap Start Breadcrumb\./);
});

test("visibility toggling cannot mutate or invoke breadcrumb recording controls", () => {
  const recording = { id: "trail", status: "active", points: [] };
  const hidden = toggleLayer(DEFAULT_LAYER_PREFERENCES, "field", "breadcrumbs");
  assert.equal(hidden.field.breadcrumbs, false);
  assert.equal(recording.status, "active");
  const shown = toggleLayer(hidden, "field", "breadcrumbs");
  assert.equal(shown.field.breadcrumbs, true);
  assert.equal(recording.status, "active");
  const toggleBinding = app.match(/<BreadcrumbLayerControl[^>]+onToggle=\{\(\)=>setLayers\(toggleLayer\(layerPreferences,"field","breadcrumbs"\)\)\}[^>]*\/>/)?.[0] || "";
  assert.ok(toggleBinding);
  assert.doesNotMatch(toggleBinding, /start|stop|pause|finish|Location/i);
});

test("empty, visible, and recording states reflect data without conflating visibility", () => {
  assert.equal(shouldShowBreadcrumbEmptyState({ visible: true, hasSelectedAnalysis: true }), true);
  assert.equal(shouldShowBreadcrumbEmptyState({ visible: false, hasSelectedAnalysis: true }), false);
  assert.equal(breadcrumbLayerStatus({ visible: true, recording: true }), "Recording · Visible");
  assert.equal(breadcrumbLayerStatus({ visible: false, recording: true }), "Recording · Hidden");
  assert.match(app, /No breadcrumb trails recorded for this analysis\. Open Field Navigation to start one\./);
  assert.match(app, /Recording continues while the trail is hidden\./);
  const response = { items: [{ id: "trail", analysisJobId: "a", points: [{ latitude: 1, longitude: 2 }, { latitude: 3, longitude: 4 }] }] };
  const rendered = breadcrumbsFeatureCollection([[response], []], "a");
  assert.deepEqual(rendered.features[0].geometry.coordinates, [[2, 1], [4, 3]]);
});

test("Open Field Navigation reveals the selected analysis without starting location or recording", () => {
  const handler = app.match(/const openFieldNavigationFromLayers=\(\)=>\{[^\n]+\};/)?.[0] || "";
  assert.match(handler, /activeResultsTab:"navigation"/);
  assert.match(handler, /setLayerSheetVisible\(false\)/);
  assert.match(handler, /setNavigationRevealNonce/);
  assert.doesNotMatch(handler, /start|stop|pause|finish|requestLiveLocation|mapCamera/i);
  assert.match(tabs, /revealRequestNonce=\{navigationRevealNonce\}/);
  const revealEffect = navigation.match(/useEffect\(\(\) => \{ if \(!revealRequestNonce[^\n]+/)?.[0] || "";
  assert.match(revealEffect, /AccessibilityInfo\.setAccessibilityFocus/);
  assert.doesNotMatch(revealEffect, /locate\(\)|Location|start\(/);
});

test("loading failures cannot claim no trails and layouts remain wrap-safe", () => {
  assert.match(app, /status:\[remoteResult,activeResult,offlineResult,fallbackResult\]\.every\(\(result\)=>result\.ok\)\?"ready":"unavailable"/);
  assert.match(app, /Trail status unavailable|breadcrumbUnavailable/);
  assert.match(app, /if\(shouldApplyHydratedActiveBreadcrumb\(\{requestId,currentRequestId:breadcrumbHydrationRequestRef\.current,startRevision,currentRevision:breadcrumbDisplayRevisionRef\.current\}\)\)setActiveBreadcrumb\(null\);setBreadcrumbLoadState/);
  assert.equal(breadcrumbLayerStatus({ visible: true, unavailable: true, recording: false }), "Trail status unavailable");
  assert.match(app, /breadcrumbToggle: \{ width: "100%", minHeight: 56/);
  assert.match(app, /breadcrumbToggleLabel: \{ flex: 1, minWidth: 0, flexShrink: 1/);
  assert.match(app, /breadcrumbDescription: \{[^}]+lineHeight: 20/);
});

test("deferred hydration cannot overwrite a newer recording display revision", async () => {
  let releaseHydration;
  const slowRemote = new Promise((resolve) => { releaseHydration = resolve; });
  const staleSnapshot = { id: "trail", status: "paused", points: [] };
  let displayed = staleSnapshot;
  const requestId = 1;
  let currentRequestId = requestId;
  const startRevision = 0;
  let currentRevision = startRevision;
  const completion = slowRemote.then(() => {
    if (shouldApplyHydratedActiveBreadcrumb({ requestId, currentRequestId, startRevision, currentRevision })) displayed = staleSnapshot;
  });
  displayed = { id: "trail", status: "active", points: [{ latitude: 1, longitude: 2 }] };
  currentRevision += 1;
  releaseHydration();
  await completion;
  assert.equal(displayed.status, "active");
  assert.equal(displayed.points.length, 1);
  currentRequestId += 1;
  assert.equal(shouldApplyHydratedActiveBreadcrumb({ requestId, currentRequestId, startRevision: currentRevision, currentRevision }), false);
  assert.match(app, /const requestId=\+\+breadcrumbHydrationRequestRef\.current/);
  assert.match(app, /startRevision=breadcrumbDisplayRevisionRef\.current/);
  assert.match(app, /onBreadcrumbChange=\{updateActiveBreadcrumbDisplay\}/);
  assert.match(app, /updateActiveBreadcrumbDisplay\(\(current:any\)=>appendBreadcrumbDisplayPoint/);
});

test("a map with no selected analysis cannot retain prior breadcrumb inputs", () => {
  assert.match(app, /breadcrumbInputs=useMemo\(\(\)=>hasSelectedAnalysis&&breadcrumbDataCurrent\?/);
  assert.deepEqual(breadcrumbsFeatureCollection([], "previous-analysis"), { type: "FeatureCollection", features: [] });
});

test("Help distinguishes showing trails from recording them", () => {
  assert.match(support, /title: "Show or Hide Breadcrumb Trails"/);
  assert.match(support, /only controls whether recorded trails are visible on the map\. It does not start or stop breadcrumb recording\./);
  assert.match(support, /open Field Navigation and tap Start Breadcrumb/);
  assert.match(support, /Turning the map layer off only hides the trail; recording continues until you pause or finish it\./);
  assert.match(support, /title: "Record a Breadcrumb"[\s\S]+Show Breadcrumb Trails in Map Layers only changes whether the route is visible/);
});

test("online, offline, expanded, and Live SAR maps share the same breadcrumb preference", () => {
  assert.match(app, /renderOfflineMapHtml\(value,layerPreferences\)/);
  assert.match(app, /buildMapHtml,\{[\s\S]+layerPreferences/);
  assert.match(app, /screen === "sar"[\s\S]+map=\{renderMap\(\)\}/);
  assert.match(app, /expanded=\{mapExpanded\}/);
  assert.match(offline, /layerPreferences\.field\?\.breadcrumbs===false/);
  assert.match(app, /layerPreferences\.field\.breadcrumbs===false\?'none':'visible'/);
});
