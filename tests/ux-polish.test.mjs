import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Android shell, setup, and processing states expose clear hierarchy and exits", async () => {
  const app = await read("../App.tsx");
  assert.match(app, /Platform\.OS === "android" && primaryNavigation/);
  assert.match(app, /androidNavBar/);
  assert.match(app, /accessibilityRole="tablist"/);
  assert.match(app, /Name and mode → Draw area → Confirm acreage and price → Review & Purchase/);
  assert.match(app, /Setup changed\. Confirm acreage and price again\./);
  assert.match(app, /accessibilityHint=\{setupPhase==="quoted" \? "Opens the one-time Google Play purchase screen for this terrain analysis" : purchaseAction\.message\}/);
  assert.match(app, /accessibilityLabel="Terrain analysis is running"/);
  assert.match(app, /This may take several minutes/);
  assert.match(app, /View My Analyses/);
});

test("map failures stay layout-stable and retain accessible recovery", async () => {
  const map = await read("../src/NativeTerrainMap.tsx");
  assert.match(map, /fullScreen \? styles\.fullScreenMap : \{ height \}/);
  assert.match(map, /Retry terrain map/);
  assert.match(map, /Back from terrain map/);
  assert.match(map, /onRenderProcessGone/);
  assert.match(map, /retry\.current\.begin\(\)/);
});

test("purchase, library, results, and shared controls use explicit state feedback", async () => {
  const [payment, library, results, navigation, ui] = await Promise.all([
    read("../src/PaymentGate.tsx"),
    read("../src/LibraryScreen.tsx"),
    read("../src/AnalysisResultsTabs.tsx"),
    read("../src/NavigationPanel.tsx"),
    read("../src/NativeUi.tsx"),
  ]);
  for (const label of ["Waiting for Google Play", "Verifying purchase", "Recovering purchase", "Analysis running", "Action needed"]) assert.match(payment, new RegExp(label));
  assert.match(payment, /accessibilityLiveRegion="polite"/);
  assert.match(library, /selected for deletion/);
  assert.match(library, /Clear Selection/);
  assert.match(library, /Delete Analysis/);
  assert.doesNotMatch(results, /\|\| entity\.id/);
  assert.doesNotMatch(navigation, /label=\{w\.title\|\|w\.id\}/);
  assert.match(results, /accessibilityHint="Selects this waypoint and shows it on the map"/);
  assert.match(ui, /loadingLabel \|\| `\$\{label\}…`/);
});

test("responsive and account safety contracts remain visible", async () => {
  const [app, account, results] = await Promise.all([read("../App.tsx"), read("../src/AccountScreen.tsx"), read("../src/AnalysisResultsTabs.tsx")]);
  assert.match(app, /containerWide: \{ maxWidth: 980/);
  assert.match(app, /minHeight: 48/);
  assert.match(account, /contentInsetAdjustmentBehavior="automatic"/);
  assert.match(account, /style=\{styles\.headerCopy\}/);
  assert.match(account, /headerCopy:\{flex:1,minWidth:0\}/);
  assert.match(results, /<View style=\{s\.tabs\} accessibilityRole="tablist">/);
  assert.match(results, /tabs: \{ flexDirection: "row", flexWrap: "wrap"/);
  assert.match(account, /Deleting your account is permanent and removes associated account data\./);
  assert.match(account, /Your HuntIntel account and associated data will be permanently deleted\. This action cannot be undone\./);
  assert.match(account, /label="Back"/);
});
