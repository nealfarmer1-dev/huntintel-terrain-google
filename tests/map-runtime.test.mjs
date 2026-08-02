import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
  MINIMAL_TERRAIN_MAP_HTML,
  coarseMapInputMetadata,
  createMapRetryController,
  parseTerrainMapMessage,
  runMapBuildStage,
  safeBuildMapSource,
} from "../src/map-runtime.js";

test("minimal local WebView HTML and current builders produce validated sources", () => {
  const minimal = safeBuildMapSource(() => MINIMAL_TERRAIN_MAP_HTML, null, { platform: "android", setupActive: true });
  assert.equal(minimal.ok, true);
  assert.match(minimal.source.html, /Terrain map test/);
});

test("map HTML exceptions and invalid output become a native-safe failure result", () => {
  const original = console.info;
  const diagnostics = [];
  const mapboxToken = "pk.eyJzdWIiOiJzZWNyZXQtdGVzdCJ9.signaturepart";
  console.info = (message) => diagnostics.push(message);
  try {
    assert.deepEqual(
      safeBuildMapSource(() => {
        throw new TypeError(`Map build failed for ${mapboxToken} at https://example.invalid/map near -84.512345, 33.123456`);
      }, {
        token: mapboxToken,
        polygon: null,
        features: [],
        relationships: null,
        waypoints: undefined,
      }, { platform: "android", setupActive: true }),
      { ok: false, source: null, code: "MAP_HTML_BUILD_FAILED", userMessage: "The terrain map could not be loaded." },
    );
    assert.equal(safeBuildMapSource(() => "", null).ok, false);
    assert.equal(diagnostics.length, 2);
    const failure = JSON.parse(diagnostics[0].replace(/^\[terrain-map\] /, ""));
    assert.equal(failure.stage, "build_html");
    assert.equal(failure.exception.name, "TypeError");
    assert.match(failure.exception.message, /Map build failed/);
    assert.match(failure.exception.message, /<redacted-token>/);
    assert.equal(failure.exception.stack.length > 0, true);
    assert.equal(failure.input.features.length, 0);
    assert.equal(failure.input.relationships.isNull, true);
    assert.equal(failure.input.waypoints.typeof, "undefined");
    assert.equal("token" in failure.input, false);
    assert.equal(diagnostics.some((message) => message.includes(mapboxToken)), false);
    assert.equal(diagnostics.some((message) => message.includes("example.invalid")), false);
    assert.equal(diagnostics.some((message) => message.includes("-84.512345")), false);
    assert.equal(JSON.parse(diagnostics[1].replace(/^\[terrain-map\] /, "")).stage, "html_validation");
  } finally {
    console.info = original;
  }
});

test("named map build stages preserve the thrown exception and fallback result", () => {
  const original = console.info;
  const diagnostics = [];
  console.info = (message) => diagnostics.push(JSON.parse(message.replace(/^\[terrain-map\] /, "")));
  try {
    const result = safeBuildMapSource(() => runMapBuildStage("relationship_conversion", () => {
      throw new RangeError("relationship conversion overflow");
    }), { features: [], relationships: [], waypoints: [] }, { platform: "android" });
    assert.deepEqual(result, {
      ok: false,
      source: null,
      code: "MAP_HTML_BUILD_FAILED",
      userMessage: "The terrain map could not be loaded.",
    });
  } finally {
    console.info = original;
  }
  assert.equal(diagnostics[0].stage, "relationship_conversion");
  assert.equal(diagnostics[0].exception.name, "RangeError");
  assert.equal(diagnostics[0].exception.message, "relationship conversion overflow");
});

test("coarse map metadata does not traverse or retain input values", () => {
  const circular = {};
  circular.self = circular;
  assert.deepEqual(coarseMapInputMetadata({
    token: "must-not-appear",
    polygon: circular,
    features: [],
    relationships: null,
    waypoints: undefined,
  }), {
    input: { typeof: "object", isNull: false, isArray: false },
    polygon: { typeof: "object", isNull: false, isArray: false },
    features: { typeof: "object", isNull: false, isArray: true, length: 0 },
    relationships: { typeof: "object", isNull: true, isArray: false },
    waypoints: { typeof: "undefined", isNull: false, isArray: false },
    basemap: { typeof: "undefined", isNull: false, isArray: false },
    terrainOverlay: { typeof: "undefined", isNull: false, isArray: false },
    labelsVisible: { typeof: "undefined", isNull: false, isArray: false },
    layerPreferences: { typeof: "undefined", isNull: false, isArray: false },
    editable: { typeof: "undefined", isNull: false, isArray: false },
    userLocation: { typeof: "undefined", isNull: false, isArray: false },
    userLocationEnabled: { typeof: "undefined", isNull: false, isArray: false },
    camera: { typeof: "undefined", isNull: false, isArray: false },
    initialAnalysisFit: { typeof: "undefined", isNull: false, isArray: false },
  });
});

test("bridge parsing rejects malformed messages without throwing", () => {
  assert.deepEqual(parseTerrainMapMessage("{"), { ok: false, code: "MAP_MESSAGE_INVALID" });
  assert.deepEqual(parseTerrainMapMessage("[]"), { ok: false, code: "MAP_MESSAGE_INVALID" });
  assert.deepEqual(parseTerrainMapMessage('{"type":"map-ready","payload":{}}'), { ok: true, message: { type: "map-ready", payload: {} } });
});

test("retry controller ignores duplicate retries until the active mount finishes", () => {
  const retry = createMapRetryController();
  assert.equal(retry.begin(), true);
  assert.equal(retry.begin(), false);
  assert.equal(retry.isInFlight(), true);
  retry.finish();
  assert.equal(retry.begin(), true);
});

test("Google map boundary has fallback, test seam, renderer recovery, and platform-scoped props", async () => {
  const source = await readFile(new URL("../src/NativeTerrainMap.tsx", import.meta.url), "utf8");
  for (const value of ["Retry Map", "Back", "onRenderProcessGone", "renderError", "TerrainMapErrorBoundary", "WebViewComponent = WebView"]) {
    assert.match(source, new RegExp(value));
  }
  assert.match(source, /Platform\.OS === "android" \? \{ geolocationEnabled: true \} : \{\}/);
  assert.match(source, /onContentProcessDidTerminate/);
  assert.match(source, /activeInstance\.current !== reload/);
  assert.match(source, /onRetrySource\?\.\(\)/);
});

test("Google release inputs retain native WebView dependency and Android implementation", async () => {
  const [pkg, lock] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../package-lock.json", import.meta.url), "utf8"),
  ]);
  assert.match(pkg, /"react-native-webview"/);
  assert.match(lock, /node_modules\/react-native-webview/);
  await access(new URL("../node_modules/react-native-webview/android/build.gradle", import.meta.url));
});
