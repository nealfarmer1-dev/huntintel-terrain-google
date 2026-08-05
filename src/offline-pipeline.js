import { relationshipsToGeoJson } from "./terrain-map.js";

export function packageAssets(manifest) {
  const tiles = manifest.map?.tilePlan?.tiles || [];
  const attachments = manifest.userRecords?.attachments || [];
  return [
    ...tiles.map((item) => ({ kind: "tile", key: item.key, url: item.url, contentType: "image/svg+xml", tile: item })),
    ...attachments.map((item) => ({ kind: "attachment", key: `attachment/${item.id}`, url: item.downloadUrl, contentType: item.contentType || "application/octet-stream" })),
  ];
}

export async function downloadPackageAssets(manifest, { fetchAsset, checkpoint = async () => {}, onProgress = () => {}, signal, retries = 2 } = {}) {
  const assets = packageAssets(manifest); const cachedAssets = { ...(manifest.cachedAssets || {}) };
  let completedBytes = Object.values(cachedAssets).reduce((sum, item) => sum + Number(item.sizeBytes || 0), 0);
  const totalBytes = Math.max(Number(manifest.estimatedSizeBytes || 0), completedBytes);
  for (const asset of assets) {
    if (cachedAssets[asset.key]) continue;
    if (signal?.aborted) { const error = new Error("Offline download canceled."); error.name = "AbortError"; throw error; }
    let downloaded; let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try { downloaded = await fetchAsset(asset, signal); break; } catch (error) { lastError = error; if (signal?.aborted || attempt === retries) throw error; }
    }
    if (!downloaded) throw lastError || new Error("Offline asset download failed.");
    cachedAssets[asset.key] = { ...downloaded, kind: asset.kind, tile: asset.tile || null };
    completedBytes += Number(downloaded.sizeBytes || 0);
    if (manifest.maxPackageBytes && completedBytes > manifest.maxPackageBytes) throw new Error("Offline package exceeds the configured size limit.");
    const partial = { ...manifest, cachedAssets, downloadState: { status: "downloading", completedAssets: Object.keys(cachedAssets).length, totalAssets: assets.length, completedBytes, totalBytes } };
    await checkpoint(partial); onProgress(partial.downloadState);
  }
  const complete = { ...manifest, cachedAssets, downloadState: { status: "ready", completedAssets: assets.length, totalAssets: assets.length, completedBytes, totalBytes, completedAt: new Date().toISOString() } };
  await checkpoint(complete); onProgress(complete.downloadState); return complete;
}

export function offlineTile(manifest, providerId, z, x, y) { return manifest.cachedAssets?.[`${providerId}/${z}/${x}/${y}`] || null; }
export function removePackageMetadata(records, analysisJobId) { const next = { ...records }; delete next[analysisJobId]; return next; }

export class OfflineMapModelError extends TypeError {
  constructor(code) {
    super(code);
    this.name = "OfflineMapModelError";
    this.code = code;
    this.mapBuildStage = "offline_input_validation";
  }
}

function requiredObject(value, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new OfflineMapModelError(code);
  return value;
}

function optionalArray(value, code) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new OfflineMapModelError(code);
  return value;
}

function validatedOfflineMapModel(manifest, layerPreferences) {
  const model = requiredObject(manifest, "OFFLINE_MAP_MODEL_REQUIRED");
  if (typeof model.analysisJobId !== "string" || !model.analysisJobId.trim()) throw new OfflineMapModelError("OFFLINE_MAP_ANALYSIS_ID_REQUIRED");
  const map = requiredObject(model.map, "OFFLINE_MAP_MAP_REQUIRED");
  const plan = requiredObject(map.tilePlan, "OFFLINE_MAP_TILE_PLAN_REQUIRED");
  const provider = requiredObject(plan.provider, "OFFLINE_MAP_PROVIDER_REQUIRED");
  if (typeof provider.id !== "string" || !provider.id.trim()) throw new OfflineMapModelError("OFFLINE_MAP_PROVIDER_ID_REQUIRED");
  if (typeof plan.maxZoom !== "number" || !Number.isFinite(plan.maxZoom)) throw new OfflineMapModelError("OFFLINE_MAP_MAX_ZOOM_REQUIRED");
  const tiles = optionalArray(plan.tiles, "OFFLINE_MAP_TILES_INVALID");
  if (tiles.some((tile) => !tile || typeof tile !== "object" || Array.isArray(tile) || !Number.isFinite(tile.z) || !Number.isFinite(tile.x) || !Number.isFinite(tile.y))) {
    throw new OfflineMapModelError("OFFLINE_MAP_TILE_INVALID");
  }
  const immutable = model.immutable == null ? {} : requiredObject(model.immutable, "OFFLINE_MAP_IMMUTABLE_INVALID");
  const features = optionalArray(immutable.features, "OFFLINE_MAP_FEATURES_INVALID");
  const relationships = optionalArray(immutable.relationships, "OFFLINE_MAP_RELATIONSHIPS_INVALID");
  const waypoints = optionalArray(immutable.waypoints, "OFFLINE_MAP_WAYPOINTS_INVALID");
  const preferences = layerPreferences == null ? {} : requiredObject(layerPreferences, "OFFLINE_MAP_LAYER_PREFERENCES_INVALID");
  return { model, map, plan, provider, tiles, immutable, features, relationships, waypoints, preferences };
}

