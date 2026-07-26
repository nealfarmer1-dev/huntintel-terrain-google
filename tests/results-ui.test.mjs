import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../App.tsx", import.meta.url), "utf8");
const tabs = await readFile(new URL("../src/AnalysisResultsTabs.tsx", import.meta.url), "utf8");
const navigation = await readFile(new URL("../src/NavigationPanel.tsx", import.meta.url), "utf8");
const api = await readFile(new URL("../src/api.js", import.meta.url), "utf8");
const pdf = await readFile(new URL("../src/PdfReportPanel.tsx", import.meta.url), "utf8");

test("native results retain one centralized ID selection model and bounded compact lists", () => {
  assert.match(app, /useState<any>\(createResultsState\(\)\)/);
  assert.match(tabs, /slice\(0, resultsUi\.waypointLimit\)/);
  assert.match(tabs, /key=\{waypoint\.id\}/);
  assert.match(tabs, /key=\{feature\.id\}/);
  assert.doesNotMatch(tabs, /key=\{index\}/);
});

test("native result tabs keep Navigation and Field Records mounted while hidden", () => {
  for (const id of ["waypoints", "features", "navigation", "records"]) assert.match(tabs, new RegExp(`activeResultsTab === "${id}"`));
  assert.match(tabs, /<NavigationPanel key=\{analysisJobId\}/);
  assert.match(tabs, /<FieldRecordsScreen key=\{analysisJobId\}/);
  assert.match(tabs, /hidden: \{ display: "none" \}/);
});

test("native Mapbox bridge supports point line polygon selection and reverse ID selection", () => {
  for (const layer of ["analysis-features-fill", "analysis-features-line", "analysis-features-circle", "analysis-selection-fill", "analysis-selection-line", "analysis-selection-circle"]) assert.match(app, new RegExp(layer));
  assert.match(app, /result-select/);
  assert.match(app, /entityType:'terrainFeature'/);
  assert.match(app, /entityType:'waypoint'/);
  assert.match(app, /mapWebRef\.current\?\.injectJavaScript/);
});

test("waypoint map taps retain ID selection and use normalized, safe popup details", () => {
  assert.match(app, /__popup: waypointDetails\(waypoint\)/);
  assert.match(tabs, /const waypoint = type === "waypoint" \? waypointDetails\(entity\) : null/);
  assert.match(app, /post\('result-select',\{entityType:'waypoint',id:id\}\);showWaypointPopup\(item,e\.lngLat\)/);
  assert.match(app, /node\.textContent=String\(value==null\?'':value\)/);
  assert.doesNotMatch(app, /\.setHTML\(/);
  for (const detail of ["waypoint-popup-title", "waypoint-popup-type", "waypoint-popup-reason", "waypoint-popup-metric", "waypoint-popup-geometry"]) {
    assert.match(app, new RegExp(detail));
  }
  assert.match(app, /activeWaypointPopupId=item\.id/);
  assert.match(app, /command\.type!=='waypoint'\|\|command\.id!==activeWaypointPopupId/);
});

test("popup navigation requests location once and makes Field Navigation visible", () => {
  assert.match(app, /post\('waypoint-navigate',\{id:item\.id\}\)/);
  assert.match(app, /navigableWaypointById\(analysis,id\)/);
  assert.match(app, /navigateToResult\(waypoint,true\)/);
  assert.match(app, /setNavigationRequestNonce\(\(current\)=>current\+1\)/);
  assert.match(app, /scrollResponderScrollNativeHandleToKeyboard\(nativeHandle,24,true\)/);
  assert.match(app, /navigationRequestNonce=\{navigationRequestNonce\}/);
  assert.match(app, /onNavigationRequestVisible=\{revealNavigationPanel\}/);
  assert.match(tabs, /navigationRequestNonce=\{navigationRequestNonce\}/);
  assert.match(tabs, /onRequestVisible=\{onNavigationRequestVisible\}/);
  assert.match(navigation, /nonce <= 0 \|\| lastNavigationRequestRef\.current === nonce/);
  assert.match(navigation, /void locate\(\)/);
  assert.match(navigation, /onRequestVisible\?\.\(titleNode\)/);
  assert.match(navigation, /AccessibilityInfo\.setAccessibilityFocus\(titleNode\)/);
});

test("field location watch prevents concurrent starts and owns its subscription lifecycle", () => {
  assert.match(navigation, /if \(locatingRef\.current\) return false/);
  assert.match(navigation, /if \(watchRef\.current\)/);
  assert.match(navigation, /watchRef\.current = subscription/);
  assert.match(navigation, /subscription\.remove\(\)/);
  assert.match(navigation, /stopLocationWatch\(\)/);
  assert.match(navigation, /return \(\) => \{[\s\S]+?mountedRef\.current = false[\s\S]+?stopLocationWatch\(\)/);
  assert.match(navigation, /function toggleFollow\(\) \{[\s\S]+?stopLocationWatch\(\);[\s\S]+?setFollow\(false\)/);
  assert.match(navigation, /if \(!mountedRef\.current \|\| !desiredFollowRef\.current\) \{[\s\S]+?subscription\.remove\(\)/);
  assert.match(navigation, /desiredFollowRef\.current = false;[\s\S]+?setFollow\(false\);[\s\S]+?setMessage\("Current location is unavailable/);
});

test("waypoint popup is bounded and exposes 44 point close and navigation targets", () => {
  assert.match(app, /max-height:min\(290px,calc\(100vh - 28px\)\)/);
  assert.match(app, /overflow-y:auto/);
  assert.match(app, /\.mapboxgl-popup-close-button\{width:44px;height:44px/);
  assert.match(app, /\.waypoint-popup-navigate\{width:100%;min-height:44px/);
});

test("native tab and selection state are excluded from memoized map HTML dependencies", () => {
  const memo = app.match(/const mapSourceResult=useMemo\([\s\S]+?\n  },\[[^\n]+\]\);/)?.[0] || "";
  assert.ok(memo);
  assert.doesNotMatch(memo, /resultsUi/);
  assert.match(app, /const usingOfflinePackage = offlineManifest\?\.analysisJobId===analysis\?\.analysisJobId[\s\S]*sourceResult=\{mapSourceResult\}/);
});

test("native report PDF field records and exact analysis identifiers remain wired without Analysis Tour", () => {
  for (const value of ["Key Findings", "Scouting Notes", "Limitations", "PdfReportPanel", "AnalysisResultsTabs", "analysisJobId"]) assert.match(app, new RegExp(value));
  assert.doesNotMatch(app + tabs, /Analysis Tour|analysisTour|analysis_tour/);
  assert.match(api, /requireAnalysisJobId\(features, analysisJobId/);
  assert.match(pdf, /artifact\?\.analysisJobId!==analysisJobId/);
  assert.match(app, /analysisLoadGeneration/);
  assert.match(app, /generation!==analysisLoadGeneration\.current/);
});
