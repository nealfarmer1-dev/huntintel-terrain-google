import test from "node:test";
import assert from "node:assert/strict";

import { buildPolygonFromPoints, calculateApproximateAcreage, getBounds, samplePoints } from "../src/terrain.js";

test("sample polygon builds a closed ring", () => {
  const polygon = buildPolygonFromPoints(samplePoints());
  assert.equal(polygon.coordinates[0].length >= 4, true);
  assert.deepEqual(polygon.coordinates[0][0], polygon.coordinates[0][polygon.coordinates[0].length - 1]);
});

test("sample polygon acreage is positive", () => {
  const polygon = buildPolygonFromPoints(samplePoints());
  assert.equal(calculateApproximateAcreage(polygon) > 0, true);
});

test("bounds include point line and polygon geometry without treating nested arrays as points", () => {
  const polygon = buildPolygonFromPoints(samplePoints());
  const bounds = getBounds(polygon, [{ geometry: { type: "Point", coordinates: [-88, 31] } }], [
    { geometry: { type: "LineString", coordinates: [[-89, 30], [-84, 37]] } },
    { geometry: { type: "Polygon", coordinates: [[[-90, 29], [-89, 29], [-89, 30], [-90, 29]]] } },
  ]);
  assert.equal(bounds.minLon, -90);
  assert.equal(bounds.minLat, 29);
  assert.equal(bounds.maxLon, -84);
  assert.equal(bounds.maxLat, 37);
});
