import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  acquireCenterLocation,
  centerLocationJavaScript,
} from "../src/location-control.js";

test("location permission is requested only while undetermined", async () => {
  let requests = 0;
  const granted = await acquireCenterLocation({
    Accuracy: { High: 5 },
    getForegroundPermissionsAsync: async () => ({ status: "undetermined", canAskAgain: true }),
    requestForegroundPermissionsAsync: async () => { requests += 1; return { status: "granted", canAskAgain: true }; },
    getLastKnownPositionAsync: async () => ({ coords: { latitude: 32.6, longitude: -87, accuracy: 12 } }),
  });
  assert.equal(requests, 1);
  assert.equal(granted.status, "granted");

  requests = 0;
  await acquireCenterLocation({
    getForegroundPermissionsAsync: async () => ({ status: "granted" }),
    requestForegroundPermissionsAsync: async () => { requests += 1; },
    getLastKnownPositionAsync: async () => ({ coords: { latitude: 32.6, longitude: -87 } }),
  });
  assert.equal(requests, 0);
});

test("denied and unavailable locations return explicit states", async () => {
  const denied = await acquireCenterLocation({
    getForegroundPermissionsAsync: async () => ({ status: "denied", canAskAgain: false }),
  });
  assert.deepEqual({ status: denied.status, canAskAgain: denied.canAskAgain }, { status: "denied", canAskAgain: false });

  const unavailable = await acquireCenterLocation({
    getForegroundPermissionsAsync: async () => ({ status: "granted" }),
    getLastKnownPositionAsync: async () => null,
    getCurrentPositionAsync: async () => { throw new Error("GPS timeout"); },
  });
  assert.equal(unavailable.status, "unavailable");
});

test("center command updates only the location and camera bridge", () => {
  const script = centerLocationJavaScript({ latitude: 32.6, longitude: -87 });
  assert.match(script, /__terrainCenterLocation/);
  assert.match(script, /"latitude":32\.6/);
  assert.doesNotMatch(script, /polygon|analysis|reload/i);
});

test("Android map exposes an accessible lower-right 48dp location control", async () => {
  const source = await readFile(new URL("../App.tsx", import.meta.url), "utf8");
  assert.match(source, /accessibilityLabel="Center map on current location"/);
  assert.match(source, /accessibilityState=\{\{ selected: userLocationEnabled, busy: locatingUser/);
  assert.match(source, /locationControl: \{ position: "absolute", right: 14, bottom: 58/);
  assert.match(source, /width: 48, height: 48/);
  assert.match(source, /Ionicons name=\{userLocationEnabled \? "locate" : "locate-outline"\}/);
  assert.match(source, /window\.__terrainCenterLocation/);
  assert.doesNotMatch(source, /id="locate-me"|>LOC</);
});
