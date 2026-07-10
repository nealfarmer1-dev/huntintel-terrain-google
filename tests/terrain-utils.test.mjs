import test from "node:test";
import assert from "node:assert/strict";

import { buildPolygonFromPoints, calculateApproximateAcreage, samplePoints } from "../src/terrain.js";

test("sample polygon builds a closed ring", () => {
  const polygon = buildPolygonFromPoints(samplePoints());
  assert.equal(polygon.coordinates[0].length >= 4, true);
  assert.deepEqual(polygon.coordinates[0][0], polygon.coordinates[0][polygon.coordinates[0].length - 1]);
});

test("sample polygon acreage is positive", () => {
  const polygon = buildPolygonFromPoints(samplePoints());
  assert.equal(calculateApproximateAcreage(polygon) > 0, true);
});