export function renderOfflineMapHtml(manifest, layerPreferences = {}) {
  const validated = validatedOfflineMapModel(manifest, layerPreferences);
  const { model, map, plan, provider, immutable, features, relationships, waypoints, preferences } = validated;
  const tiles = validated.tiles.filter((tile) => tile.z === plan.maxZoom).map((tile) => ({ ...tile, asset: offlineTile(model, provider.id, tile.z, tile.x, tile.y) })).filter((tile) => tile.asset);
  const xs = [...new Set(tiles.map((tile) => tile.x))].sort((a,b) => a-b); const ys = [...new Set(tiles.map((tile) => tile.y))].sort((a,b) => a-b);
  const images = tiles.map((tile) => `<img alt="" src="${tile.asset.dataUrl}" style="position:absolute;left:${xs.indexOf(tile.x)*256}px;top:${ys.indexOf(tile.y)*256}px;width:256px;height:256px"/>`).join("");
  const zoom = plan.maxZoom; const originX = Number(xs[0] || 0) * 256; const originY = Number(ys[0] || 0) * 256;
  const boundary = immutable.analysis?.requestPolygon || map.region;
  const ring = boundary?.type === "Polygon" && Array.isArray(boundary.coordinates?.[0]) ? boundary.coordinates[0] : [];
  const project = ([longitude, latitude]) => { const size = 2 ** zoom * 256; const clamped = Math.max(-85.0511, Math.min(85.0511, Number(latitude))); const sin = Math.sin(clamped * Math.PI / 180); return [((Number(longitude) + 180) / 360) * size - originX, (.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size - originY]; };
  const boundaryPath = ring.map(project).map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const width = Math.max(1, xs.length) * 256; const height = Math.max(1, ys.length) * 256;
  const boundaryOverlay = boundaryPath ? `<svg id="analysis-boundary" aria-label="Immutable analysis boundary" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><path d="${boundaryPath} Z"/></svg>` : "";
  const safeEntityId = (value) => String(value || "").replace(/["'<>&]/g, "");
  const validCoordinate = (coordinate) => Array.isArray(coordinate) && Number.isFinite(Number(coordinate[0])) && Number.isFinite(Number(coordinate[1]));
  const projectedPath = (coordinates, close = false) => (Array.isArray(coordinates) ? coordinates : []).filter(validCoordinate).map(project).map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ") + (close ? " Z" : "");
  const pointShape = (coordinate, className, entityId) => { if (!validCoordinate(coordinate)) return ""; const [x, y] = project(coordinate); return `<circle class="${className}" data-id="${entityId}" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="6"/>`; };
  const featureShapes = preferences.analysis?.features === false ? "" : features.flatMap((feature) => {
    const geometry = feature?.geometry, entityId = safeEntityId(feature?.id); if (!geometry) return [];
    if (geometry.type === "Point") return [pointShape(geometry.coordinates, "feature-point", entityId)];
    if (geometry.type === "MultiPoint") return (geometry.coordinates || []).map((coordinate) => pointShape(coordinate, "feature-point", entityId));
    if (geometry.type === "LineString") return [`<path class="feature-line" data-id="${entityId}" d="${projectedPath(geometry.coordinates)}"/>`];
    if (geometry.type === "MultiLineString") return (geometry.coordinates || []).map((line) => `<path class="feature-line" data-id="${entityId}" d="${projectedPath(line)}"/>`);
    if (geometry.type === "Polygon") return [`<path class="feature-polygon" data-id="${entityId}" fill-rule="evenodd" d="${(geometry.coordinates || []).map((value) => projectedPath(value, true)).join(" ")}"/>`];
    if (geometry.type === "MultiPolygon") return (geometry.coordinates || []).map((polygon) => `<path class="feature-polygon" data-id="${entityId}" fill-rule="evenodd" d="${(polygon || []).map((value) => projectedPath(value, true)).join(" ")}"/>`);
    return [];
  }).filter((shape) => shape && !shape.includes('d=""')).join("");
  const featureOverlay = featureShapes ? `<svg id="analysis-features" aria-label="Downloaded terrain features" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${featureShapes}</svg>` : "";
  const relationshipFeatures = relationshipsToGeoJson(relationships, features).features;
  const relationshipPaths = preferences.analysis?.relationships === false ? "" : relationshipFeatures.flatMap((feature) => {
    const geometry = feature.geometry;
    const lines = geometry?.type === "LineString" ? [geometry.coordinates] : geometry?.type === "MultiLineString" ? geometry.coordinates : [];
    return lines.map((line) => line.map(project).map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" "));
  }).filter(Boolean).map((path) => `<path d="${path}"/>`).join("");
  const relationshipOverlay = relationshipPaths ? `<svg id="analysis-relationships" aria-label="Terrain relationship lines" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${relationshipPaths}</svg>` : "";
  const waypointShapes = preferences.analysis?.waypoints === false ? "" : waypoints.flatMap((waypoint) => {
    const coordinates = [];
    const collect = (value) => { if (validCoordinate(value)) { coordinates.push(value); return; } if (Array.isArray(value)) value.forEach(collect); };
    collect(waypoint?.geometry?.coordinates);
    return coordinates.map((coordinate) => { const [x, y] = project(coordinate); return `<g class="waypoint-marker" data-id="${safeEntityId(waypoint?.id)}" transform="translate(${x.toFixed(2)} ${y.toFixed(2)})"><circle r="8"/><path d="M-4 0H4M0-4V4"/></g>`; });
  }).join("");
  const waypointOverlay = waypointShapes ? `<svg id="analysis-waypoints" aria-label="Downloaded analysis waypoints" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${waypointShapes}</svg>` : "";
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>
html,body{margin:0;background:#101510;color:#fff;font:12px sans-serif}#map{position:relative;width:${width}px;height:${height}px;transform-origin:0 0}#analysis-boundary,#analysis-features,#analysis-relationships,#analysis-waypoints,#field-breadcrumbs{position:absolute;inset:0;pointer-events:none;overflow:visible}#analysis-boundary{z-index:2}#analysis-boundary path{fill:rgba(208,166,93,.18);stroke:#f0d293;stroke-width:4;vector-effect:non-scaling-stroke}#analysis-features{z-index:3}#analysis-features .feature-polygon{fill:rgba(208,166,93,.24);stroke:#e6c27a;stroke-width:3;vector-effect:non-scaling-stroke}#analysis-features .feature-line{fill:none;stroke:#e6c27a;stroke-width:4;vector-effect:non-scaling-stroke}#analysis-features .feature-point{fill:#d0a65d;stroke:#10140f;stroke-width:2;vector-effect:non-scaling-stroke}#analysis-relationships{z-index:4}#analysis-relationships path{fill:none;stroke:rgba(173,209,255,.82);stroke-width:3;stroke-dasharray:8 6;vector-effect:non-scaling-stroke}#analysis-waypoints{z-index:5}#analysis-waypoints circle{fill:#89b37f;stroke:#e6c27a;stroke-width:2;vector-effect:non-scaling-stroke}#analysis-waypoints path{fill:none;stroke:#10140f;stroke-width:2;vector-effect:non-scaling-stroke}#analysis-features .selected,#analysis-waypoints .selected{stroke:#fff;stroke-width:7;filter:drop-shadow(0 0 4px #fff2a8)}#field-breadcrumbs{z-index:5;width:${width}px;height:${height}px}.current-location{display:none;position:absolute;width:16px;height:16px;margin:-8px 0 0 -8px;border:3px solid #fff;border-radius:50%;background:#4f9cff;box-shadow:0 2px 8px #000;z-index:7}.sar-position,.sar-assignment{position:absolute;transform:translate(-50%,-50%);z-index:6;border:2px solid #fff;box-shadow:0 2px 8px #000}.sar-position{min-width:18px;min-height:18px;border-radius:50%;background:#ffbd45}.sar-position.self{background:#4f9cff}.sar-position.stale{opacity:.48}.sar-position span{position:absolute;top:19px;left:50%;transform:translateX(-50%);padding:2px 4px;border-radius:4px;background:#101510dd;color:#fff;font-weight:700;white-space:nowrap}.sar-assignment{width:22px;height:22px;border-radius:5px;background:#f28779;color:#19140d;font-weight:900}.attribution{position:fixed;right:4px;bottom:4px;background:#000b;padding:4px;z-index:8}</style></head><body><div id="map">${images}${boundaryOverlay}${featureOverlay}${relationshipOverlay}${waypointOverlay}<svg id="field-breadcrumbs" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"></svg><div id="sar-team-positions"></div><div id="sar-assignments"></div><div id="current-location" class="current-location"></div></div><div class="attribution">${provider.attribution || "Offline map"}</div><script>(function(){
var zoom=${zoom},originX=${originX},originY=${originY},marker=document.getElementById('current-location'),crumbs=document.getElementById('field-breadcrumbs'),sarPositions=document.getElementById('sar-team-positions'),sarAssignments=document.getElementById('sar-assignments');crumbs.style.display=${layerPreferences.field?.breadcrumbs===false?"'none'":"'block'"};sarPositions.style.display=${layerPreferences.team?.team_positions===false?"'none'":"'block'"};
function post(type,payload){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:type,payload:payload}))}function point(location){var size=Math.pow(2,zoom)*256,longitude=Number(location.longitude),latitude=Math.max(-85.0511,Math.min(85.0511,Number(location.latitude))),sin=Math.sin(latitude*Math.PI/180);return{x:(longitude+180)/360*size-originX,y:(.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*size-originY}}function clear(node){while(node.firstChild)node.removeChild(node.firstChild)}
window.__terrainUpdateLocation=function(location){if(!location||!Number.isFinite(Number(location.longitude))||!Number.isFinite(Number(location.latitude)))return false;var p=point(location);marker.style.display='block';marker.style.left=p.x+'px';marker.style.top=p.y+'px';return p};window.__terrainCenterLocation=function(location){var p=window.__terrainUpdateLocation(location);if(!p)return false;window.scrollTo({left:Math.max(0,p.x-window.innerWidth/2),top:Math.max(0,p.y-window.innerHeight/2),behavior:'smooth'});return true};window.__terrainClearLocation=function(){marker.style.display='none'};
window.__terrainSetBreadcrumbs=function(data){clear(crumbs);(data&&data.features||[]).forEach(function(feature){var lines=feature.geometry&&feature.geometry.type==='MultiLineString'?feature.geometry.coordinates:[feature.geometry&&feature.geometry.coordinates||[]];lines.forEach(function(line){if(line.length<2)return;var d=line.map(function(coordinate,index){var p=point({longitude:coordinate[0],latitude:coordinate[1]});return(index?'L ':'M ')+p.x+' '+p.y}).join(' '),path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',d);path.setAttribute('fill','none');path.setAttribute('stroke','#ffbd45');path.setAttribute('stroke-width','4');path.setAttribute('vector-effect','non-scaling-stroke');crumbs.appendChild(path)})})};
window.__terrainSetSarPositions=function(data,visible){clear(sarPositions);sarPositions.style.display=visible===false?'none':'block';(data&&data.features||[]).forEach(function(feature){var coordinates=feature.geometry&&feature.geometry.coordinates,properties=feature.properties||{};if(!coordinates)return;var p=point({longitude:coordinates[0],latitude:coordinates[1]}),node=document.createElement('div'),label=document.createElement('span');node.className='sar-position'+(properties.isCurrentUser?' self':'')+(properties.state==='current'?'':' stale');node.style.left=p.x+'px';node.style.top=p.y+'px';node.setAttribute('aria-label',(properties.label||'Team member')+', '+(properties.state||'current')+', accuracy '+Math.round(Number(properties.accuracyMeters||0))+' meters');label.textContent=properties.label||'Team member';node.appendChild(label);sarPositions.appendChild(node)});return true};
window.__terrainSetSarAssignments=function(data){clear(sarAssignments);(data&&data.features||[]).forEach(function(feature){var coordinates=feature.geometry&&feature.geometry.coordinates,properties=feature.properties||{};if(!coordinates)return;var p=point({longitude:coordinates[0],latitude:coordinates[1]}),node=document.createElement('div');node.className='sar-assignment';node.style.left=p.x+'px';node.style.top=p.y+'px';node.textContent='A';node.setAttribute('aria-label',properties.title||'SAR assignment');sarAssignments.appendChild(node)});return true};
window.__terrainResize=function(){return true};window.__terrainSetCamera=function(camera){if(!camera)return false;window.scrollTo(Number(camera.scrollX||0),Number(camera.scrollY||0));return true};window.__terrainSelect=function(command){var selectors=command&&command.type==='waypoint'?'#analysis-waypoints [data-id]':'#analysis-features [data-id]';document.querySelectorAll('#analysis-waypoints .selected,#analysis-features .selected').forEach(function(node){node.classList.remove('selected')});if(!command||!command.id)return true;document.querySelectorAll(selectors).forEach(function(node){if(node.getAttribute('data-id')===String(command.id))node.classList.add('selected')});return true};var scrollTimer=null;window.addEventListener('scroll',function(){clearTimeout(scrollTimer);scrollTimer=setTimeout(function(){post('map-camera',{center:[0,0],zoom:zoom,bearing:0,pitch:0,scrollX:window.scrollX,scrollY:window.scrollY,offline:true})},80)});setTimeout(function(){post('map-ready',{})},0)})();</script></body></html>`;
}
