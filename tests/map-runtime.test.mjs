import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
  MINIMAL_TERRAIN_MAP_HTML,
  createMapRetryController,
  parseTerrainMapMessage,
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
  console.info = (message) => diagnostics.push(message);
  try {
    assert.deepEqual(
      safeBuildMapSource(() => { throw new Error("token must never be logged"); }, null, { platform: "android", setupActive: true }),
      { ok: false, source: null, code: "MAP_HTML_BUILD_FAILED", userMessage: "The terrain map could not be loaded." },
    );
    assert.equal(safeBuildMapSource(() => "", null).ok, false);
    assert.equal(diagnostics.length, 2);
    assert.equal(diagnostics.some((message) => message.includes("token must never be logged")), false);
  } finally {
    console.info = original;
  }
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
