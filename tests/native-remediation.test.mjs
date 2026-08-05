import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sessionStateForToken } from "../src/auth-state.js";
import { PRODUCTION_TERRAIN_API_BASE_URL, resolveTerrainApiBaseUrl } from "../src/runtime-config.js";

const decode = (value) => Buffer.from(value, "base64").toString("utf8");
const token = (exp) => `x.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.x`;

test("session state distinguishes restored, missing, invalid, and expired tokens", () => {
  assert.equal(sessionStateForToken(token(200), 100_000, decode).status, "authenticated");
  assert.deepEqual(sessionStateForToken("", 100_000, decode), { status: "unauthenticated", reason: "missing" });
  assert.equal(sessionStateForToken("invalid", 100_000, decode).reason, "invalid");
  assert.equal(sessionStateForToken(token(50), 100_000, decode).reason, "expired");
});

test("production API configuration is canonical and rejects localhost", () => {
  assert.equal(resolveTerrainApiBaseUrl({ EXPO_PUBLIC_TERRAIN_API_BASE_URL: `${PRODUCTION_TERRAIN_API_BASE_URL}/` }, true), PRODUCTION_TERRAIN_API_BASE_URL);
  assert.throws(() => resolveTerrainApiBaseUrl({}, true), /required/);
  assert.throws(() => resolveTerrainApiBaseUrl({ EXPO_PUBLIC_TERRAIN_API_BASE_URL: "http://127.0.0.1:3000" }, true), /cannot use localhost/);
});

test("Expo public runtime values use statically inlineable references", async () => {
  const [api, app] = await Promise.all([
    readFile(new URL("../src/api.js", import.meta.url), "utf8"),
    readFile(new URL("../App.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(api, /process\.env\.EXPO_PUBLIC_TERRAIN_API_BASE_URL/);
  assert.doesNotMatch(api, /resolveTerrainApiBaseUrl\(process\.env/);
  assert.match(app, /process\.env\.EXPO_PUBLIC_TERRAIN_MAPBOX_ACCESS_TOKEN/);
  assert.doesNotMatch(app, /globalThis.*process.*env/);
});

test("protected request headers preserve authorization alongside request-specific headers", async () => {
  const source = await readFile(new URL("../src/api.js", import.meta.url), "utf8");
  assert.match(source, /headers: suppliedHeaders/);
  assert.match(source, /Authorization: `Bearer \$\{token\}`/);
  assert.match(source, /\.\.\.suppliedHeaders/);
  assert.equal(source.includes("http://127.0.0.1"), false);
});

test("native production UI hides infrastructure and raw analysis controls", async () => {
  const [app, sar, map] = await Promise.all([
    readFile(new URL("../App.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/SarScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/NativeTerrainMap.tsx", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(app, /API gateway:/);
  assert.doesNotMatch(app, /label="Sample Polygon"/);
  assert.doesNotMatch(app, /placeholder="Saved analysis job id"/);
  assert.match(app, /label="New Analysis"/);
  assert.match(app, /LayerSheet/);
  assert.match(app, /map-ready/);
  assert.match(map, /setTimeout\(\(\) =>/);
  assert.match(app, /const authenticationFailed = nextError\?\.status === 401/);
  assert.match(app, /Usage and map-layer information could not be refreshed/);
  assert.match(sar, /__DEV__\s*&&/);
});

test("Android layout handles system back, keyboard, responsive map height, and onboarding footer", async () => {
  const [app, orientation] = await Promise.all([
    readFile(new URL("../App.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/OrientationModal.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(app, /BackHandler\.addEventListener/);
  assert.match(app, /KeyboardAvoidingView/);
  assert.match(app, /useWindowDimensions/);
  assert.match(app, /Math\.min\(520/);
  assert.match(orientation, /ScrollView/);
  assert.match(orientation, /onRequestClose/);
  assert.match(orientation, /<View style=\{styles\.actions\}>/);
});
