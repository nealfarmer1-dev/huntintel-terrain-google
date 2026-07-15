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
  return `<!doctype html><meta name="viewport" content="width=device-width"><style>html,body{margin:0;background:#101510;color:#fff;font:12px sans-serif}#map{position:relative;width:${Math.max(1,xs.length)*256}px;height:${Math.max(1,ys.length)*256}px;transform-origin:0 0}.attribution{position:fixed;right:4px;bottom:4px;background:#000b;padding:4px;z-index:2}</style><div id="map">${images}</div><div class="attribution">${plan?.provider?.attribution || "Offline map"}</div>`;
}
