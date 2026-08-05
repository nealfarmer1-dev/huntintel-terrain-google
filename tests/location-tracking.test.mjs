import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  breadcrumbLocationTaskOptions,
  sarLocationTaskOptions,
  startUserInitiatedLocationTask,
  stopLocationTaskIfStarted,
} from "../src/location-tracking.js";

function locationApi(permission, calls) {
  return {
    Accuracy: { High: 6 },
    getForegroundPermissionsAsync: async () => permission,
    requestForegroundPermissionsAsync: async () => {
      calls.foregroundRequests += 1;
      return permission;
    },
    requestBackgroundPermissionsAsync: async () => {
      calls.backgroundRequests += 1;
      throw new Error("Background permission must never be requested");
    },
    startLocationUpdatesAsync: async (taskName, options) => {
      calls.starts.push({ taskName, options });
    },
    hasStartedLocationUpdatesAsync: async () => calls.started,
    stopLocationUpdatesAsync: async (taskName) => {
      calls.stops.push(taskName);
    },
  };
}

for (const [feature, taskName, optionsFor] of [
  ["breadcrumb", "breadcrumb-task", breadcrumbLocationTaskOptions],
  ["live SAR", "sar-task", sarLocationTaskOptions],
]) {
  test(`${feature} tracking starts with foreground permission and never requests background permission`, async () => {
    const calls = { foregroundRequests: 0, backgroundRequests: 0, starts: [], stops: [], started: true };
    const api = locationApi({ status: "granted", canAskAgain: true }, calls);
    const result = await startUserInitiatedLocationTask(api, taskName, optionsFor(api));

    assert.equal(result.status, "started");
    assert.equal(calls.foregroundRequests, 0);
    assert.equal(calls.backgroundRequests, 0);
    assert.equal(calls.starts.length, 1);
    assert.equal(calls.starts[0].taskName, taskName);
    assert.ok(calls.starts[0].options.foregroundService.notificationTitle);
    assert.ok(calls.starts[0].options.foregroundService.notificationBody);
  });

  test(`${feature} tracking is blocked when foreground permission is denied`, async () => {
    const calls = { foregroundRequests: 0, backgroundRequests: 0, starts: [], stops: [], started: false };
    const api = locationApi({ status: "denied", canAskAgain: false }, calls);
    const result = await startUserInitiatedLocationTask(api, taskName, optionsFor(api));

    assert.equal(result.status, "denied");
    assert.equal(calls.foregroundRequests, 0);
    assert.equal(calls.backgroundRequests, 0);
    assert.equal(calls.starts.length, 0);
  });
}

test("tracking requests foreground permission when Android allows another prompt", async () => {
  const calls = { foregroundRequests: 0, backgroundRequests: 0, starts: [], stops: [], started: false };
  const api = locationApi({ status: "undetermined", canAskAgain: true }, calls);
  await startUserInitiatedLocationTask(api, "breadcrumb-task", breadcrumbLocationTaskOptions(api));
  assert.equal(calls.foregroundRequests, 1);
  assert.equal(calls.backgroundRequests, 0);
});

test("tracking stop removes an active task and is a no-op when already stopped", async () => {
  const calls = { foregroundRequests: 0, backgroundRequests: 0, starts: [], stops: [], started: true };
  const api = locationApi({ status: "granted" }, calls);
  assert.equal(await stopLocationTaskIfStarted(api, "breadcrumb-task"), true);
  assert.deepEqual(calls.stops, ["breadcrumb-task"]);

  calls.started = false;
  assert.equal(await stopLocationTaskIfStarted(api, "sar-task"), false);
  assert.deepEqual(calls.stops, ["breadcrumb-task"]);
});

test("Android config blocks background location and preserves location foreground-service permissions", async () => {
  const [appConfigText, manifest, moduleManifest] = await Promise.all([
    readFile(new URL("../app.json", import.meta.url), "utf8"),
    readFile(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8"),
    readFile(new URL("../node_modules/expo-location/android/src/main/AndroidManifest.xml", import.meta.url), "utf8"),
  ]);
  const appConfig = JSON.parse(appConfigText).expo;
  const locationPlugin = appConfig.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === "expo-location");

  assert.equal(locationPlugin[1].isAndroidBackgroundLocationEnabled, false);
  assert.equal(locationPlugin[1].isAndroidForegroundServiceEnabled, true);
  assert.ok(appConfig.android.blockedPermissions.includes("android.permission.ACCESS_BACKGROUND_LOCATION"));
  assert.ok(!appConfig.android.permissions.includes("android.permission.ACCESS_BACKGROUND_LOCATION"));
  for (const permission of [
    "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_LOCATION",
  ]) assert.ok(appConfig.android.permissions.includes(permission), `${permission} should remain configured`);

  assert.match(manifest, /ACCESS_BACKGROUND_LOCATION" tools:node="remove"/);
  assert.match(manifest, /android\.permission\.ACCESS_FINE_LOCATION/);
  assert.match(manifest, /android\.permission\.ACCESS_COARSE_LOCATION/);
  assert.match(manifest, /android\.permission\.FOREGROUND_SERVICE/);
  assert.match(manifest, /android\.permission\.FOREGROUND_SERVICE_LOCATION/);
  assert.match(moduleManifest, /android:foregroundServiceType="location"/);
});

test("breadcrumb and live SAR source contain no background-location permission checks", async () => {
  const sources = await Promise.all([
    "../src/NavigationPanel.tsx",
    "../src/SarScreen.tsx",
    "../src/useSarController.ts",
    "../src/sar-background.js",
    "../src/location-control.js",
    "../src/location-tracking.js",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  const source = sources.join("\n");

  assert.doesNotMatch(source, /requestBackgroundPermissionsAsync|getBackgroundPermissionsAsync/);
  assert.match(source, /Foreground location permission is required to record a breadcrumb/);
  assert.match(source, /Foreground location permission is required to share your location/);
  assert.match(source, /stopLocationTaskIfStarted/);
});
