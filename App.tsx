import React, { useEffect, useMemo, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { WebView } from "react-native-webview";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { createAnalysisDraft, deleteAnalysis, deleteAnalyses, fetchAccount, fetchAnalyses, fetchAnalysis, fetchAttachments, fetchMapConfig, fetchOfflineManifest, pullOfflineSync, pushOfflineSync, terrainApiBaseUrl } from "./src/api";
import { downloadAndSaveOfflinePackage, listOfflinePackages, loadOfflinePackage, removeOfflinePackage, synchronizeOfflinePackage } from "./src/offline";
import { renderOfflineMapHtml } from "./src/offline-pipeline";
import "./src/navigation-background";
import { stopSarBackground } from "./src/sar-background";
import { NavigationPanel } from "./src/NavigationPanel";
import { DEFAULT_LAYER_PREFERENCES, normalizeLayerPreferences, toggleLayer } from "./src/map-layers";
import { AccountScreen } from "./src/AccountScreen";
import { LibraryScreen } from "./src/LibraryScreen";
import { FieldRecordsScreen } from "./src/FieldRecordsScreen";
import { TeamsScreen } from "./src/TeamsScreen";
import { SarScreen } from "./src/SarScreen";
import { PdfReportPanel } from "./src/PdfReportPanel";
import { AnalysisResultsTabs } from "./src/AnalysisResultsTabs";
import { PaymentGate } from "./src/PaymentGate";
import { buildPolygonFromPoints, calculateApproximateAcreage, getBounds, projectCoordinate, samplePoints } from "./src/terrain";
import { MAPBOX_STYLE_OPTIONS, USGS_3DEP_WMS_BASE, USGS_TERRAIN_OVERLAY_OPTIONS, buildAnalysisRequestPayload, mapboxStyleFor, resolveMapboxAccessToken } from "./src/terrain-map";
import type { TerrainAnalysisResponse, TerrainWaypoint } from "./src/terrain-contract";
import { analysisNameValidationMessage, deriveSetupState, normalizedAnalysisName, quoteMatchesSetup, setupConfigurationKey } from "./src/setup-state";
import { createResultsState, entityGeometry, navigationTarget, selectEntity, selectedEntity, stateForAnalysis } from "./src/analysis-results";
import { requireOpenedAnalysis } from "./src/analysis-opening";
import { OrientationModal } from "./src/OrientationModal";
import { completeOrientation, orientationCompleted, replayOrientation } from "./src/orientation";
import { removeDeletedAnalyses } from "./src/analysis-library";

const MIN_ACRES = 5;
const MAX_ACRES = 2000;
const MAP_WIDTH = 320;
const MAP_HEIGHT = 260;
const MAPBOX_ACCESS_TOKEN = resolveMapboxAccessToken((globalThis as any).process?.env || {});
const HAS_MAPBOX_ACCESS_TOKEN = MAPBOX_ACCESS_TOKEN.length > 0;

const ANALYSIS_MODE_OPTIONS = [
  { value: "whitetail", label: "Whitetail" },
  { value: "turkey", label: "Turkey" },
  { value: "elk", label: "Elk" },
  { value: "wild_hog", label: "Wild Hog" },
  { value: "search_and_rescue", label: "Search and Rescue" },
  { value: "military_terrain", label: "Terrain Assessment" },
] as const;

type Screen = "setup" | "payment" | "processing" | "opening" | "results" | "report" | "waypoint" | "library" | "teams" | "sar";
type MapPoint = { longitude: number; latitude: number };

function sortWaypoints(waypoints: TerrainWaypoint[]) {
  return [...waypoints].sort((left, right) => right.score - left.score);
}

function isWildlifeMode(analysisMode: string) {
  return ["whitetail", "turkey", "elk", "wild_hog"].includes(analysisMode);
}

function analysisModeLabel(value: string | undefined) {
  return ANALYSIS_MODE_OPTIONS.find((option) => option.value === value)?.label || value || "Unknown";
}

function safeJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function buildMapHtml({ token, polygon, features, waypoints, basemap, terrainOverlay, labelsVisible, layerPreferences, editable, userLocation, userLocationEnabled, camera, initialAnalysisFit }: any) {
  const style = mapboxStyleFor(basemap);
  const center = polygon?.coordinates?.[0]?.[0] || [-87.0, 32.6];
  const overlay = USGS_TERRAIN_OVERLAY_OPTIONS.find((option: any) => option.value === terrainOverlay && option.layer);
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link href="https://api.mapbox.com/mapbox-gl-js/v3.5.1/mapbox-gl.css" rel="stylesheet" />
<style>html,body,#map{margin:0;width:100%;height:100%;background:#0b0f0c;overflow:hidden;font-family:Arial,sans-serif}.view-controls{position:absolute;top:10px;left:10px;z-index:5;display:flex;gap:5px;background:rgba(10,17,8,.86);border:1px solid rgba(111,143,85,.38);border-radius:999px;padding:4px}.view-btn{border:0;border-radius:999px;min-width:31px;min-height:30px;background:rgba(22,32,23,.96);color:#d7e1d3;font-size:11px;font-weight:900}.view-btn.active{background:#8eab77;color:#091008}.hint{position:absolute;left:10px;right:10px;bottom:10px;z-index:4;background:rgba(10,17,8,.86);border:1px solid rgba(111,143,85,.38);border-radius:12px;padding:8px;color:#d7e1d3;font-size:11px}</style></head><body><div id="map"></div><div class="view-controls"><button class="view-btn" id="toggle-3d">3D</button><button class="view-btn" id="rotate-left">L</button><button class="view-btn" id="rotate-right">R</button><button class="view-btn" id="reset-north">N</button><button class="view-btn" id="locate-me">LOC</button></div><div class="hint">${editable ? "Tap to add boundary points." : "Terrain results map."}</div>
<script src="https://api.mapbox.com/mapbox-gl-js/v3.5.1/mapbox-gl.js"></script><script>(function(){
mapboxgl.accessToken=${safeJson(token)};
const polygon=${safeJson(polygon)};
const features=${safeJson(features || [])};
const waypoints=${safeJson(waypoints || [])};
const style=${safeJson(style)};
const overlay=${safeJson(overlay || null)};
const labelsVisible=${safeJson(labelsVisible)};
const layerPreferences=${safeJson(layerPreferences || {analysis:{boundary:true,waypoints:true,features:true,relationships:true},field:{current_location:true}})};
const editable=${safeJson(editable)};
const initialUserLocation=${safeJson(userLocation || null)};
const initialUserLocationEnabled=${safeJson(Boolean(userLocationEnabled))};
const initialCamera=${safeJson(camera || null)};
const initialAnalysisFit=${safeJson(Boolean(initialAnalysisFit))};
const map=new mapboxgl.Map({container:'map',style:style,center:initialCamera&&initialCamera.center||centerSafe(),zoom:initialCamera&&initialCamera.zoom||13,bearing:initialCamera&&initialCamera.bearing||0,pitch:initialCamera&&initialCamera.pitch||0,projection:'mercator'});
map.addControl(new mapboxgl.NavigationControl({visualizePitch:true}),'top-right');
let terrainEnabled=false;
function post(type,payload){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type,payload}));}
function centerSafe(){try{return polygon&&polygon.coordinates&&polygon.coordinates[0]&&polygon.coordinates[0][0]||${safeJson(center)}}catch(e){return ${safeJson(center)}}}
function ensureDem(){if(map.getSource('mapbox-dem'))return true;try{map.addSource('mapbox-dem',{type:'raster-dem',url:'mapbox://mapbox.mapbox-terrain-dem-v1',tileSize:512,maxzoom:14});return true}catch(e){return false}}
function set3d(next){terrainEnabled=!!next;if(terrainEnabled&&ensureDem()){map.setTerrain({source:'mapbox-dem',exaggeration:1.45});map.easeTo({pitch:60,bearing:map.getBearing(),duration:650});document.getElementById('toggle-3d').classList.add('active');return}try{map.setTerrain(null)}catch(e){}map.easeTo({pitch:0,bearing:map.getBearing(),duration:650});document.getElementById('toggle-3d').classList.remove('active')}
let locationWatchId=null;const locateButton=document.getElementById('locate-me');const hint=document.querySelector('.hint');function consume(e){e.preventDefault();e.stopPropagation()}function ensureUserLocationLayer(){if(map.getSource('user-location'))return;map.addSource('user-location',{type:'geojson',data:{type:'FeatureCollection',features:[]}});map.addLayer({id:'user-location-dot',type:'circle',source:'user-location',paint:{'circle-radius':7,'circle-color':'#5aa7ff','circle-stroke-color':'#fff','circle-stroke-width':3}})}function setUserLocationMarker(location,moveCamera){if(!location||!Number.isFinite(location.longitude)||!Number.isFinite(location.latitude))return;ensureUserLocationLayer();map.getSource('user-location').setData({type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Point',coordinates:[location.longitude,location.latitude]},properties:{}}]});if(moveCamera)map.easeTo({center:[location.longitude,location.latitude],zoom:15,duration:500});if(locateButton)locateButton.classList.add('active')}function clearUserLocation(){if(locationWatchId!=null&&navigator.geolocation){navigator.geolocation.clearWatch(locationWatchId)}locationWatchId=null;if(map.getSource('user-location'))map.getSource('user-location').setData({type:'FeatureCollection',features:[]});if(locateButton)locateButton.classList.remove('active');postedLocationToHost=false;post('user-location-cleared',{})}let postedLocationToHost=Boolean(initialUserLocation);function updateUserLocation(pos){var location={longitude:pos.coords.longitude,latitude:pos.coords.latitude};setUserLocationMarker(location,true);if(!postedLocationToHost){postedLocationToHost=true;post('user-location',location)}}function showLocationDenied(){if(hint)hint.textContent='Location is unavailable or permission was denied.';clearUserLocation()}function startUserLocation(){if(locationWatchId!=null)return;if(!navigator.geolocation){showLocationDenied();return}locationWatchId=navigator.geolocation.watchPosition(updateUserLocation,showLocationDenied,{enableHighAccuracy:true,maximumAge:10000,timeout:10000})}document.getElementById('toggle-3d').onclick=function(e){consume(e);set3d(!terrainEnabled)};document.getElementById('rotate-left').onclick=function(e){consume(e);map.easeTo({bearing:map.getBearing()-30,duration:400})};document.getElementById('rotate-right').onclick=function(e){consume(e);map.easeTo({bearing:map.getBearing()+30,duration:400})};document.getElementById('reset-north').onclick=function(e){consume(e);map.easeTo({bearing:0,duration:450})};locateButton.onclick=function(e){consume(e);if(locationWatchId!=null){clearUserLocation();return}startUserLocation()};
function category(i){var v=String(i.featureType||(i.properties&&i.properties.definitionKey)||'').toLowerCase();var groups=[['travel',['funnel','pinch','corridor','travel','draw','crossing']],['bedding',['bed','bedding','thermal']],['ridges',['ridge','saddle','bench','spur','knob','hill']],['water',['water','creek','stream','river','drain','pond','wet']],['feeding',['feed','food','staging','field','opening']],['access',['access','wind','pressure','road','trail','route']]];for(var g=0;g<groups.length;g++)for(var t=0;t<groups[g][1].length;t++)if(v.indexOf(groups[g][1][t])>=0)return groups[g][0];return'other'}function fc(items,categorized){return{type:'FeatureCollection',features:(items||[]).filter(function(i){return i&&i.id&&i.geometry}).map(function(i){return{type:'Feature',id:i.id,geometry:i.geometry,properties:{id:i.id,title:i.title||'',featureType:i.featureType||'',waypointType:i.waypointType||'',score:i.score,confidence:i.confidence,sourceFeatureId:i.sourceFeatureId||'',category:categorized?category(i):''}}})}}
function addLayers(){if(overlay&&overlay.layer){map.addSource('usgs-3dep-overlay',{type:'raster',tiles:['${USGS_3DEP_WMS_BASE}?service=WMS&version=1.1.1&request=GetMap&layers='+encodeURIComponent(overlay.layer)+'&styles=&format=image/png&transparent=true&srs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256'],tileSize:256,attribution:'USGS 3DEP / The National Map'});map.addLayer({id:'usgs-3dep-overlay',type:'raster',source:'usgs-3dep-overlay',paint:{'raster-opacity':overlay.value==='hillshade'?.62:.78}})}
if(polygon){map.addSource('analysis-polygon',{type:'geojson',data:{type:'FeatureCollection',features:[{type:'Feature',geometry:polygon,properties:{}}]}});map.addLayer({id:'analysis-polygon-fill',type:'fill',source:'analysis-polygon',paint:{'fill-color':'#d0a65d','fill-opacity':.18}});map.addLayer({id:'analysis-polygon-line',type:'line',source:'analysis-polygon',paint:{'line-color':'#f0d293','line-width':3}})}
map.addSource('analysis-features',{type:'geojson',data:fc(features,true)});map.addLayer({id:'analysis-features-fill',type:'fill',source:'analysis-features',filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':'#d0a65d','fill-opacity':.24}});map.addLayer({id:'analysis-features-line',type:'line',source:'analysis-features',filter:['in',['geometry-type'],['literal',['LineString','Polygon']]],paint:{'line-color':'#e6c27a','line-width':4,'line-opacity':.86}});map.addLayer({id:'analysis-features-circle',type:'circle',source:'analysis-features',filter:['==',['geometry-type'],'Point'],paint:{'circle-color':'#d0a65d','circle-radius':7,'circle-stroke-color':'#10140f','circle-stroke-width':2}});map.addSource('analysis-waypoints',{type:'geojson',data:fc(waypoints,false)});map.addLayer({id:'analysis-waypoints-circle',type:'circle',source:'analysis-waypoints',paint:{'circle-color':'#89b37f','circle-radius':7,'circle-stroke-color':'#e6c27a','circle-stroke-width':2}});map.addSource('analysis-selection',{type:'geojson',data:{type:'FeatureCollection',features:[]}});map.addLayer({id:'analysis-selection-fill',type:'fill',source:'analysis-selection',filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':'#fff2a8','fill-opacity':.35}});map.addLayer({id:'analysis-selection-line',type:'line',source:'analysis-selection',filter:['in',['geometry-type'],['literal',['LineString','Polygon']]],paint:{'line-color':'#fff','line-width':7}});map.addLayer({id:'analysis-selection-circle',type:'circle',source:'analysis-selection',filter:['==',['geometry-type'],'Point'],paint:{'circle-color':'#fff2a8','circle-radius':13,'circle-stroke-color':'#fff','circle-stroke-width':4}});map.addSource('analysis-related',{type:'geojson',data:{type:'FeatureCollection',features:[]}});map.addLayer({id:'analysis-related-circle',type:'circle',source:'analysis-related',paint:{'circle-color':'#89b37f','circle-radius':11,'circle-stroke-color':'#fff','circle-stroke-width':3}});
if(!labelsVisible){(map.getStyle().layers||[]).forEach(function(layer){if(layer.type==='symbol'&&layer.layout&&layer.layout['text-field'])map.setLayoutProperty(layer.id,'visibility','none')})}
[['analysis-polygon-fill','boundary'],['analysis-polygon-line','boundary'],['analysis-features-fill','features'],['analysis-features-line','features'],['analysis-features-circle','features'],['analysis-waypoints-circle','waypoints']].forEach(function(entry){if(map.getLayer(entry[0])&&!layerPreferences.analysis[entry[1]])map.setLayoutProperty(entry[0],'visibility','none')});
try{const b=new mapboxgl.LngLatBounds();let any=false;function walk(c){if(!Array.isArray(c))return;if(typeof c[0]==='number'&&typeof c[1]==='number'){b.extend(c);any=true;return}c.forEach(walk)};if(polygon)walk(polygon.coordinates);if(!initialCamera&&(editable||initialAnalysisFit)&&any)map.fitBounds(b,{padding:56,maxZoom:15,duration:0})}catch(e){}
}
function entity(type,id){var list=type==='waypoint'?waypoints:features;return(list||[]).find(function(i){return i&&i.id===id})}function coords(geometry,out){if(!geometry)return out;function walk(v){if(!Array.isArray(v))return;if(typeof v[0]==='number'&&typeof v[1]==='number'){out.push(v);return}v.forEach(walk)}walk(geometry.coordinates);return out}window.__terrainSelect=function(command){if(!map.isStyleLoaded())return;var item=entity(command.type,command.id),selected=item&&item.geometry?[{type:'Feature',id:item.id,geometry:item.geometry,properties:{id:item.id}}]:[];map.getSource('analysis-selection').setData({type:'FeatureCollection',features:selected});var related=command.type==='terrainFeature'?(waypoints||[]).filter(function(w){return w.sourceFeatureId===command.id}):[];map.getSource('analysis-related').setData(fc(related,false));var categoryId=command.category||null;map.setPaintProperty('analysis-features-circle','circle-opacity',categoryId?['case',['==',['get','category'],categoryId],1,.2]:1);map.setPaintProperty('analysis-features-line','line-opacity',categoryId?['case',['==',['get','category'],categoryId],.95,.18]:.86);map.setPaintProperty('analysis-features-fill','fill-opacity',categoryId?['case',['==',['get','category'],categoryId],.32,.06]:.24);if(!command.focus||!item||!item.geometry)return;var points=coords(item.geometry,[]);if(!points.length)return;if(item.geometry.type==='Point'){map.easeTo({center:points[0],zoom:Math.max(map.getZoom(),14),duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:500});return}var bounds=points.reduce(function(b,p){return b.extend(p)},new mapboxgl.LngLatBounds(points[0],points[0]));map.fitBounds(bounds,{padding:55,maxZoom:15,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:500})};['analysis-features-fill','analysis-features-line','analysis-features-circle'].forEach(function(layer){map.on('click',layer,function(e){var id=e.features&&e.features[0]&&e.features[0].properties.id;if(id)post('result-select',{entityType:'terrainFeature',id:id})})});map.on('click','analysis-waypoints-circle',function(e){var id=e.features&&e.features[0]&&e.features[0].properties.id;if(id)post('result-select',{entityType:'waypoint',id:id})});map.on('load',function(){addLayers();if(initialUserLocation) setUserLocationMarker(initialUserLocation,false);if(initialUserLocationEnabled) startUserLocation();});map.on('moveend',function(){var c=map.getCenter();post('map-camera',{center:[c.lng,c.lat],zoom:map.getZoom(),bearing:map.getBearing(),pitch:map.getPitch()})});map.on('click',function(e){if(!editable)return;post('map-click',{longitude:Number(e.lngLat.lng.toFixed(6)),latitude:Number(e.lngLat.lat.toFixed(6))})});
})();</script></body></html>`;
}


export default function App() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [analysisName, setAnalysisName] = useState("");
  const [analysisMode, setAnalysisMode] = useState<(typeof ANALYSIS_MODE_OPTIONS)[number]["value"]>("whitetail");
  const [savedAnalysisId, setSavedAnalysisId] = useState("");
  const [points, setPoints] = useState<MapPoint[]>(samplePoints());
  const [analysis, setAnalysis] = useState<TerrainAnalysisResponse | null>(null);
  const [initialFitAnalysisId, setInitialFitAnalysisId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selectedWaypoint, setSelectedWaypoint] = useState<TerrainWaypoint | null>(null);
  const [resultsUi, setResultsUi] = useState<any>(createResultsState());
  const [navigationTargetEntity, setNavigationTargetEntity] = useState<any>(null);
  const [basemap, setBasemap] = useState("satellite");
  const [terrainOverlay, setTerrainOverlay] = useState("");
  const [labelsVisible, setLabelsVisible] = useState(true);
  const [userLocation, setUserLocation] = useState<MapPoint | null>(null);
  const [userLocationEnabled, setUserLocationEnabled] = useState(false);
  const [account, setAccount] = useState<any>(undefined);
  const [showAccount, setShowAccount] = useState(false);
  const [orientationReady, setOrientationReady] = useState(false);
  const [orientationVisible, setOrientationVisible] = useState(false);
  const [library, setLibrary] = useState<any>(null);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryReturnScreen, setLibraryReturnScreen] = useState<Screen | null>(null);
  const [offlinePackages, setOfflinePackages] = useState<any[]>([]);
  const [offlineStatus, setOfflineStatus] = useState("");
  const [offlineManifest, setOfflineManifest] = useState<any>(null);
  const [offlineDownload, setOfflineDownload] = useState<{ id: string; controller: AbortController } | null>(null);
  const [layerPreferences, setLayerPreferences] = useState<any>(DEFAULT_LAYER_PREFERENCES);
  const [mapConfig, setMapConfig] = useState<any>({ providers: [] });
  const [purchase,setPurchase]=useState<any>(null);
  const [quotedSetupKey,setQuotedSetupKey]=useState<string|null>(null),[hadQuote,setHadQuote]=useState(false),[quoteLoading,setQuoteLoading]=useState(false);
  const quoteRequest=useRef(false),mapCamera=useRef<any>(null),resultsMapRef=useRef<any>(null),analysisLoadGeneration=useRef(0);

  const polygon = useMemo(() => buildPolygonFromPoints(points), [points]);
  const acreage = useMemo(() => (polygon ? Number(calculateApproximateAcreage(polygon).toFixed(2)) : 0), [polygon]);
  const isValid = acreage >= MIN_ACRES && acreage <= MAX_ACRES;
  const analysisNameError=analysisNameValidationMessage(analysisName);
  const currentSetupKey=useMemo(()=>setupConfigurationKey({analysisName,analysisMode,propertyId:null,polygon}),[analysisName,analysisMode,polygon]);
  const quoteCurrent=quoteMatchesSetup({purchase,quotedSetupKey,currentSetupKey});
  const setupPhase=deriveSetupState({nameError:analysisNameError,polygonValid:Boolean(polygon&&isValid),quoteLoading,paymentBusy:false,processing:screen==="processing",paymentRequired:screen==="payment"&&!purchase?.entitlement,paid:purchase?.entitlement?.status==="active",quoteCurrent,hadQuote});
  const mapHtml=useMemo(()=>{const nextPolygon=analysis?.summary?analysis.requestPolygon||polygon||buildPolygonFromPoints(samplePoints()):polygon;if(!nextPolygon)return null;return buildMapHtml({token:MAPBOX_ACCESS_TOKEN,polygon:nextPolygon,features:analysis?.features||[],waypoints:sortWaypoints(analysis?.waypoints||[]),basemap,terrainOverlay,labelsVisible,layerPreferences,editable:screen==="setup",userLocation,userLocationEnabled,camera:mapCamera.current,initialAnalysisFit:Boolean(analysis?.analysisJobId&&initialFitAnalysisId===analysis.analysisJobId)});},[analysis,polygon,basemap,terrainOverlay,labelsVisible,layerPreferences,screen,userLocation,userLocationEnabled]);
  const mapSource=useMemo(()=>mapHtml?{html:mapHtml}:null,[mapHtml]);

  useEffect(() => { stopSarBackground().catch(()=>{}); fetchAccount().then((session) => setAccount(session.user)).catch(() => setAccount(null)); }, []);
  useEffect(() => { orientationCompleted(SecureStore).then((completed) => setOrientationVisible(!completed)).catch(() => setOrientationVisible(true)).finally(() => setOrientationReady(true)); }, []);
  useEffect(() => { SecureStore.getItemAsync("terrain.mapLayers.v1").then((value)=>{const next=normalizeLayerPreferences(value?JSON.parse(value):{});setLayerPreferences(next);setBasemap(next.basemap);}); fetchMapConfig().then(setMapConfig).catch(()=>{}); }, []);
  useEffect(()=>{if(!analysis||screen!=="results")return;const entity=selectedEntity(resultsUi,analysis);const command={type:resultsUi.selectedEntityType,id:entity?.id||null,category:resultsUi.activeCategoryFilter||null,focus:false};resultsMapRef.current?.injectJavaScript(`window.__terrainSelect&&window.__terrainSelect(${JSON.stringify(command)});true;`);},[analysis?.analysisJobId,screen,resultsUi.selectedEntityType,resultsUi.selectedEntityId,resultsUi.activeCategoryFilter]);
  const setLayers = (next:any) => { setLayerPreferences(next); SecureStore.setItemAsync("terrain.mapLayers.v1",JSON.stringify(next)); };
  const invalidatePurchase=()=>{if(purchase?.quote){setHadQuote(true);setError("Setup changed. Confirm acreage and price again.");}setPurchase(null);setQuotedSetupKey(null);};
  const resetSetup=()=>{analysisLoadGeneration.current+=1;setAnalysis(null);setInitialFitAnalysisId(null);setResultsUi(createResultsState());setNavigationTargetEntity(null);setAnalysisName("");setPoints([]);setPurchase(null);setQuotedSetupKey(null);setHadQuote(false);setQuoteLoading(false);setLibraryReturnScreen(null);setError("");mapCamera.current=null;setScreen("setup");};

  const loadLibrary = async (page = 1) => {
    analysisLoadGeneration.current+=1;setAnalysis(null);setInitialFitAnalysisId(null);setResultsUi(createResultsState());setNavigationTargetEntity(null);setScreen("library"); setLibraryLoading(true); setError("");
    try { setLibrary(await fetchAnalyses(page, 12)); setOfflinePackages(await listOfflinePackages()); }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : "Unable to load My Analyses."); }
    finally { setLibraryLoading(false); }
  };

  const deleteLibraryItems = async (ids: string[]) => {
    const confirmed = await new Promise<boolean>((resolve) => Alert.alert(ids.length === 1 ? "Delete saved analysis?" : `Delete ${ids.length} saved analyses?`, "This cannot be undone.", [{ text: "Cancel", style: "cancel", onPress: () => resolve(false) }, { text: "Delete", style: "destructive", onPress: () => resolve(true) }], { cancelable: true, onDismiss: () => resolve(false) }));
    if (!confirmed) return false;
    try {
      const result = ids.length === 1 ? await deleteAnalysis(ids[0]) : await deleteAnalyses(ids);
      const updated = removeDeletedAnalyses(library, result.deletedIds || ids, result.ownedTotal); setLibrary(updated);
      await Promise.all(ids.map((id) => removeOfflinePackage(id).catch(() => {}))); setOfflinePackages(await listOfflinePackages()); setOfflineStatus(`${result.deletedCount || ids.length} saved ${ids.length === 1 ? "analysis" : "analyses"} deleted.`);
      if (!updated?.items.length && updated?.page > 1) await loadLibrary(updated.page - 1);
      return true;
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "Unable to delete saved analyses."); return false; }
  };

  const finishOrientation = async (destination: "new" | "library" | null) => {
    await completeOrientation(SecureStore); setOrientationVisible(false);
    if (destination === "new") { setShowAccount(false); resetSetup(); }
    if (destination === "library") { setShowAccount(false); await loadLibrary(1); }
  };
  const beginOrientationReplay = async () => { await replayOrientation(SecureStore); setOrientationVisible(true); };

  if (account === undefined) return <SafeAreaView style={styles.safeArea}><View style={styles.container}><Text style={styles.meta}>Restoring secure HuntIntel session…</Text></View></SafeAreaView>;
  if (!account || showAccount) return <><AccountScreen user={account || undefined} onAuthenticated={setAccount} onSignedOut={() => { stopSarBackground().catch(()=>{}); setAccount(null); setShowAccount(false); }} onClose={account ? () => setShowAccount(false) : undefined} onReplayOrientation={() => { void beginOrientationReplay(); }} onOpenDownloads={() => { setShowAccount(false); void loadLibrary(1); }} onOpenAnalyses={() => { setShowAccount(false); void loadLibrary(1); }} appVersion="0.1.0" />{account && orientationReady && <OrientationModal visible={orientationVisible} onComplete={finishOrientation} />}</>;

  const openLibraryAnalysis = async (analysisJobId: string) => {
    const generation=++analysisLoadGeneration.current;setAnalysis(null);setInitialFitAnalysisId(null);setResultsUi(createResultsState(analysisJobId));setNavigationTargetEntity(null);
    try { setError(""); mapCamera.current=null; setScreen("opening"); setSavedAnalysisId(analysisJobId); const next=requireOpenedAnalysis(await fetchAnalysis(analysisJobId),analysisJobId);if(generation!==analysisLoadGeneration.current)return;setInitialFitAnalysisId(analysisJobId);setAnalysis(next);setResultsUi(stateForAnalysis(createResultsState(),analysisJobId));setScreen("results"); }
    catch (nextError) { if(generation!==analysisLoadGeneration.current)return;const cached = await loadOfflinePackage(analysisJobId).catch(() => null); if (cached?.manifest?.analysisJobId===analysisJobId&&cached.manifest.immutable?.analysis?.analysisJobId===analysisJobId) { const immutable = cached.manifest.immutable; setInitialFitAnalysisId(analysisJobId); setAnalysis({ ...immutable.analysis, features: immutable.features, relationships: immutable.relationships, waypoints: immutable.waypoints, report: immutable.report }); setOfflineManifest(cached.manifest); setOfflineStatus("Opened encrypted offline package. Changes will remain pending until sync."); setScreen("results"); } else { setError(nextError instanceof Error ? nextError.message : "Unable to load saved analysis."); setScreen("library"); } }
  };

  const downloadOffline = async (id: string) => { const controller = new AbortController(); setOfflineDownload({ id, controller }); try { setOfflineStatus("Estimating package…"); const attachmentIds = (await fetchAttachments(id)).items?.map((item: any) => item.id) || []; let manifest = await fetchOfflineManifest(id, attachmentIds); const provider = manifest.map.providers[0]; if (provider) manifest = await fetchOfflineManifest(id, attachmentIds, { provider: provider.id, minZoom: provider.minZoom, maxZoom: Math.min(provider.minZoom + 1, provider.maxZoom) }); await downloadAndSaveOfflinePackage(manifest, { apiBaseUrl: terrainApiBaseUrl, signal: controller.signal, onProgress: (progress: any) => setOfflineStatus(`${progress.completedAssets}/${progress.totalAssets} assets · ${Math.floor((progress.completedBytes / Math.max(1, progress.totalBytes)) * 100)}%`) }); setOfflineStatus("Offline package ready."); } catch (nextError) { setOfflineStatus(nextError instanceof Error && nextError.name === "AbortError" ? "Download canceled; tap Resume / Update to continue." : `Download failed; tap Resume / Update to retry. ${nextError instanceof Error ? nextError.message : ""}`); } finally { setOfflineDownload(null); setOfflinePackages(await listOfflinePackages()); } };
  const syncOffline = async (id: string) => { try { await synchronizeOfflinePackage(id, (operations: any[]) => pushOfflineSync(id, operations), (cursor: number) => pullOfflineSync(id, cursor)); setOfflineStatus("Offline changes synchronized."); setOfflinePackages(await listOfflinePackages()); } catch (nextError) { setOfflineStatus(`Pending sync: ${nextError instanceof Error ? nextError.message : "network unavailable"}`); } };
  const removeOffline = async (id: string) => { await removeOfflinePackage(id); setOfflineStatus("Offline package removed."); setOfflinePackages(await listOfflinePackages()); };

  const openSavedAnalysis = async () => {
    if (!savedAnalysisId.trim()) {
      setError("Enter an analysis job ID to reopen a saved analysis.");
      return;
    }

    const requestedAnalysisJobId=savedAnalysisId.trim(),generation=++analysisLoadGeneration.current;setAnalysis(null);setInitialFitAnalysisId(null);setResultsUi(createResultsState(requestedAnalysisJobId));setNavigationTargetEntity(null);
    try {
      setError("");
      mapCamera.current=null;
      setScreen("opening");
      const nextAnalysis = requireOpenedAnalysis(await fetchAnalysis(requestedAnalysisJobId),requestedAnalysisJobId);
      if(generation!==analysisLoadGeneration.current)return;
      setInitialFitAnalysisId(requestedAnalysisJobId);
      setAnalysis(nextAnalysis);
      setResultsUi(stateForAnalysis(createResultsState(),requestedAnalysisJobId));
      setScreen("results");
    } catch (nextError) {
      if(generation!==analysisLoadGeneration.current)return;
      setError(nextError instanceof Error ? nextError.message : "Unable to load saved analysis.");
      setScreen("setup");
    }
  };

  const requestQuote = async () => {
    if (analysisNameError) {
      setError(analysisNameError);
      return;
    }
    if (!polygon) {
      setError("Draw three or more points or use the sample polygon.");
      return;
    }

    if (!isValid) {
      setError(`Polygon acreage must stay between ${MIN_ACRES} and ${MAX_ACRES} acres.`);
      return;
    }

    if (quoteRequest.current) return;
    quoteRequest.current = true;
    setQuoteLoading(true);
    try {
      setError("");
      const trimmedName = normalizedAnalysisName(analysisName);
      const key = setupConfigurationKey({ analysisName: trimmedName, analysisMode, propertyId: null, polygon });
      setAnalysisName(trimmedName);
      const nextPurchase = await createAnalysisDraft({...buildAnalysisRequestPayload({
        analysisName: trimmedName,
        analysisMode,
        species: isWildlifeMode(analysisMode) ? analysisMode : null,
        saveResults: true,
        propertyId: null,
        polygon,
      }),idempotencyKey:Crypto.randomUUID()});
      setPurchase(nextPurchase);
      setQuotedSetupKey(key);
      setHadQuote(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to confirm server acreage and price.");
      setScreen("setup");
    } finally {
      quoteRequest.current = false;
      setQuoteLoading(false);
    }
  };

  const submit=()=>{if(analysisNameError){setError(analysisNameError);return;}if(!quoteMatchesSetup({purchase,quotedSetupKey,currentSetupKey})){setError("Setup changed or the quote expired. Confirm acreage and price again.");invalidatePurchase();return;}setError("");setScreen("payment");};
  const completePaidAnalysis=async(nextAnalysis:any)=>{analysisLoadGeneration.current+=1;setInitialFitAnalysisId(null);setAnalysis(nextAnalysis);setSavedAnalysisId(nextAnalysis.analysisJobId||"");setResultsUi(createResultsState(nextAnalysis.analysisJobId||null));setNavigationTargetEntity(null);mapCamera.current=null;setScreen("results");};

  const addPoint = (event: { nativeEvent: { locationX: number; locationY: number } }) => {
    const longitude = -87.02 + (event.nativeEvent.locationX / MAP_WIDTH) * 0.36;
    const latitude = 32.45 + ((MAP_HEIGHT - event.nativeEvent.locationY) / MAP_HEIGHT) * 0.22;
    invalidatePurchase();setPoints((current) => [...current, { longitude: Number(longitude.toFixed(6)), latitude: Number(latitude.toFixed(6)) }]);
  };

  const addLngLatPoint = (point: MapPoint) => {
    invalidatePurchase();setPoints((current) => [...current, point]);
  };

  const selectResultEntity=(type:string,id:string,focus=true)=>{if(!analysis)return;const next=selectEntity(resultsUi,analysis,type,id);setResultsUi(next);const entity=selectedEntity(next,analysis);resultsMapRef.current?.injectJavaScript(`window.__terrainSelect&&window.__terrainSelect(${JSON.stringify({type,id:entity?.id||null,category:next.activeCategoryFilter||null,focus})});true;`);};
  const navigateToResult=(entity:any)=>{const target=navigationTarget(entity);if(!target)return;setNavigationTargetEntity({...entity,geometry:{type:"Point",coordinates:[target.longitude,target.latitude]}});setResultsUi((current:any)=>({...current,activeResultsTab:"navigation"}));};

  const handleMapMessage = (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === "map-click" && typeof message.payload?.longitude === "number" && typeof message.payload?.latitude === "number") {
        addLngLatPoint(message.payload);
      }
      if (message.type === "user-location" && typeof message.payload?.longitude === "number" && typeof message.payload?.latitude === "number") {
        setUserLocation(message.payload);
        setUserLocationEnabled(true);
      }
      if (message.type === "user-location-cleared") {
        setUserLocation(null);
        setUserLocationEnabled(false);
      }
      if (message.type === "map-camera" && Array.isArray(message.payload?.center)) { mapCamera.current = message.payload; if (initialFitAnalysisId) setInitialFitAnalysisId(null); }
      if (message.type === "result-select" && message.payload?.id && ["waypoint","terrainFeature"].includes(message.payload.entityType)) selectResultEntity(message.payload.entityType,message.payload.id,false);
    } catch {
      // Ignore non-HuntIntel WebView messages.
    }
  };

  const renderMapControls = () => (
    <View style={styles.mapControlPanel}>
      <Text style={styles.meta}>Basemap</Text>
      <View style={styles.row}>
        {MAPBOX_STYLE_OPTIONS.map((option: any) => <ActionButton key={option.value} label={option.label} onPress={() => {setBasemap(option.value);setLayers(normalizeLayerPreferences({...layerPreferences,basemap:option.value}));}} primary={basemap === option.value} />)}
      </View>
      <Text style={styles.meta}>USGS 3DEP overlay</Text>
      <View style={styles.row}>
        {USGS_TERRAIN_OVERLAY_OPTIONS.map((option: any) => <ActionButton key={option.value || "none"} label={option.label} onPress={() => setTerrainOverlay(option.value)} primary={terrainOverlay === option.value} />)}
      </View>
      <View style={styles.row}>
        <ActionButton label="Labels" onPress={() => setLabelsVisible((current) => !current)} primary={labelsVisible} />
      </View>
      <Text style={styles.meta}>Analysis layers</Text><View style={styles.row}>{Object.keys(layerPreferences.analysis).map((key)=><ActionButton key={key} label={key} onPress={()=>setLayers(toggleLayer(layerPreferences,"analysis",key))} primary={layerPreferences.analysis[key]}/>)}</View>
      <Text style={styles.meta}>Field layers</Text><View style={styles.row}>{Object.keys(layerPreferences.field).map((key)=><ActionButton key={key} label={key.replace("_"," ")} onPress={()=>setLayers(toggleLayer(layerPreferences,"field",key))} primary={layerPreferences.field[key]}/>)}</View>
      <Text style={styles.meta}>GIS layers</Text><View style={styles.row}>{Object.keys(layerPreferences.gis).map((key)=>{const available=key!=="parcels"||mapConfig.providers.some((p:any)=>p.layers?.some((l:any)=>l.type===key));return <ActionButton key={key} label={available?key:`${key} unavailable`} disabled={!available} onPress={()=>setLayers(toggleLayer(layerPreferences,"gis",key))} primary={layerPreferences.gis[key]}/>})}</View>
      <Text style={styles.meta}>Team layers</Text><View style={styles.row}><ActionButton label="Team Positions (Live SAR)" onPress={() => setScreen("sar")} /></View>
    </View>
  );

  const renderMap = () => {
    if (offlineManifest?.map?.tilePlan) return <View style={styles.mapWeb}><WebView originWhitelist={["*"]} source={{ html: renderOfflineMapHtml(offlineManifest) }} /></View>;
    const nextPolygon = analysis?.summary ? analysis.requestPolygon || polygon || buildPolygonFromPoints(samplePoints()) : polygon;
    if (!nextPolygon) {
      return null;
    }

    const features = analysis?.features || [];
    const waypoints = sortWaypoints(analysis?.waypoints || []);
    const bounds = getBounds(nextPolygon, waypoints, features);

    if (HAS_MAPBOX_ACCESS_TOKEN) {
      return (
        <View style={styles.mapWeb}>
          <WebView
            originWhitelist={["*"]}
            geolocationEnabled
            ref={screen === "results" ? resultsMapRef : undefined}
            source={mapSource!}
            onMessage={handleMapMessage}
            style={styles.webView}
          />
        </View>
      );
    }

    return (
      <Pressable style={styles.map} onPress={screen === "setup" ? addPoint : undefined}>
        {nextPolygon.coordinates[0].slice(0, -1).map((coordinate: [number, number], index: number) => {
          const marker = projectCoordinate(coordinate, bounds, MAP_WIDTH, MAP_HEIGHT);
          return <View key={`polygon-${index}`} style={[styles.vertex, { left: marker.left - 6, top: marker.top - 6 }]} />;
        })}
        {screen !== "setup" &&
          features.filter((feature)=>entityGeometry(feature)?.type==="Point").map((feature) => {
            const marker = projectCoordinate(entityGeometry(feature).coordinates, bounds, MAP_WIDTH, MAP_HEIGHT);
            return <Pressable accessibilityRole="button" key={feature.id} onPress={()=>selectResultEntity("terrainFeature",feature.id,false)} style={[styles.featureDot, resultsUi.selectedEntityType==="terrainFeature"&&resultsUi.selectedEntityId===feature.id&&styles.selectedMapDot, { left: marker.left - 5, top: marker.top - 5 }]} />;
          })}
        {screen !== "setup" &&
          waypoints.filter((waypoint)=>entityGeometry(waypoint)?.type==="Point").map((waypoint) => {
            const marker = projectCoordinate(entityGeometry(waypoint).coordinates, bounds, MAP_WIDTH, MAP_HEIGHT);
            return <Pressable accessibilityRole="button" key={waypoint.id} onPress={()=>selectResultEntity("waypoint",waypoint.id,false)} style={[styles.waypointDot, resultsUi.selectedEntityType==="waypoint"&&resultsUi.selectedEntityId===waypoint.id&&styles.selectedMapDot, { left: marker.left - 5, top: marker.top - 5 }]} />;
          })}
      </Pressable>
    );
  };

  const waypointCards = sortWaypoints(analysis?.waypoints || []);
  const analysisDate = analysis?.completedAt || analysis?.createdAt || null;

  if (screen === "opening") return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.openingAnalysis} accessibilityRole="progressbar" accessibilityLabel="Opening Analysis">
        <ActivityIndicator size="large" color="#d0a65d" />
        <Text style={styles.sectionTitle}>Opening Analysis...</Text>
        <Text style={styles.meta}>Loading the saved boundary and analysis results.</Text>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.appHeader}><View style={styles.headerText}><Text style={styles.eyebrow}>HuntIntel</Text><Text style={styles.title}>Terrain Intelligence</Text><Text style={styles.subtitle}>API gateway: {terrainApiBaseUrl}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Open Account" style={styles.gearButton} onPress={() => setShowAccount(true)}><Text style={styles.gearText}>⚙︎</Text></Pressable></View>
        <ActionButton label="My Analyses" onPress={() => loadLibrary(1)} primary={screen === "library"} />
        <ActionButton label="Teams" onPress={() => setScreen("teams")} primary={screen === "teams"} />
        <ActionButton label="Live SAR" onPress={() => setScreen("sar")} primary={screen === "sar"} />

        {screen === "library" && <LibraryScreen library={library} loading={libraryLoading} error={error} offlinePackages={offlinePackages} offlineStatus={offlineStatus} downloadingId={offlineDownload?.id} onPage={loadLibrary} onOpen={openLibraryAnalysis} onNew={resetSetup} onDelete={deleteLibraryItems} onReturnCurrent={libraryReturnScreen ? () => { setScreen(libraryReturnScreen); setLibraryReturnScreen(null); } : undefined} onDownload={downloadOffline} onCancel={() => offlineDownload?.controller.abort()} onSync={syncOffline} onRemove={removeOffline} />}
        {screen === "teams" && <TeamsScreen onClose={() => setScreen("setup")} />}
        {screen === "sar" && <SarScreen onClose={() => setScreen("setup")} />}

        {screen === "setup" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Analysis Setup</Text>
            <Text style={styles.meta}>Draw a real geospatial land area, submit a wildlife, SAR, or terrain assessment analysis, and review features, relationships, waypoints, and the deterministic HTIE report.</Text>
            <TextInput style={styles.input} value={analysisName} onChangeText={(value)=>{invalidatePurchase();setAnalysisName(value)}} placeholder="Enter Analysis Name" placeholderTextColor="#7f8d7a" maxLength={120} />
            {analysisNameError ? <Text style={styles.error}>{analysisNameError}</Text> : null}
            <Text style={styles.meta}>Analysis mode: {analysisModeLabel(analysisMode)}</Text>
            <View style={styles.row}>
              {ANALYSIS_MODE_OPTIONS.map((option) => (
                <ActionButton
                  key={option.value}
                  label={option.label}
                  onPress={() => {invalidatePurchase();setAnalysisMode(option.value)}}
                  primary={analysisMode === option.value}
                />
              ))}
            </View>
            <Text style={[styles.meta, isValid ? styles.success : styles.error]}>
              {polygon ? `${acreage.toLocaleString()} acres` : "Tap the terrain canvas to add polygon points."}
            </Text>
            {purchase?.quote?<View style={styles.purchaseQuote}><Text style={styles.itemTitle}>{purchase.quote.label} — {purchase.quote.displayPrice}</Text><Text style={styles.meta}>{Number(purchase.quote.acreage).toLocaleString()} server-calculated acres</Text><Text style={styles.meta}>One-time purchase. Permanently unlocks this analysis for your account.</Text></View>:<Text style={styles.meta}>Confirm server acreage and price: up to 1,000 acres is $9.99; 1,001–2,000 acres is $14.99.</Text>}
            {renderMapControls()}
            {renderMap()}
            <View style={styles.row}>
              <ActionButton label="Confirm Acreage & Price" onPress={requestQuote} disabled={!new Set(["ready_for_quote","quoted","quote_stale"]).has(setupPhase)} />
              <ActionButton label="Analyze Terrain" onPress={submit} primary disabled={setupPhase!=="quoted"} />
              <ActionButton label="Sample Polygon" onPress={() => {invalidatePurchase();mapCamera.current=null;setPoints(samplePoints())}} />
            </View>
            <View style={styles.row}>
              <ActionButton label="Clear" onPress={() => {invalidatePurchase();setPoints([])}} />
            </View>
            <TextInput
              style={styles.input}
              value={savedAnalysisId}
              onChangeText={setSavedAnalysisId}
              placeholder="Saved analysis job id"
              placeholderTextColor="#7f8d7a"
            />
            <ActionButton label="Open Saved Analysis" onPress={openSavedAnalysis} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        )}

        {screen==="payment"&&purchase&&<PaymentGate initial={purchase} onComplete={completePaidAnalysis} onBack={()=>setScreen("setup")} onQuoteInvalid={()=>{invalidatePurchase();setScreen("setup")}} onPurchaseChange={setPurchase} onLibraryLimit={()=>{setLibraryReturnScreen("payment");void loadLibrary(1)}}/>}

        {screen === "processing" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Processing</Text>
            <Text style={styles.meta}>HTIE is generating features, relationships, waypoints, and a deterministic report.</Text>
          </View>
        )}

        {screen === "results" && analysis && (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>ANALYSIS RESULTS</Text>
            <Text style={styles.sectionTitle}>{String(analysis.analysisName || analysis.summary?.analysisName || analysis.report?.title || "Terrain Analysis")}</Text>
            <Text style={styles.meta}>Saved analysis: {analysis.analysisJobId || "not persisted"}</Text>
            <Text style={styles.meta}>Mode: {analysisModeLabel(analysis.analysisMode)} · Status: {analysis.status}{analysisDate?` · ${new Date(analysisDate).toLocaleDateString()}`:""}</Text>
            {renderMapControls()}
            {renderMap()}
            <Text style={styles.metric}>Approximate acreage: {Number(analysis.summary?.approximateAcreage || acreage).toLocaleString()} acres</Text>
            <Text style={styles.metric}>Features: {analysis.features.length}</Text>
            <Text style={styles.metric}>Waypoints: {analysis.waypoints.length}</Text>
            <View style={styles.reportPanel}><Text style={styles.sectionTitle}>{analysis.report?.title || "HTIE Report"}</Text><Text style={styles.meta}>{analysis.report?.overview || "No overview returned."}</Text><Text style={styles.sectionSubtitle}>Key Findings</Text>{(analysis.report?.keyFindings||[]).map((finding:string,index:number)=><Text key={`finding-${index}`} style={styles.meta}>• {finding}</Text>)}{analysis.report?.huntingStrategy?<><Text style={styles.sectionSubtitle}>Hunting Strategy</Text>{(Array.isArray(analysis.report.huntingStrategy)?analysis.report.huntingStrategy:[analysis.report.huntingStrategy]).map((item:string,index:number)=><Text key={`strategy-${index}`} style={styles.meta}>• {item}</Text>)}</>:null}<Text style={styles.sectionSubtitle}>Scouting Notes</Text>{(analysis.report?.scoutingNotes||[]).map((note:string,index:number)=><Text key={`scouting-${index}`} style={styles.meta}>• {note}</Text>)}<Text style={styles.sectionSubtitle}>Limitations</Text>{(analysis.report?.limitations||[]).map((item:string,index:number)=><Text key={`limitation-${index}`} style={styles.meta}>• {item}</Text>)}</View>
            {!!(analysis.analysisJobId || savedAnalysisId) && <PdfReportPanel key={analysis.analysisJobId || savedAnalysisId} analysisJobId={analysis.analysisJobId || savedAnalysisId} />}
            <AnalysisResultsTabs analysis={analysis} analysisJobId={analysis.analysisJobId || savedAnalysisId} resultsUi={resultsUi} setResultsUi={setResultsUi} onSelect={selectResultEntity} onNavigate={navigateToResult} navigationTargetEntity={navigationTargetEntity} />
            <View style={styles.row}>
              <ActionButton label="Open Report" onPress={() => setScreen("report")} primary />
              <ActionButton label="Back to Setup" onPress={() => setScreen("setup")} />
            </View>
          </View>
        )}

        {screen === "report" && analysis && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Report</Text>
            <Text style={styles.itemTitle}>{analysis.report.title}</Text>
            <Text style={styles.meta}>{analysis.report.overview}</Text>
            <Text style={styles.sectionSubtitle}>Key Findings</Text>
            {analysis.report.keyFindings.map((finding, index) => (
              <Text key={index} style={styles.meta}>
                • {finding}
              </Text>
            ))}
            <Text style={styles.sectionSubtitle}>Scouting Notes</Text>
            {analysis.report.scoutingNotes.map((note, index) => (
              <Text key={index} style={styles.meta}>
                • {note}
              </Text>
            ))}
            <ActionButton label="Back to Results" onPress={() => setScreen("results")} />
          </View>
        )}

        {screen === "waypoint" && selectedWaypoint && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Waypoint Detail</Text>
            <Text style={styles.itemTitle}>{selectedWaypoint.title}</Text>
            <Text style={styles.meta}>{selectedWaypoint.waypointType}</Text>
            <Text style={styles.meta}>{selectedWaypoint.reason || "Deterministic HTIE waypoint."}</Text>
            <Text style={styles.meta}>Score {selectedWaypoint.score.toFixed(1)}</Text>
            <ActionButton label="Back to Results" onPress={() => setScreen("results")} />
          </View>
        )}
      </ScrollView>
      {orientationReady && <OrientationModal visible={orientationVisible} onComplete={finishOrientation} />}
    </SafeAreaView>
  );
}

function ActionButton({
  label,
  onPress,
  primary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable style={[styles.button, primary && styles.buttonPrimary, disabled && styles.buttonDisabled]} onPress={onPress} disabled={disabled}>
      <Text style={[styles.buttonText, primary && styles.buttonPrimaryText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#10140f",
  },
  container: {
    padding: 20,
    gap: 16,
    backgroundColor: "#10140f",
  },
  appHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerText: { flex: 1, gap: 4 },
  gearButton: { width: 48, height: 48, borderRadius: 14, backgroundColor: "#1b2518", borderWidth: 1, borderColor: "#31412d", alignItems: "center", justifyContent: "center" },
  gearText: { color: "#e7eee1", fontSize: 24 },
  eyebrow: {
    color: "#d0a65d",
    textTransform: "uppercase",
    letterSpacing: 2,
    fontSize: 12,
  },
  title: {
    color: "#f0f3ea",
    fontSize: 30,
    fontWeight: "800",
  },
  subtitle: {
    color: "#9cab97",
  },
  card: {
    backgroundColor: "#182019",
    borderRadius: 24,
    padding: 18,
    gap: 12,
  },
  openingAnalysis: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },
  sectionTitle: {
    color: "#f0f3ea",
    fontSize: 22,
    fontWeight: "700",
  },
  sectionSubtitle: {
    color: "#d0a65d",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 8,
  },
  input: {
    backgroundColor: "#0f140f",
    color: "#f0f3ea",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  button: {
    backgroundColor: "#243025",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonPrimary: {
    backgroundColor: "#d0a65d",
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: "#f0f3ea",
    fontWeight: "700",
  },
  buttonPrimaryText: {
    color: "#1f180f",
  },
  mapWeb: {
    height: MAP_HEIGHT,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#314a35",
    marginVertical: 14,
    backgroundColor: "#0b0f0c",
  },
  webView: { flex: 1, backgroundColor: "#0b0f0c" },
  mapControlPanel: { gap: 8, marginTop: 12, marginBottom: 4 },
  map: {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    borderRadius: 20,
    backgroundColor: "#263126",
    borderWidth: 1,
    borderColor: "#445340",
    overflow: "hidden",
  },
  vertex: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: "#f0d293",
  },
  featureDot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#d0a65d",
  },
  waypointDot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#7eb07d",
  },
  selectedMapDot: {
    width: 18,
    height: 18,
    borderWidth: 4,
    borderColor: "#ffffff",
    transform: [{ translateX: -4 }, { translateY: -4 }],
  },
  metric: {
    color: "#f0f3ea",
  },
  meta: {
    color: "#9cab97",
    lineHeight: 20,
  },
  item: {
    backgroundColor: "#0f140f",
    padding: 14,
    borderRadius: 16,
  },
  itemTitle: {
    color: "#f0f3ea",
    fontWeight: "700",
    fontSize: 16,
  },
  reportPanel:{backgroundColor:"#0f140f",borderRadius:16,padding:14,gap:8,marginTop:12},
  purchaseQuote:{backgroundColor:"#24251a",borderColor:"#d0a65d",borderWidth:1,borderRadius:16,padding:14,gap:6},
  error: {
    color: "#d68375",
  },
  success: {
    color: "#8ab182",
  },
});
