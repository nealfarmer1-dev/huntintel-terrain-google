import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { TERRAIN_ORIENTATION_KEY, TERRAIN_ORIENTATION_STEPS, completeOrientation, orientationCompleted, replayOrientation } from "../src/orientation.js";

const app = await readFile(new URL("../App.tsx", import.meta.url), "utf8");
const modal = await readFile(new URL("../src/OrientationModal.tsx", import.meta.url), "utf8");
const account = await readFile(new URL("../src/AccountScreen.tsx", import.meta.url), "utf8");
const memory = () => { const values = new Map(); return { getItemAsync: async (key) => values.get(key) ?? null, setItemAsync: async (key, value) => { values.set(key, value); } }; };

test("first launch, skip, finish, replay, and persistence share one durable orientation key", async () => {
  const storage = memory();
  assert.equal(await orientationCompleted(storage), false);
  await completeOrientation(storage); assert.equal(await orientationCompleted(storage), true);
  await replayOrientation(storage); assert.equal(await orientationCompleted(storage), false);
  assert.equal(TERRAIN_ORIENTATION_KEY, "huntintel.terrain.orientation.completed.v1");
  assert.equal(TERRAIN_ORIENTATION_STEPS.length, 7);
  for (const title of ["Draw an Area", "Run Terrain Analysis", "Review Results", "Save and Download", "Take It Into the Field"]) assert.equal(TERRAIN_ORIENTATION_STEPS.some((step) => step.title === title), true);
  assert.equal(TERRAIN_ORIENTATION_STEPS.some((step) => step.body.includes("supported mobile web browsers") && step.body.includes("native Apple and Google apps")), true);
  assert.equal(TERRAIN_ORIENTATION_STEPS.some((step) => step.bullets.includes("My Location remains unavailable on Web")), false);
  assert.match(modal, />Skip</); assert.match(modal, /last \? "Finish" : "Next"/); assert.match(app, /beginOrientationReplay/);
});

test("single gear navigates to the organized Account page", () => {
  assert.match(app, /accessibilityLabel="Open Account"[\s\S]*⚙︎/);
  assert.doesNotMatch(app, /Account & Security/);
  for (const label of ["Profile", "Email", "Storage usage", "Replay Orientation", "Downloads", "My Analyses", "Sign Out", "About HuntIntel Terrain Intelligence", "App Version", "Subscription"]) assert.match(account, new RegExp(label));
  assert.match(app, /onOpenDownloads/); assert.match(app, /onOpenAnalyses/);
});

test("existing analysis, team, SAR, and account-security flows remain available", () => {
  for (const label of ["My Analyses", "Teams", "Live SAR", "Change Password", "Delete Account"]) assert.match(app + account, new RegExp(label));
  assert.match(app, /loadLibrary\(1\)/); assert.match(account, /accountRequest\("\/change-password"/);
});
