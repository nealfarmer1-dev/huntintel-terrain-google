import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { requireOpenedAnalysis, withAnalysisBoundary } from "../src/analysis-opening.js";

const app = await readFile(new URL("../App.tsx", import.meta.url), "utf8");
const requestPolygon = { type: "Polygon", coordinates: [[[-86, 36], [-85.99, 36], [-85.99, 36.01], [-86, 36]]] };

test("opening an analysis shows a blocking native progress state", () => {
  assert.match(app, /screen === "opening"/);
  assert.match(app, /<ActivityIndicator/);
  assert.match(app, /Opening Analysis\.\.\./);
});

test("initial fit targets only the saved polygon and has one automatic fit call", () => {
  const fitBlock = app.slice(app.indexOf("try{const b=new mapboxgl.LngLatBounds"), app.indexOf("}catch(e){}", app.indexOf("try{const b=new mapboxgl.LngLatBounds")));
  assert.doesNotMatch(fitBlock, /features\.forEach|waypoints\.forEach/);
  assert.equal((fitBlock.match(/map\.fitBounds/g) || []).length, 1);
  assert.match(fitBlock, /padding:56,maxZoom:15/);
  assert.match(fitBlock, /editable\|\|initialAnalysisFit/);
  assert.match(app, /if \(initialFitAnalysisId\) setInitialFitAnalysisId\(null\)/);
});

test("cross-analysis payloads are rejected", () => {
  const analysis = { analysisJobId: "analysis-b", requestPolygon };
  assert.deepEqual(requireOpenedAnalysis(analysis, "analysis-b"), analysis);
  assert.throws(() => requireOpenedAnalysis({ analysisJobId: "analysis-a", requestPolygon }, "analysis-b"), (error) => error.code === "ANALYSIS_ID_MISMATCH");
});

test("saved and just-purchased analyses require one persistent boundary", () => {
  assert.deepEqual(withAnalysisBoundary({ analysisJobId: "analysis-b" }, requestPolygon).requestPolygon, requestPolygon);
  assert.deepEqual(withAnalysisBoundary({ analysisJobId: "analysis-b", requestPolygon: { type: "Polygon", coordinates: [] } }, requestPolygon).requestPolygon, requestPolygon);
  assert.throws(() => requireOpenedAnalysis({ analysisJobId: "analysis-b" }, "analysis-b"), (error) => error.code === "ANALYSIS_BOUNDARY_MISSING");
  assert.match(app, /const nextPolygon=analysis\?analysis\.requestPolygon:polygon/);
  assert.match(app, /editable:screen==="setup"&&!analysis/);
});
