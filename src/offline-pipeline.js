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

export function renderOfflineMapHtml(manifest) {
  const plan = manifest.map?.tilePlan; const tiles = (plan?.tiles || []).filter((tile) => tile.z === plan.maxZoom).map((tile) => ({ ...tile, asset: offlineTile(manifest, plan.provider.id, tile.z, tile.x, tile.y) })).filter((tile) => tile.asset);
  const xs = [...new Set(tiles.map((tile) => tile.x))].sort((a,b) => a-b); const ys = [...new Set(tiles.map((tile) => tile.y))].sort((a,b) => a-b);
  const images = tiles.map((tile) => `<img alt="" src="${tile.asset.dataUrl}" style="position:absolute;left:${xs.indexOf(tile.x)*256}px;top:${ys.indexOf(tile.y)*256}px;width:256px;height:256px"/>`).join("");
  const zoom = Number(plan?.maxZoom || 0); const originX = Number(xs[0] || 0) * 256; const originY = Number(ys[0] || 0) * 256;
  const boundary = manifest.immutable?.analysis?.requestPolygon || manifest.map?.region;
  const ring = boundary?.type === "Polygon" && Array.isArray(boundary.coordinates?.[0]) ? boundary.coordinates[0] : [];
  const project = ([longitude, latitude]) => { const size = 2 ** zoom * 256; const clamped = Math.max(-85.0511, Math.min(85.0511, Number(latitude))); const sin = Math.sin(clamped * Math.PI / 180); return [((Number(longitude) + 180) / 360) * size - originX, (.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size - originY]; };
  const boundaryPath = ring.map(project).map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const width = Math.max(1, xs.length) * 256; const height = Math.max(1, ys.length) * 256;
  const boundaryOverlay = boundaryPath ? `<svg id="analysis-boundary" aria-label="Immutable analysis boundary" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><path d="${boundaryPath} Z"/></svg>` : "";
  return `<!doctype html><meta name="viewport" content="width=device-width"><style>html,body{margin:0;background:#101510;color:#fff;font:12px sans-serif}#map{position:relative;width:${width}px;height:${height}px;transform-origin:0 0}#analysis-boundary{position:absolute;inset:0;z-index:2;pointer-events:none;overflow:visible}#analysis-boundary path{fill:rgba(208,166,93,.18);stroke:#f0d293;stroke-width:4;vector-effect:non-scaling-stroke}.current-location{display:none;position:absolute;width:16px;height:16px;margin:-8px 0 0 -8px;border:3px solid #fff;border-radius:50%;background:#4f9cff;box-shadow:0 2px 8px #000;z-index:3}.attribution{position:fixed;right:4px;bottom:4px;background:#000b;padding:4px;z-index:4}</style><div id="map">${images}${boundaryOverlay}<div id="current-location" class="current-location"></div></div><div class="attribution">${plan?.provider?.attribution || "Offline map"}</div><script>(function(){var zoom=${zoom},originX=${originX},originY=${originY},marker=document.getElementById('current-location');function point(location){var size=Math.pow(2,zoom)*256,longitude=Number(location.longitude),latitude=Math.max(-85.0511,Math.min(85.0511,Number(location.latitude))),sin=Math.sin(latitude*Math.PI/180);return{x:(longitude+180)/360*size-originX,y:(.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*size-originY}}window.__terrainUpdateLocation=function(location){if(!location||!Number.isFinite(Number(location.longitude))||!Number.isFinite(Number(location.latitude)))return false;var p=point(location);marker.style.display='block';marker.style.left=p.x+'px';marker.style.top=p.y+'px';return p};window.__terrainCenterLocation=function(location){var p=window.__terrainUpdateLocation(location);if(!p)return false;window.scrollTo({left:Math.max(0,p.x-window.innerWidth/2),top:Math.max(0,p.y-window.innerHeight/2),behavior:'smooth'});return true};window.__terrainClearLocation=function(){marker.style.display='none'};window.__terrainSelect=function(){return true};})();</script>`;
}
