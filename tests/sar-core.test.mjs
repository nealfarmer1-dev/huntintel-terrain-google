import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Android SAR is user-initiated, visibly stoppable, and uses a location foreground service", async () => {
  const [ui, controller, background, tracking] = await Promise.all([
    readFile(new URL("../src/SarScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/useSarController.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/sar-background.js", import.meta.url), "utf8"),
    readFile(new URL("../src/location-tracking.js", import.meta.url), "utf8"),
  ]);

  assert.match(ui, /LIVE SHARING ACTIVE/);
  assert.match(ui, /Stop sharing/);
  assert.match(ui, /controller\.startShare\(true, onRequestLocation\)/);
  assert.match(controller, /startSarSharing\(active\.id, background\)/);
  assert.match(background, /startUserInitiatedLocationTask/);
  assert.match(tracking, /foregroundService/);
  assert.match(tracking, /HuntIntel live SAR sharing/);
  assert.doesNotMatch(ui + background + tracking, /requestBackgroundPermissionsAsync|getBackgroundPermissionsAsync/);
  assert.doesNotMatch(background, /queueOfflineOperation/);
});
