import test from "node:test";
import assert from "node:assert/strict";

import { SAMPLE_POLYGON } from "../src/terrain.js";
import {
  MAPBOX_STYLE_OPTIONS,
  USGS_TERRAIN_OVERLAY_OPTIONS,
  buildAnalysisRequestPayload,
  relationshipsToGeoJson,
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

test("relationship records become map lines between feature geometry anchors", () => {
  const collection = relationshipsToGeoJson(
    [{ id: "relationship-1", sourceFeatureId: "feature-1", targetFeatureId: "feature-2" }],
    [
      { id: "feature-1", geometry: { type: "Point", coordinates: [-86, 36] } },
      { id: "feature-2", geometry: { type: "Polygon", coordinates: [[[-85.99, 36], [-85.98, 36], [-85.98, 36.01], [-85.99, 36]]] } },
    ],
  );
  assert.equal(collection.features.length, 1);
  assert.equal(collection.features[0].geometry.type, "LineString");
  assert.deepEqual(collection.features[0].geometry.coordinates[0], [-86, 36]);
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
  assert.equal(MAPBOX_STYLE_OPTIONS.some((option) => option.value === "topo"), false);
  assert.equal(MAPBOX_STYLE_OPTIONS.some((option) => option.value === "3dep"), true);
  assert.deepEqual(USGS_TERRAIN_OVERLAY_OPTIONS.map((option) => option.value), ["", "hillshade", "slope", "aspect"]);
  assert.equal(usgs3depTileUrl("3DEPElevation:Aspect Map").includes("3DEPElevation%3AAspect%20Map"), true);
});
