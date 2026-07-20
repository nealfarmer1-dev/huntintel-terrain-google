import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ANALYSIS_LIMIT_MESSAGE, ANALYSIS_LIMIT_TITLE, removeDeletedAnalyses } from "../src/analysis-library.js";

test("Google shows the required library-limit dialog and preserves the payment screen", async () => {
  const [gate, app] = await Promise.all([readFile(new URL("../src/PaymentGate.tsx", import.meta.url), "utf8"), readFile(new URL("../App.tsx", import.meta.url), "utf8")]);
  assert.equal(ANALYSIS_LIMIT_TITLE, "You've reached your limit of 150 saved analyses.");
  assert.equal(ANALYSIS_LIMIT_MESSAGE, "Delete one or more analyses from My Analyses to save another.");
  for (const value of ["ANALYSIS_LIMIT_CODE", "Go to My Analyses", "Cancel", "Alert.alert"]) assert.match(gate, new RegExp(value.replace(".", "\\.")));
  assert.match(app, /setLibraryReturnScreen\("payment"\)/);
  assert.match(app, /onPurchaseChange=\{setPurchase\}/);
});

test("Google supports confirmed individual and multi-select delete with immediate count updates", async () => {
  const [screen, app, api] = await Promise.all([readFile(new URL("../src/LibraryScreen.tsx", import.meta.url), "utf8"), readFile(new URL("../App.tsx", import.meta.url), "utf8"), readFile(new URL("../src/api.js", import.meta.url), "utf8")]);
  for (const value of ["Saved Analyses:", "Delete Selected", "Select", "Delete"]) assert.match(screen, new RegExp(value));
  assert.match(app, /Delete saved analysis/); assert.match(app, /Alert\.alert/); assert.match(api, /deleteAnalyses/);
  const updated = removeDeletedAnalyses({ items: [{ analysisJobId: "a" }, { analysisJobId: "b" }], total: 2, ownedTotal: 2, pageSize: 12 }, ["a"], 1);
  assert.equal(updated.items.length, 1); assert.equal(updated.ownedTotal, 1); assert.equal(updated.limit, 150);
});
