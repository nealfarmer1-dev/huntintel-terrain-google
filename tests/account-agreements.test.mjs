import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const account = await readFile(new URL("../src/AccountScreen.tsx", import.meta.url), "utf8");
const api = await readFile(new URL("../src/api.js", import.meta.url), "utf8");

test("Google registration has two independent accessible agreements", () => {
  assert.match(account, /termsAccepted, setTermsAccepted/);
  assert.match(account, /privacyAccepted, setPrivacyAccepted/);
  assert.doesNotMatch(account, /waiver_accepted|Hold Harmless|agreementsAccepted/);
  assert.match(account, /accessibilityRole="checkbox"/);
  assert.match(account, /accessibilityRole="link"/);
  assert.match(account, /minHeight:48/);
  assert.match(account, /disabled=\{mode === "register" && \(!termsAccepted \|\| !privacyAccepted\)\}/);
  assert.match(account, /https:\/\/app\.huntintelapp\.com\/legal\/terms/);
  assert.match(account, /https:\/\/app\.huntintelapp\.com\/legal\/privacy/);
});

test("Google registration and resend remain on the Terrain account proxy", () => {
  assert.match(api, /`\/api\/account\$\{path\}`/);
  assert.match(account, /accountRequest\("\/resend-verification"/);
  assert.match(account, /if \(mode === "register"\) setMode\("verify"\)/);
});
