import assert from "node:assert/strict";
import test from "node:test";

import { MINIMAL_TERRAIN_MAP_HTML, createMapRetryController, safeBuildMapSource } from "../src/map-runtime.js";
import { selectTerrainMapSource } from "../src/map-source-selection.js";
import { renderOfflineMapHtml } from "../src/offline-pipeline.js";

const boundary = { type: "Polygon", coordinates: [[[-86, 36], [-85.99, 36], [-85.99, 36.01], [-86, 36]]] };
const offlineManifest = {
  analysisJobId: "analysis-1",
  immutable: { analysis: { analysisJobId: "analysis-1", requestPolygon: boundary }, features: [], relationships: [] },
  map: { region: boundary, tilePlan: { provider: { id: "fixture" }, maxZoom: 1, tiles: [] } },
};

function onlineSource(setupActive) {
  return safeBuildMapSource(() => MINIMAL_TERRAIN_MAP_HTML, {
    polygon: null,
    features: [],
    relationships: [],
    waypoints: [],
  }, { platform: "android", setupActive });
}

test("startup and New Analysis select a valid online source when offline state is null", () => {
  let offlineBuilds = 0;
  for (const setupActive of [false, true]) {
    const selected = selectTerrainMapSource({
      offlineManifest: null,
      analysis: null,
      buildOnline: () => onlineSource(setupActive),
      buildOffline: () => { offlineBuilds += 1; throw new Error("offline renderer must not run"); },
    });
    assert.equal(selected.usingOfflinePackage, false);
    assert.equal(selected.sourceResult.ok, true);
    assert.match(selected.sourceResult.source.html, /Terrain map test/);
  }
  assert.equal(offlineBuilds, 0);
});

test("setupActive changes do not change null offline state into an offline selection", () => {
  const states = [false, true, false].map((setupActive) => selectTerrainMapSource({
    offlineManifest: null,
    analysis: null,
    buildOnline: () => ({ ...onlineSource(setupActive), setupActive }),
    buildOffline: () => { throw new Error("offline renderer must not run"); },
  }));
  assert.deepEqual(states.map((state) => state.usingOfflinePackage), [false, false, false]);
  assert.deepEqual(states.map((state) => state.sourceResult.ok), [true, true, true]);
});

test("retry after an online HTML failure remains online and can produce a valid source", () => {
  const retry = createMapRetryController();
  let attempt = 0;
  let offlineBuilds = 0;
  const select = () => selectTerrainMapSource({
    offlineManifest: null,
    analysis: null,
    buildOnline: () => safeBuildMapSource(() => {
      attempt += 1;
      if (attempt === 1) throw new TypeError("diagnostic test failure");
      return MINIMAL_TERRAIN_MAP_HTML;
    }, null, { platform: "android", setupActive: true }),
    buildOffline: () => { offlineBuilds += 1; throw new Error("offline renderer must not run"); },
  });

  const original = console.info;
  console.info = () => {};
  try {
    assert.equal(select().sourceResult.ok, false);
    assert.equal(retry.begin(), true);
    assert.equal(select().sourceResult.ok, true);
    retry.finish();
  } finally {
    console.info = original;
  }
  assert.equal(offlineBuilds, 0);
});

test("a matching valid offline model selects and produces the offline source", () => {
  const selected = selectTerrainMapSource({
    offlineManifest,
    analysis: { analysisJobId: "analysis-1" },
    buildOnline: () => { throw new Error("online renderer must not run"); },
    buildOffline: (manifest) => safeBuildMapSource((value) => renderOfflineMapHtml(value), manifest, { platform: "android" }),
  });
  assert.equal(selected.usingOfflinePackage, true);
  assert.equal(selected.sourceResult.ok, true);
  assert.match(selected.sourceResult.source.html, /Offline map/);
});
