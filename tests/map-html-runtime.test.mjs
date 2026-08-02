import assert from "node:assert/strict";
import test from "node:test";

import {
  INITIAL_TERRAIN_MAP_CENTER,
  INITIAL_TERRAIN_MAP_ZOOM,
  mapBuildCollections,
  safeJson,
  terrainMapViewport,
} from "../src/map-html-runtime.js";

test("empty New Analysis input receives a serializable initial viewport", () => {
  assert.deepEqual(terrainMapViewport(null), {
    center: [...INITIAL_TERRAIN_MAP_CENTER],
    zoom: INITIAL_TERRAIN_MAP_ZOOM,
  });
  assert.deepEqual(terrainMapViewport({ coordinates: [] }), {
    center: [...INITIAL_TERRAIN_MAP_CENTER],
    zoom: INITIAL_TERRAIN_MAP_ZOOM,
  });
});

test("saved analysis polygons retain their first coordinate and detail zoom", () => {
  assert.deepEqual(
    terrainMapViewport({ type: "Polygon", coordinates: [[[-86.75, 34.25]]] }),
    { center: [-86.75, 34.25], zoom: 13 },
  );
});

test("map HTML serialization and collections tolerate absent optional input", () => {
  assert.equal(safeJson(undefined), "null");
  assert.equal(safeJson(null), "null");
  assert.equal(safeJson([]), "[]");
  assert.equal(safeJson("<script>"), '"\\u003cscript>"');
  assert.deepEqual(mapBuildCollections(), {
    features: [],
    relationships: [],
    waypoints: [],
  });
  assert.deepEqual(mapBuildCollections({ features: null, relationships: {}, waypoints: "invalid" }), {
    features: [],
    relationships: [],
    waypoints: [],
  });
});

test("map HTML serialization preserves current circular-data and BigInt failures", () => {
  const circular = {};
  circular.self = circular;

  assert.throws(() => safeJson(circular), {
    name: "TypeError",
  });
  assert.throws(() => safeJson(1n), {
    name: "TypeError",
  });
});
