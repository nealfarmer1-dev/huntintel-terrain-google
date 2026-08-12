import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  GETTING_STARTED_ARTICLES,
  PRIVACY_URL,
  PUBLIC_SUPPORT_URL,
  SUPPORT_ACTIONS,
  SUPPORT_EMAIL,
  SUPPORT_FAQS,
  SUPPORT_VIDEO,
  TERMS_URL,
  createSupportMailto,
  toggleExpandedId,
  tryOpenExternalUrl,
} from "../src/support-content.js";

const accountSource = await readFile(new URL("../src/AccountScreen.tsx", import.meta.url), "utf8");
const helpSource = await readFile(new URL("../src/HelpSupportScreen.tsx", import.meta.url), "utf8");

test("Help and Support is linked from signed-in and signed-out Account states", () => {
  assert.match(accountSource, /title="Help & Legal"[\s\S]*label="Help & Support"/);
  assert.match(accountSource, /accessibilityLabel="Open Help and Support without signing in"/);
  assert.match(accountSource, /if \(showHelpSupport\) return <HelpSupportScreen/);
  assert.ok(accountSource.indexOf('if (mode === "security")') < accountSource.indexOf('accessibilityLabel="Open Help and Support without signing in"'));
});

test("support constants, content counts, video, and legal destinations are exact", () => {
  assert.equal(SUPPORT_EMAIL, "support@huntintelapp.com");
  assert.equal(PUBLIC_SUPPORT_URL, "https://terrain.huntintelapp.com/help-support");
  assert.deepEqual(SUPPORT_VIDEO, {
    id: "IkV3SmWBPds",
    title: "Creating a Terrain Analysis",
    description: "Watch a quick walkthrough of naming an analysis, drawing the analysis boundary, confirming acreage and price, and starting a HuntIntel Terrain analysis.",
    url: "https://youtube.com/shorts/IkV3SmWBPds",
  });
  assert.equal(GETTING_STARTED_ARTICLES.length, 8);
  const firstAnalysis = GETTING_STARTED_ARTICLES.find((article) => article.id === "first-analysis");
  assert.ok(firstAnalysis.steps.includes("Choose Review & Purchase to continue."));
  assert.ok(!firstAnalysis.steps.includes("Choose Analyze Terrain to continue."));
  assert.equal(SUPPORT_FAQS.length, 20);
  assert.equal(TERMS_URL, "https://app.huntintelapp.com/legal/terms");
  assert.equal(PRIVACY_URL, "https://app.huntintelapp.com/legal/privacy");
  assert.match(helpSource, /selectable style=\{styles\.email\}>\{SUPPORT_EMAIL\}/);
});

test("all support mail subjects and bodies are correctly encoded", () => {
  const expectedSubjects = [
    "HuntIntel Terrain Support Request",
    "HuntIntel Terrain Bug Report",
    "HuntIntel Terrain Feature Request",
    "HuntIntel Terrain Purchase or Account Help",
  ];
  assert.deepEqual(SUPPORT_ACTIONS.map((action) => action.subject), expectedSubjects);
  for (const action of SUPPORT_ACTIONS) {
    const url = new URL(createSupportMailto(action));
    assert.equal(url.protocol, "mailto:");
    assert.equal(url.pathname, SUPPORT_EMAIL);
    assert.equal(url.searchParams.get("subject"), action.subject);
    assert.equal(url.searchParams.get("body"), action.body);
    assert.match(createSupportMailto(action), /subject=HuntIntel%20Terrain/);
  }
});

test("FAQ expand and collapse behavior is deterministic", () => {
  assert.equal(toggleExpandedId(null, "faq-about"), "faq-about");
  assert.equal(toggleExpandedId("faq-about", "faq-about"), null);
  assert.equal(toggleExpandedId("faq-about", "faq-acreage"), "faq-acreage");
  assert.match(helpSource, /accessibilityState=\{\{ expanded \}\}/);
});

test("external-link failures are contained and surfaced safely", async () => {
  assert.equal(await tryOpenExternalUrl({ canOpenURL: async () => false, openURL: async () => { throw new Error("must not open"); } }, SUPPORT_VIDEO.url), false);
  assert.equal(await tryOpenExternalUrl({ canOpenURL: async () => true, openURL: async () => { throw new Error("unavailable"); } }, createSupportMailto(SUPPORT_ACTIONS[0])), false);
  let opened = "";
  assert.equal(await tryOpenExternalUrl({ canOpenURL: async () => true, openURL: async (url) => { opened = url; } }, PUBLIC_SUPPORT_URL), true);
  assert.equal(opened, PUBLIC_SUPPORT_URL);
  assert.match(helpSource, /A mail application could not be opened/);
  assert.match(helpSource, /The video could not be opened on this device/);
  assert.doesNotMatch(helpSource, /WebView/);
});

test("Android hardware back closes the native Help screen", () => {
  assert.match(helpSource, /BackHandler\.addEventListener\("hardwareBackPress"/);
  assert.match(helpSource, /onClose\(\); return true;/);
});
