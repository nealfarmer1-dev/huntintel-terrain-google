import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { breadcrumbsFeatureCollection } from "../src/breadcrumb-geometry.js";
import { createForegroundLocationController } from "../src/live-location.js";
import { safeSarFailure, sarStartReadiness } from "../src/sar-workflow.js";

test("one foreground watcher drives current location and ignores callbacks after cleanup",async()=>{
  let watchCalls=0,removed=0,callback;const fixes=[];
  const api={Accuracy:{High:6},getForegroundPermissionsAsync:async()=>({status:"granted"}),getLastKnownPositionAsync:async()=>({coords:{latitude:35,longitude:-86,accuracy:12}}),watchPositionAsync:async(_options,next)=>{watchCalls+=1;callback=next;return{remove(){removed+=1}}}};
  const controller=createForegroundLocationController(api,{onLocation:value=>fixes.push(value)});
  await Promise.all([controller.start(),controller.start()]);assert.equal(watchCalls,1);assert.deepEqual(fixes[0].latitude,35);
  callback({coords:{latitude:35.1,longitude:-86.1,accuracy:4},timestamp:1});assert.equal(fixes.at(-1).longitude,-86.1);
  controller.stop();callback({coords:{latitude:99,longitude:99},timestamp:2});assert.equal(removed,1);assert.notEqual(fixes.at(-1).latitude,99);
});

test("breadcrumb geometry is analysis-scoped, ordered, deduplicated, and tolerant of malformed data",()=>{
  const feature=breadcrumbsFeatureCollection([
    [{id:"trail",analysisJobId:"a",points:[{latitude:2,longitude:20,sequenceNumber:2,clientPointId:"two"},{latitude:"bad",longitude:0},{latitude:1,longitude:10,sequenceNumber:1,clientPointId:"one"}]},{id:"other",analysisJobId:"b",points:[{latitude:8,longitude:8},{latitude:9,longitude:9}]}],
    {items:[{id:"trail",analysisJobId:"a",points:[{latitude:2,longitude:20,sequenceNumber:2,clientPointId:"two"},{latitude:3,longitude:30,sequenceNumber:3}]}]},
  ],"a");
  assert.equal(feature.features.length,1);assert.deepEqual(feature.features[0].geometry.coordinates,[[10,1],[20,2],[30,3]]);
});

test("SAR readiness requires an enabled feature, shared analysis, and owner/coordinator role",()=>{assert.equal(sarStartReadiness({liveSarEnabled:false}).ready,false);assert.equal(sarStartReadiness({team:{accessRole:"viewer"},analysis:{id:"a"}}).ready,false);assert.equal(sarStartReadiness({team:{accessRole:"coordinator"},analysis:{id:"a"}}).ready,true);assert.equal(safeSarFailure({code:"FEATURE_DISABLED",status:503}).message,"Live SAR is not currently enabled.")});

test("native map updates live sources without rebuilding and offline maps expose breadcrumbs",async()=>{
  const [app,navigation,sar,controller,offline,background]=await Promise.all([readFile(new URL("../App.tsx",import.meta.url),"utf8"),readFile(new URL("../src/NavigationPanel.tsx",import.meta.url),"utf8"),readFile(new URL("../src/SarScreen.tsx",import.meta.url),"utf8"),readFile(new URL("../src/useSarController.ts",import.meta.url),"utf8"),readFile(new URL("../src/offline-pipeline.js",import.meta.url),"utf8"),readFile(new URL("../src/navigation-background.js",import.meta.url),"utf8")]);
  assert.match(app,/__terrainUpdateLocation/);assert.match(app,/__terrainSetBreadcrumbs/);assert.match(app,/setData/);assert.match(app,/field\.current_location/);assert.match(app,/field\.breadcrumbs/);
  assert.doesNotMatch(navigation,/watchPositionAsync/);assert.match(navigation,/appendBreadcrumbPoints/);assert.match(controller,/fetchTeamAnalyses/);assert.match(controller,/startInFlight/);assert.match(sar,/liveSarEnabled/);assert.match(offline,/__terrainSetBreadcrumbs/);assert.match(background,/active\.points=\[\.\.\./);
});
