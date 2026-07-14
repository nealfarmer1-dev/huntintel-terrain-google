import React, { useEffect, useMemo, useState } from "react";
import { WebView } from "react-native-webview";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { createAnalysis, fetchAccount, fetchAnalyses, fetchAnalysis, terrainApiBaseUrl } from "./src/api";
import { AccountScreen } from "./src/AccountScreen";
import { LibraryScreen } from "./src/LibraryScreen";
import { buildPolygonFromPoints, calculateApproximateAcreage, getBounds, projectCoordinate, samplePoints } from "./src/terrain";
import { MAPBOX_STYLE_OPTIONS, USGS_3DEP_WMS_BASE, USGS_TERRAIN_OVERLAY_OPTIONS, buildAnalysisRequestPayload, mapboxStyleFor, resolveMapboxAccessToken } from "./src/terrain-map";
import type { TerrainAnalysisResponse, TerrainWaypoint } from "./src/terrain-contract";

const MIN_ACRES = 5;
const MAX_ACRES = 5000;
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

type Screen = "setup" | "processing" | "results" | "report" | "waypoint" | "library";
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

function buildMapHtml({ token, polygon, features, waypoints, basemap, terrainOverlay, labelsVisible, editable, userLocation, userLocationEnabled }: any) {
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
const editable=${safeJson(editable)};
const initialUserLocation=${safeJson(userLocation || null)};
const initialUserLocationEnabled=${safeJson(Boolean(userLocationEnabled))};
const map=new mapboxgl.Map({container:'map',style:style,center:centerSafe(),zoom:13,projection:'mercator'});
map.addControl(new mapboxgl.NavigationControl({visualizePitch:true}),'top-right');
let terrainEnabled=false;
function post(type,payload){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type,payload}));}
function centerSafe(){try{return polygon&&polygon.coordinates&&polygon.coordinates[0]&&polygon.coordinates[0][0]||${safeJson(center)}}catch(e){return ${safeJson(center)}}}
function ensureDem(){if(map.getSource('mapbox-dem'))return true;try{map.addSource('mapbox-dem',{type:'raster-dem',url:'mapbox://mapbox.mapbox-terrain-dem-v1',tileSize:512,maxzoom:14});return true}catch(e){return false}}
function set3d(next){terrainEnabled=!!next;if(terrainEnabled&&ensureDem()){map.setTerrain({source:'mapbox-dem',exaggeration:1.45});map.easeTo({pitch:60,bearing:map.getBearing(),duration:650});document.getElementById('toggle-3d').classList.add('active');return}try{map.setTerrain(null)}catch(e){}map.easeTo({pitch:0,bearing:map.getBearing(),duration:650});document.getElementById('toggle-3d').classList.remove('active')}
let locationWatchId=null;const locateButton=document.getElementById('locate-me');const hint=document.querySelector('.hint');function consume(e){e.preventDefault();e.stopPropagation()}function ensureUserLocationLayer(){if(map.getSource('user-location'))return;map.addSource('user-location',{type:'geojson',data:{type:'FeatureCollection',features:[]}});map.addLayer({id:'user-location-dot',type:'circle',source:'user-location',paint:{'circle-radius':7,'circle-color':'#5aa7ff','circle-stroke-color':'#fff','circle-stroke-width':3}})}function setUserLocationMarker(location,moveCamera){if(!location||!Number.isFinite(location.longitude)||!Number.isFinite(location.latitude))return;ensureUserLocationLayer();map.getSource('user-location').setData({type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Point',coordinates:[location.longitude,location.latitude]},properties:{}}]});if(moveCamera)map.easeTo({center:[location.longitude,location.latitude],zoom:15,duration:500});if(locateButton)locateButton.classList.add('active')}function clearUserLocation(){if(locationWatchId!=null&&navigator.geolocation){navigator.geolocation.clearWatch(locationWatchId)}locationWatchId=null;if(map.getSource('user-location'))map.getSource('user-location').setData({type:'FeatureCollection',features:[]});if(locateButton)locateButton.classList.remove('active');postedLocationToHost=false;post('user-location-cleared',{})}let postedLocationToHost=Boolean(initialUserLocation);function updateUserLocation(pos){var location={longitude:pos.coords.longitude,latitude:pos.coords.latitude};setUserLocationMarker(location,true);if(!postedLocationToHost){postedLocationToHost=true;post('user-location',location)}}function showLocationDenied(){if(hint)hint.textContent='Location is unavailable or permission was denied.';clearUserLocation()}function startUserLocation(){if(locationWatchId!=null)return;if(!navigator.geolocation){showLocationDenied();return}locationWatchId=navigator.geolocation.watchPosition(updateUserLocation,showLocationDenied,{enableHighAccuracy:true,maximumAge:10000,timeout:10000})}document.getElementById('toggle-3d').onclick=function(e){consume(e);set3d(!terrainEnabled)};document.getElementById('rotate-left').onclick=function(e){consume(e);map.easeTo({bearing:map.getBearing()-30,duration:400})};document.getElementById('rotate-right').onclick=function(e){consume(e);map.easeTo({bearing:map.getBearing()+30,duration:400})};document.getElementById('reset-north').onclick=function(e){consume(e);map.easeTo({bearing:0,duration:450})};locateButton.onclick=function(e){consume(e);if(locationWatchId!=null){clearUserLocation();return}startUserLocation()};
function fc(items){return{type:'FeatureCollection',features:(items||[]).filter(function(i){return i&&i.geometry}).map(function(i){return{type:'Feature',geometry:i.geometry,properties:i}})}}
function addLayers(){if(overlay&&overlay.layer){map.addSource('usgs-3dep-overlay',{type:'raster',tiles:['${USGS_3DEP_WMS_BASE}?service=WMS&version=1.1.1&request=GetMap&layers='+encodeURIComponent(overlay.layer)+'&styles=&format=image/png&transparent=true&srs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256'],tileSize:256,attribution:'USGS 3DEP / The National Map'});map.addLayer({id:'usgs-3dep-overlay',type:'raster',source:'usgs-3dep-overlay',paint:{'raster-opacity':overlay.value==='hillshade'?.62:.78}})}
if(polygon){map.addSource('analysis-polygon',{type:'geojson',data:{type:'FeatureCollection',features:[{type:'Feature',geometry:polygon,properties:{}}]}});map.addLayer({id:'analysis-polygon-fill',type:'fill',source:'analysis-polygon',paint:{'fill-color':'#d0a65d','fill-opacity':.18}});map.addLayer({id:'analysis-polygon-line',type:'line',source:'analysis-polygon',paint:{'line-color':'#f0d293','line-width':3}})}
map.addSource('analysis-features',{type:'geojson',data:fc(features)});map.addLayer({id:'analysis-features-circle',type:'circle',source:'analysis-features',paint:{'circle-color':'#d0a65d','circle-radius':7,'circle-stroke-color':'#10140f','circle-stroke-width':2}});map.addSource('analysis-waypoints',{type:'geojson',data:fc(waypoints)});map.addLayer({id:'analysis-waypoints-circle',type:'circle',source:'analysis-waypoints',paint:{'circle-color':'#89b37f','circle-radius':7,'circle-stroke-color':'#e6c27a','circle-stroke-width':2}});
if(!labelsVisible){(map.getStyle().layers||[]).forEach(function(layer){if(layer.type==='symbol'&&layer.layout&&layer.layout['text-field'])map.setLayoutProperty(layer.id,'visibility','none')})}
try{const b=new mapboxgl.LngLatBounds();let any=false;function walk(c){if(!Array.isArray(c))return;if(typeof c[0]==='number'&&typeof c[1]==='number'){b.extend(c);any=true;return}c.forEach(walk)};if(polygon)walk(polygon.coordinates);features.forEach(function(i){walk(i.geometry&&i.geometry.coordinates)});waypoints.forEach(function(i){walk(i.geometry&&i.geometry.coordinates)});if(any)map.fitBounds(b,{padding:45,maxZoom:15,duration:0})}catch(e){}
}
map.on('load',function(){addLayers();if(initialUserLocation) setUserLocationMarker(initialUserLocation,false);if(initialUserLocationEnabled) startUserLocation();});map.on('click',function(e){if(!editable)return;post('map-click',{longitude:Number(e.lngLat.lng.toFixed(6)),latitude:Number(e.lngLat.lat.toFixed(6))})});
})();</script></body></html>`;
}


export default function App() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [analysisName, setAnalysisName] = useState("Weekend Test Property");
  const [analysisMode, setAnalysisMode] = useState<(typeof ANALYSIS_MODE_OPTIONS)[number]["value"]>("whitetail");
  const [savedAnalysisId, setSavedAnalysisId] = useState("");
  const [points, setPoints] = useState<MapPoint[]>(samplePoints());
  const [analysis, setAnalysis] = useState<TerrainAnalysisResponse | null>(null);
  const [error, setError] = useState("");
  const [selectedWaypoint, setSelectedWaypoint] = useState<TerrainWaypoint | null>(null);
  const [basemap, setBasemap] = useState("satellite");
  const [terrainOverlay, setTerrainOverlay] = useState("");
  const [labelsVisible, setLabelsVisible] = useState(true);
  const [userLocation, setUserLocation] = useState<MapPoint | null>(null);
  const [userLocationEnabled, setUserLocationEnabled] = useState(false);
  const [account, setAccount] = useState<any>(undefined);
  const [showAccount, setShowAccount] = useState(false);
  const [library, setLibrary] = useState<any>(null);
  const [libraryLoading, setLibraryLoading] = useState(false);

  const polygon = useMemo(() => buildPolygonFromPoints(points), [points]);
  const acreage = useMemo(() => (polygon ? Number(calculateApproximateAcreage(polygon).toFixed(2)) : 0), [polygon]);
  const isValid = acreage >= MIN_ACRES && acreage <= MAX_ACRES;

  useEffect(() => { fetchAccount().then((session) => setAccount(session.user)).catch(() => setAccount(null)); }, []);

  if (account === undefined) return <SafeAreaView style={styles.safeArea}><View style={styles.container}><Text style={styles.meta}>Restoring secure HuntIntel session…</Text></View></SafeAreaView>;
  if (!account || showAccount) return <AccountScreen user={account || undefined} onAuthenticated={setAccount} onSignedOut={() => { setAccount(null); setShowAccount(false); }} onClose={account ? () => setShowAccount(false) : undefined} />;

  const loadLibrary = async (page = 1) => {
    setScreen("library"); setLibraryLoading(true); setError("");
    try { setLibrary(await fetchAnalyses(page, 12)); }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : "Unable to load My Analyses."); }
    finally { setLibraryLoading(false); }
  };

  const openLibraryAnalysis = async (analysisJobId: string) => {
    try { setError(""); setScreen("processing"); setSavedAnalysisId(analysisJobId); setAnalysis(await fetchAnalysis(analysisJobId)); setScreen("results"); }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : "Unable to load saved analysis."); setScreen("library"); }
  };

  const openSavedAnalysis = async () => {
    if (!savedAnalysisId.trim()) {
      setError("Enter an analysis job ID to reopen a saved analysis.");
      return;
    }

    try {
      setError("");
      setScreen("processing");
      const nextAnalysis = await fetchAnalysis(savedAnalysisId.trim());
      setAnalysis(nextAnalysis);
      setScreen("results");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load saved analysis.");
      setScreen("setup");
    }
  };

  const submit = async () => {
    if (!polygon) {
      setError("Draw three or more points or use the sample polygon.");
      return;
    }

    if (!isValid) {
      setError(`Polygon acreage must stay between ${MIN_ACRES} and ${MAX_ACRES} acres.`);
      return;
    }

    try {
      setError("");
      setScreen("processing");
      const nextAnalysis = await createAnalysis(buildAnalysisRequestPayload({
        analysisName,
        analysisMode,
        species: isWildlifeMode(analysisMode) ? analysisMode : null,
        saveResults: true,
        propertyId: null,
        polygon,
      }));
      setAnalysis(nextAnalysis);
      setSavedAnalysisId(nextAnalysis.analysisJobId || "");
      setScreen("results");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Terrain analysis failed.");
      setScreen("setup");
    }
  };

  const addPoint = (event: { nativeEvent: { locationX: number; locationY: number } }) => {
    const longitude = -87.02 + (event.nativeEvent.locationX / MAP_WIDTH) * 0.36;
    const latitude = 32.45 + ((MAP_HEIGHT - event.nativeEvent.locationY) / MAP_HEIGHT) * 0.22;
    setPoints((current) => [...current, { longitude: Number(longitude.toFixed(6)), latitude: Number(latitude.toFixed(6)) }]);
  };

  const addLngLatPoint = (point: MapPoint) => {
    setPoints((current) => [...current, point]);
  };

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
    } catch {
      // Ignore non-HuntIntel WebView messages.
    }
  };

  const renderMapControls = () => (
    <View style={styles.mapControlPanel}>
      <Text style={styles.meta}>Basemap</Text>
      <View style={styles.row}>
        {MAPBOX_STYLE_OPTIONS.map((option: any) => <ActionButton key={option.value} label={option.label} onPress={() => setBasemap(option.value)} primary={basemap === option.value} />)}
      </View>
      <Text style={styles.meta}>USGS 3DEP overlay</Text>
      <View style={styles.row}>
        {USGS_TERRAIN_OVERLAY_OPTIONS.map((option: any) => <ActionButton key={option.value || "none"} label={option.label} onPress={() => setTerrainOverlay(option.value)} primary={terrainOverlay === option.value} />)}
      </View>
      <View style={styles.row}>
        <ActionButton label="Labels" onPress={() => setLabelsVisible((current) => !current)} primary={labelsVisible} />
      </View>
    </View>
  );

  const renderMap = () => {
    const nextPolygon = analysis?.summary ? polygon || buildPolygonFromPoints(samplePoints()) : polygon;
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
            source={{ html: buildMapHtml({ token: MAPBOX_ACCESS_TOKEN, polygon: nextPolygon, features, waypoints, basemap, terrainOverlay, labelsVisible, editable: screen === "setup", userLocation, userLocationEnabled }) }}
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
          features.map((feature) => {
            const marker = projectCoordinate(feature.geometry.coordinates, bounds, MAP_WIDTH, MAP_HEIGHT);
            return <View key={feature.id} style={[styles.featureDot, { left: marker.left - 5, top: marker.top - 5 }]} />;
          })}
        {screen !== "setup" &&
          waypoints.map((waypoint) => {
            const marker = projectCoordinate(waypoint.geometry.coordinates, bounds, MAP_WIDTH, MAP_HEIGHT);
            return <View key={waypoint.id} style={[styles.waypointDot, { left: marker.left - 5, top: marker.top - 5 }]} />;
          })}
      </Pressable>
    );
  };

  const waypointCards = sortWaypoints(analysis?.waypoints || []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>HuntIntel Terrain</Text>
        <Text style={styles.title}>Android Emulator MVP</Text>
        <Text style={styles.subtitle}>API gateway: {terrainApiBaseUrl}</Text>
        <ActionButton label="My Analyses" onPress={() => loadLibrary(1)} primary={screen === "library"} />
        <ActionButton label="Account & Security" onPress={() => setShowAccount(true)} />

        {screen === "library" && <LibraryScreen library={library} loading={libraryLoading} error={error} onPage={loadLibrary} onOpen={openLibraryAnalysis} onNew={() => setScreen("setup")} />}

        {screen === "setup" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Analysis Setup</Text>
            <TextInput style={styles.input} value={analysisName} onChangeText={setAnalysisName} placeholder="Property name" placeholderTextColor="#7f8d7a" />
            <Text style={styles.meta}>Analysis mode: {analysisModeLabel(analysisMode)}</Text>
            <View style={styles.row}>
              {ANALYSIS_MODE_OPTIONS.map((option) => (
                <ActionButton
                  key={option.value}
                  label={option.label}
                  onPress={() => setAnalysisMode(option.value)}
                  primary={analysisMode === option.value}
                />
              ))}
            </View>
            <Text style={[styles.meta, isValid ? styles.success : styles.error]}>
              {polygon ? `${acreage.toLocaleString()} acres` : "Tap the terrain canvas to add polygon points."}
            </Text>
            {renderMapControls()}
            {renderMap()}
            <View style={styles.row}>
              <ActionButton label="Analyze Terrain" onPress={submit} primary disabled={!polygon || !isValid} />
              <ActionButton label="Sample Polygon" onPress={() => setPoints(samplePoints())} />
            </View>
            <View style={styles.row}>
              <ActionButton label="Clear" onPress={() => setPoints([])} />
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

        {screen === "processing" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Processing</Text>
            <Text style={styles.meta}>HTIE is generating features, relationships, waypoints, and a deterministic report.</Text>
          </View>
        )}

        {screen === "results" && analysis && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Results</Text>
            <Text style={styles.meta}>Saved analysis: {analysis.analysisJobId || "not persisted"}</Text>
            <Text style={styles.meta}>Mode: {analysisModeLabel(analysis.analysisMode)}</Text>
            {renderMapControls()}
            {renderMap()}
            <Text style={styles.metric}>Approximate acreage: {Number(analysis.summary?.approximateAcreage || acreage).toLocaleString()} acres</Text>
            <Text style={styles.metric}>Features: {analysis.features.length}</Text>
            <Text style={styles.metric}>Waypoints: {analysis.waypoints.length}</Text>
            <View style={styles.row}>
              <ActionButton label="Open Report" onPress={() => setScreen("report")} primary />
              <ActionButton label="Back to Setup" onPress={() => setScreen("setup")} />
            </View>
            <Text style={styles.sectionSubtitle}>Waypoint Detail</Text>
            {waypointCards.map((waypoint) => (
              <Pressable
                key={waypoint.id}
                style={styles.item}
                onPress={() => {
                  setSelectedWaypoint(waypoint);
                  setScreen("waypoint");
                }}
              >
                <Text style={styles.itemTitle}>{waypoint.title}</Text>
                <Text style={styles.meta}>{waypoint.waypointType}</Text>
                <Text style={styles.meta}>Score {waypoint.score.toFixed(1)}</Text>
              </Pressable>
            ))}
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
  error: {
    color: "#d68375",
  },
  success: {
    color: "#8ab182",
  },
});
