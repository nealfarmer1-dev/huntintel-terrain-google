import assert from "node:assert/strict";
import test from "node:test";

import { createResultsState, entityGeometry, featureGroup, groupTerrainFeatures, navigationTarget, relatedWaypointIds, selectEntity, selectedEntity, sortResultEntities, stateForAnalysis, validGeometry } from "../src/analysis-results.js";

const analysis = {
  analysisJobId: "job-b",
  analysisName: "Duplicate Display Name",
  waypoints: [
    { id: "waypoint-low", title: "Same Label", sourceFeatureId: "feature-line", score: 20, confidence: .9, geometry: { type: "Point", coordinates: [-86.2, 32.2] } },
    { id: "waypoint-high", title: "Same Label", sourceFeatureId: "feature-point", score: 90, confidence: .5, geometry: { type: "Point", coordinates: [-86.1, 32.1] } },
    { id: "waypoint-text", title: "No location", sourceFeatureId: "feature-other", score: 40 },
  ],
  features: [
    { id: "feature-point", featureType: "ridge", score: 80, geometry: { type: "Point", coordinates: [-86.1, 32.1] } },
    { id: "feature-line", featureType: "travel_corridor", score: 70, geometry: { type: "LineString", coordinates: [[-86.2, 32.2], [-86.15, 32.25]] } },
    { id: "feature-polygon", featureType: "water", score: 60, geometry: { type: "Polygon", coordinates: [[[-86.3,32.2],[-86.2,32.2],[-86.2,32.3],[-86.3,32.2]]] } },
    { id: "feature-other", featureType: "unexpected_new_taxonomy", score: 50 },
  ],
};

test("selection is immutable-ID based and isolated per analysis instance", () => {
  const first = selectEntity(createResultsState("job-a"), { ...analysis, analysisJobId: "job-a" }, "waypoint", "waypoint-low");
  const second = createResultsState("job-b");
  assert.equal(first.selectedEntityId, "waypoint-low");
  assert.equal(second.selectedEntityId, null);
  assert.equal(selectedEntity(first, analysis), null);
  assert.equal(stateForAnalysis(first, "job-b").selectedEntityId, null);
});

test("duplicate labels never substitute for exact waypoint or feature IDs", () => {
  let state = createResultsState("job-b");
  state = selectEntity(state, analysis, "waypoint", "waypoint-high");
  assert.equal(selectedEntity(state, analysis).id, "waypoint-high");
  state = selectEntity(state, analysis, "terrainFeature", "feature-line");
  assert.equal(selectedEntity(state, analysis).id, "feature-line");
  assert.equal(selectEntity(state, analysis, "waypoint", "missing").selectedEntityId, null);
});

test("point, line, and polygon geometry validate without fabricating missing locations", () => {
  for (const id of ["feature-point", "feature-line", "feature-polygon"]) assert.equal(validGeometry(analysis.features.find((item) => item.id === id).geometry), true);
  assert.equal(entityGeometry(analysis.features.at(-1)), null);
  assert.equal(navigationTarget(analysis.waypoints[0]).id, "waypoint-low");
  assert.equal(navigationTarget(analysis.waypoints[2]), null);
});

test("feature grouping is deterministic and unknown types remain under Other", () => {
  const groups = groupTerrainFeatures(analysis.features);
  assert.deepEqual(groups.map((group) => group.id), ["travel", "ridges", "water", "other"]);
  assert.equal(featureGroup(analysis.features.at(-1)).id, "other");
  assert.deepEqual(groupTerrainFeatures(analysis.features).map((group) => group.items.map((item) => item.id)), groups.map((group) => group.items.map((item) => item.id)));
});

test("waypoint ordering uses score then confidence with stable source order", () => {
  assert.deepEqual(sortResultEntities(analysis.waypoints).map((item) => item.id), ["waypoint-high", "waypoint-text", "waypoint-low"]);
  const tied = [{ id: "a", score: 10, confidence: .5 }, { id: "b", score: 10, confidence: .5 }];
  assert.deepEqual(sortResultEntities(tied).map((item) => item.id), ["a", "b"]);
});

test("related waypoints require explicit sourceFeatureId linkage", () => {
  assert.deepEqual(relatedWaypointIds("feature-line", analysis.waypoints), ["waypoint-low"]);
  assert.deepEqual(relatedWaypointIds("missing", analysis.waypoints), []);
});

test("tab, category, and list limits do not change canonical analysis identity", () => {
  const state = { ...createResultsState("job-b"), activeResultsTab: "records", activeCategoryFilter: "water", waypointLimit: 40 };
  assert.equal(state.analysisJobId, "job-b");
  assert.equal(state.selectedEntityId, null);
});

test("selecting a waypoint beyond the initial window expands controlled rendering to its immutable ID", () => {
  const waypoints = Array.from({ length: 25 }, (_, index) => ({ id: `waypoint-${index}`, score: 25 - index }));
  const next = selectEntity(createResultsState("job-large"), { analysisJobId: "job-large", waypoints, features: [] }, "waypoint", "waypoint-24");
  assert.equal(next.selectedEntityId, "waypoint-24");
  assert.equal(next.waypointLimit, 25);
});
