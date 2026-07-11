import test from "node:test";
import assert from "node:assert/strict";

import { SAMPLE_POLYGON } from "../src/terrain.js";
import {
  MAPBOX_STYLE_OPTIONS,
  USGS_TERRAIN_OVERLAY_OPTIONS,
  buildAnalysisRequestPayload,
  resolveMapboxAccessToken,
  usgs3depTileUrl,
} from "../src/terrain-map.js";

test("analysis request sends standalone name as analysisName with null propertyId", () => {
  const payload = buildAnalysisRequestPayload({
    analysisName: "Weekend Test Property",
    analysisMode: "whitetail",
    species: "whitetail",
    propertyId: "Weekend Test Property",
    polygon: SAMPLE_POLYGON,
  });

  assert.equal(payload.analysisName, "Weekend Test Property");
  assert.equal(payload.propertyId, null);
});

test("analysis request preserves valid UUID propertyId", () => {
  const propertyId = "123e4567-e89b-42d3-a456-426614174000";
  const payload = buildAnalysisRequestPayload({
    analysisName: "South Ridge",
    analysisMode: "turkey",
    species: "turkey",
    propertyId,
    polygon: SAMPLE_POLYGON,
  });

  assert.equal(payload.propertyId, propertyId);
});

test("map config exposes Mapbox and USGS 3DEP sources", () => {
  assert.equal(resolveMapboxAccessToken({ EXPO_PUBLIC_TERRAIN_MAPBOX_ACCESS_TOKEN: "terrain-token" }), "terrain-token");
  assert.equal(MAPBOX_STYLE_OPTIONS.some((option) => option.value === "lidar"), true);
  assert.deepEqual(USGS_TERRAIN_OVERLAY_OPTIONS.map((option) => option.value), ["", "hillshade", "slope", "aspect"]);
  assert.equal(usgs3depTileUrl("3DEPElevation:Aspect Map").includes("3DEPElevation%3AAspect%20Map"), true);
});
