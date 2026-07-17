import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../App.tsx", import.meta.url), "utf8");
const tabs = await readFile(new URL("../src/AnalysisResultsTabs.tsx", import.meta.url), "utf8");
const api = await readFile(new URL("../src/api.js", import.meta.url), "utf8");
const pdf = await readFile(new URL("../src/PdfReportPanel.tsx", import.meta.url), "utf8");

test("native results retain one centralized ID selection model and bounded compact lists", () => {
  assert.match(app, /useState<any>\(createResultsState\(\)\)/);
  assert.match(tabs, /slice\(0, resultsUi\.waypointLimit\)/);
  assert.match(tabs, /key=\{waypoint\.id\}/);
  assert.match(tabs, /key=\{feature\.id\}/);
  assert.doesNotMatch(tabs, /key=\{index\}/);
});

test("native result tabs keep Navigation and Field Records mounted while hidden", () => {
  for (const id of ["waypoints", "features", "navigation", "records"]) assert.match(tabs, new RegExp(`activeResultsTab === "${id}"`));
  assert.match(tabs, /<NavigationPanel key=\{analysisJobId\}/);
  assert.match(tabs, /<FieldRecordsScreen key=\{analysisJobId\}/);
  assert.match(tabs, /hidden: \{ display: "none" \}/);
});

test("native Mapbox bridge supports point line polygon selection and reverse ID selection", () => {
  for (const layer of ["analysis-features-fill", "analysis-features-line", "analysis-features-circle", "analysis-selection-fill", "analysis-selection-line", "analysis-selection-circle"]) assert.match(app, new RegExp(layer));
  assert.match(app, /result-select/);
  assert.match(app, /entityType:'terrainFeature'/);
  assert.match(app, /entityType:'waypoint'/);
  assert.match(app, /resultsMapRef\.current\?\.injectJavaScript/);
});

test("native tab and selection state are excluded from memoized map HTML dependencies", () => {
  const memo = app.match(/const mapHtml=useMemo\([\s\S]+?\);\n  const mapSource/)?.[0] || "";
  assert.ok(memo);
  assert.doesNotMatch(memo, /resultsUi/);
  assert.match(app, /source=\{mapSource!\}/);
});

test("native report PDF field records and exact analysis identifiers remain wired without Analysis Tour", () => {
  for (const value of ["Key Findings", "Scouting Notes", "Limitations", "PdfReportPanel", "AnalysisResultsTabs", "analysisJobId"]) assert.match(app, new RegExp(value));
  assert.doesNotMatch(app + tabs, /Analysis Tour|analysisTour|analysis_tour/);
  assert.match(api, /requireAnalysisJobId\(features, analysisJobId/);
  assert.match(pdf, /artifact\?\.analysisJobId!==analysisJobId/);
  assert.match(app, /analysisLoadGeneration/);
  assert.match(app, /generation!==analysisLoadGeneration\.current/);
});
