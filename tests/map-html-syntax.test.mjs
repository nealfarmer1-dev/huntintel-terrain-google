import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { mapBuildCollections, safeJson, terrainMapViewport } from "../src/map-html-runtime.js";
import { runMapBuildStage, safeBuildMapSource } from "../src/map-runtime.js";
import { relationshipsToGeoJson } from "../src/terrain-map.js";

test("generated waypoint popup HTML contains parseable WebView JavaScript", async () => {
  const source = await readFile(new URL("../App.tsx", import.meta.url), "utf8");
  const file = ts.createSourceFile("App.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const functions = file.statements
    .filter((node) => ts.isFunctionDeclaration(node) && node.name?.text === "buildMapHtml")
    .map((node) => node.getFullText(file))
    .join("\n");
  assert.ok(functions.includes("buildMapHtml"));
  for (const stage of ["input_preparation", "relationship_conversion", "waypoint_preparation", "safe_json_serialization", "final_html_assembly"]) {
    assert.match(functions, new RegExp(`runMapBuildStage\\(\\"${stage}\\"`));
  }

  const javascript = ts.transpileModule(functions, {
    compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const context = {
    USGS_TERRAIN_OVERLAY_OPTIONS: [],
    USGS_3DEP_WMS_BASE: "https://example.invalid",
    mapBuildCollections,
    mapboxStyleFor: () => "mapbox://styles/mapbox/outdoors-v12",
    relationshipsToGeoJson,
    runMapBuildStage,
    safeJson,
    terrainMapViewport,
    waypointDetails: (waypoint) => ({
      eyebrow: "SELECTED WAYPOINT",
      title: waypoint.title,
      type: waypoint.waypointType,
      reason: waypoint.reason,
      score: "88.0",
      confidence: "0.90",
      geometry: "Map geometry: Point",
    }),
    args: {
      token: "pk.test",
      polygon: { type: "Polygon", coordinates: [[[-87, 32.6], [-87, 32.7], [-86.9, 32.6], [-87, 32.6]]] },
      drawingPoints: [],
      features: [],
      relationships: [],
      waypoints: [{ id: "wp-1", title: "<img onerror=bad>", waypointType: "saddle", reason: "Travel funnel", score: 88, confidence: .9, geometry: { type: "Point", coordinates: [-87, 32.6] } }],
      basemap: "outdoors",
      terrainOverlay: "",
      labelsVisible: true,
      layerPreferences: { analysis: { boundary: true, waypoints: true, features: true, relationships: true }, field: { current_location: true } },
      editable: false,
      userLocation: null,
      userLocationEnabled: false,
      camera: null,
      initialAnalysisFit: true,
    },
  };
  vm.runInNewContext(`${javascript}\nthis.buildMapHtml = buildMapHtml; this.html = buildMapHtml(this.args);`, context);

  const marker = "<script>(function(){";
  const start = context.html.indexOf(marker);
  const end = context.html.lastIndexOf("</script>");
  assert.ok(start >= 0 && end > start);
  const inlineScript = context.html.slice(start + "<script>".length, end);
  assert.doesNotThrow(() => new vm.Script(inlineScript));
  assert.doesNotMatch(context.html, /<img onerror=bad>/);
  assert.match(inlineScript, /\.setDOMContent\(content\)/);
  assert.match(inlineScript, /analysis-relationships-line/);

  const emptyMap = safeBuildMapSource(context.buildMapHtml, {
    ...context.args,
    polygon: null,
    features: undefined,
    relationships: undefined,
    waypoints: undefined,
    editable: true,
    initialAnalysisFit: false,
  }, { platform: "android", setupActive: true });
  assert.equal(emptyMap.ok, true);
  assert.match(emptyMap.source.html, /centerSafe\(\)/);
  assert.match(emptyMap.source.html, /zoom:initialCamera&&initialCamera\.zoom\|\|4/);
  assert.match(emptyMap.source.html, /\[-84\.5,33\]/);
  assert.match(emptyMap.source.html, /Tap to add boundary points/);

  const circular = {};
  circular.self = circular;
  const original = console.info;
  const diagnostics = [];
  console.info = (message) => diagnostics.push(JSON.parse(message.replace(/^\[terrain-map\] /, "")));
  try {
    assert.equal(safeBuildMapSource(context.buildMapHtml, {
      ...context.args,
      layerPreferences: circular,
    }, { platform: "android", setupActive: true }).ok, false);
    assert.equal(safeBuildMapSource(context.buildMapHtml, {
      ...context.args,
      camera: { zoom: 1n },
    }, { platform: "android", setupActive: true }).ok, false);
  } finally {
    console.info = original;
  }
  assert.deepEqual(diagnostics.map((entry) => entry.stage), ["safe_json_serialization", "safe_json_serialization"]);
  assert.deepEqual(diagnostics.map((entry) => entry.exception.name), ["TypeError", "TypeError"]);
  assert.equal(diagnostics.every((entry) => entry.input.features.isArray && entry.input.features.length === 0), true);
});
