import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { appendBreadcrumbDisplayPoint } from "../src/breadcrumb-geometry.js";
import { sarAssignmentsFeatureCollection, sarParticipantLabel, sarPositionsFeatureCollection, setSarPositionsJavaScript } from "../src/sar-map.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("SAR positions are geographic GeoJSON with private labels and distinct stale state", () => {
  const now = Date.parse("2026-08-05T12:00:00Z");
  const collection = sarPositionsFeatureCollection([
    { userId: "me", email: "private@example.com", latitude: 35.2, longitude: -86.7, accuracyMeters: 8, receivedAt: "2026-08-05T11:59:59Z" },
    { userId: "other", email: "long-private-address@example.com", latitude: 48.9, longitude: -122.1, accuracyMeters: 42, receivedAt: "2026-08-05T11:58:00Z" },
  ], "me", now);
  assert.deepEqual(collection.features.map((feature) => feature.geometry.coordinates), [[-86.7, 35.2], [-122.1, 48.9]]);
  assert.equal(collection.features[0].properties.label, "You");
  assert.equal(collection.features[1].properties.label, "Team member");
  assert.equal(collection.features[0].properties.state, "current");
  assert.equal(collection.features[1].properties.state, "stale");
  assert.doesNotMatch(JSON.stringify(collection), /private@example\.com|long-private-address/);
  assert.equal(sarParticipantLabel({ displayName: "Ridge Team", email: "hidden@example.com" }), "Ridge Team");
});

test("SAR assignments stay linked to real waypoint coordinates", () => {
  const collection = sarAssignmentsFeatureCollection(
    [{ id: "assignment-1", waypointId: "waypoint-1", title: "Search drainage" }, { id: "missing", waypointId: "missing" }],
    [{ id: "waypoint-1", geometry: { type: "Point", coordinates: [-85.5, 34.5] } }],
  );
  assert.equal(collection.features.length, 1);
  assert.deepEqual(collection.features[0].geometry.coordinates, [-85.5, 34.5]);
});

test("active breadcrumb display keeps updating on the SAR route without changing SAR sharing", async () => {
  const active = { id: "trail", analysisJobId: "analysis-1", status: "active", points: [{ recordedAt: "2026-08-05T11:59:00Z", latitude: 34, longitude: -85 }] };
  const location = { recordedAt: "2026-08-05T12:00:00Z", latitude: 34.1, longitude: -85.1, accuracy: 6 };
  const next = appendBreadcrumbDisplayPoint(active, location, "analysis-1");
  assert.equal(next.points.length, 2);
  assert.deepEqual(next.points[1], { clientPointId: "sar-display:2026-08-05T12:00:00Z", latitude: 34.1, longitude: -85.1, accuracyMeters: 6, altitudeMeters: null, headingDegrees: null, speedMps: null, recordedAt: "2026-08-05T12:00:00Z" });
  assert.equal(appendBreadcrumbDisplayPoint(next, location, "analysis-1"), next);
  assert.equal(appendBreadcrumbDisplayPoint({ ...active, status: "paused" }, location, "analysis-1").points.length, 1);
  const app = await read("../App.tsx");
  assert.match(app, /if\(screen!=="sar"\|\|!userLocation\?\.recordedAt\)return/);
  assert.match(app, /appendBreadcrumbDisplayPoint\(current,userLocation,analysisJobId\)/);
});

test("Back to Analysis is navigation-only and app ownership survives SarScreen unmount", async () => {
  const [app, screen, controller] = await Promise.all([read("../App.tsx"), read("../src/SarScreen.tsx"), read("../src/useSarController.ts")]);
  const backBody = app.slice(app.indexOf("async function returnFromSar"), app.indexOf("const downloadOffline"));
  assert.match(backBody, /setScreen\("results"\)/);
  assert.doesNotMatch(backBody, /stopSarSharing|endSarSession|stopPolling|setSharing/);
  assert.match(app, /const sar=useSarController\(\{enabled:Boolean\(account\),currentLocation:userLocation\}\)/);
  assert.ok(app.indexOf("useSarController") < app.indexOf('screen === "sar" && <SarScreen'));
  assert.doesNotMatch(screen, /stopSarSharing|endSarSession|setInterval|clearInterval/);
  assert.match(controller, /timer\.current = setInterval/);
  assert.match(controller, /if \(!enabled\)/);
  assert.match(controller, /wasEnabled\.current/);
});

test("sharing actions and destructive end remain semantically separate", async () => {
  const [screen, controller] = await Promise.all([read("../src/SarScreen.tsx"), read("../src/useSarController.ts")]);
  assert.match(screen, /End Live SAR Session\?/);
  assert.match(screen, /This will end the SAR session for all participants and stop active location sharing\. This action cannot be undone\./);
  assert.match(screen, /text: "Cancel"/);
  assert.match(screen, /text: "End Session"/);
  const stopBody = controller.slice(controller.indexOf("const stopShare"), controller.indexOf("const end ="));
  assert.match(stopBody, /stopSarSharing\(active\.id\)/);
  assert.doesNotMatch(stopBody, /endSarSession|setSession\(null\)/);
  const endBody = controller.slice(controller.indexOf("const end ="), controller.indexOf("const setAppActive"));
  assert.equal((endBody.match(/await endSarSession\(active\.id\)/g) || []).length, 1);
  assert.match(endBody, /endInFlight\.current/);
});

test("online and offline maps update SAR sources in place without percentage plotting", async () => {
  const [app, offline, workflow, screen] = await Promise.all([read("../App.tsx"), read("../src/offline-pipeline.js"), read("../src/sar-workflow.js"), read("../src/SarScreen.tsx")]);
  assert.match(app, /addSource\('sar-team-positions'/);
  assert.match(app, /getSource\('sar-team-positions'\)\.setData/);
  assert.match(app, /__terrainSetSarAssignments/);
  assert.match(app, /analysis-polygon/);
  assert.match(app, /field-breadcrumbs/);
  assert.match(offline, /__terrainSetSarPositions/);
  assert.match(offline, /__terrainSetSarAssignments/);
  assert.doesNotMatch(workflow + screen, /sarPositionPlot|xPercent|yPercent/);
  assert.match(setSarPositionsJavaScript({ type: "FeatureCollection", features: [] }, false), /__terrainSetSarPositions/);
});

test("every interactive map gets accessible controlled fullscreen and Android collapse-first", async () => {
  const [app, map, offline] = await Promise.all([read("../App.tsx"), read("../src/NativeTerrainMap.tsx"), read("../src/offline-pipeline.js")]);
  assert.equal((app.match(/<NativeTerrainMap/g) || []).length, 1);
  assert.match(map, /Expand map to full screen/);
  assert.match(map, /Exit full-screen map/);
  assert.match(map, /accessibilityState=\{\{ expanded \}\}/);
  assert.match(map, /<Modal visible/);
  assert.match(map, /onRequestClose=\{\(\) => setMapExpanded\(false\)\}/);
  assert.match(app, /if \(mapExpanded\) \{ setMapExpanded\(false\); return true; \}/);
  assert.match(map, /window\.__terrainSetCamera/);
  assert.match(app, /window\.__terrainSelect/);
  assert.match(offline, /window\.__terrainSetCamera/);
});

test("team-position visibility changes only its independent map layers", async () => {
  const app = await read("../App.tsx");
  assert.match(app, /setLayerVisibility\(\['sar-team-accuracy','sar-team-position-dot','sar-team-position-label'\],visible!==false\)/);
  assert.doesNotMatch(setSarPositionsJavaScript({ type: "FeatureCollection", features: [] }, false), /analysis-polygon|field-breadcrumbs|user-location/);
  assert.match(app, /No opted-in team positions are currently available|SarScreen/);
});
