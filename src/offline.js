import * as FileSystem from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { gcm } from "@noble/ciphers/aes";
import { downloadPackageAssets, removePackageMetadata } from "./offline-pipeline";

const INDEX_KEY = "terrain.offline.index.v1";
const KEY = "terrain.offline.encryption.v1";
const ROOT = `${FileSystem.documentDirectory}offline/`;
const to64 = (bytes) => {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return globalThis.btoa(binary);
};
const from64 = (value) => Uint8Array.from(globalThis.atob(value), (item) => item.charCodeAt(0));
async function encryptionKey() {
  let value = await SecureStore.getItemAsync(KEY);
  if (!value) { value = to64(await Crypto.getRandomBytesAsync(32)); await SecureStore.setItemAsync(KEY, value); }
  return from64(value);
}
async function index() { return JSON.parse((await SecureStore.getItemAsync(INDEX_KEY)) || "{}"); }
async function writeIndex(value) { await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(value)); }

/** @param {any} manifest @param {(progress: number) => void} [onProgress] */
export async function saveOfflinePackage(manifest, onProgress = () => {}) {
  onProgress(10); await FileSystem.makeDirectoryAsync(ROOT, { intermediates: true });
  const iv = await Crypto.getRandomBytesAsync(12);
  const encrypted = gcm(await encryptionKey(), iv).encrypt(new TextEncoder().encode(JSON.stringify(manifest)));
  onProgress(80);
  await FileSystem.writeAsStringAsync(`${ROOT}${manifest.analysisJobId}.json`, JSON.stringify({ iv: to64(iv), ciphertext: to64(encrypted) }));
  const values = await index(); const previous = values[manifest.analysisJobId];
  values[manifest.analysisJobId] = {
    analysisJobId: manifest.analysisJobId, packageVersion: manifest.packageVersion, estimatedSizeBytes: manifest.estimatedSizeBytes,
    progress: manifest.downloadState?.status === "ready" ? 100 : Math.floor(((manifest.downloadState?.completedAssets || 0) / Math.max(1, manifest.downloadState?.totalAssets || 1)) * 100),
    pending: previous?.pending || [], cursor: previous?.cursor || 0, updatedAt: new Date().toISOString(), downloadState: manifest.downloadState,
  };
  await writeIndex(values); onProgress(values[manifest.analysisJobId].progress); return values[manifest.analysisJobId];
}
export async function downloadAndSaveOfflinePackage(manifest, { apiBaseUrl, signal, onProgress } = {}) {
  const previous = await loadOfflinePackage(manifest.analysisJobId).catch(() => null);
  if (previous?.manifest?.cachedAssets) manifest.cachedAssets = previous.manifest.cachedAssets;
  return downloadPackageAssets(manifest, {
    signal, onProgress, checkpoint: (partial) => saveOfflinePackage(partial),
    fetchAsset: async (asset, nextSignal) => {
      const url = new URL(asset.url, `${apiBaseUrl}/`).href; const tempUri = `${ROOT}asset-${encodeURIComponent(asset.key)}.part`;
      const task = FileSystem.createDownloadResumable(url, tempUri, { sessionType: FileSystem.FileSystemSessionType.BACKGROUND });
      const cancel = () => task.pauseAsync().catch(() => {}); nextSignal?.addEventListener("abort", cancel, { once: true });
      try { const result = await task.downloadAsync(); if (!result || nextSignal?.aborted) { const error = new Error("Offline download canceled."); error.name = "AbortError"; throw error; } const info = await FileSystem.getInfoAsync(result.uri); const encoded = await FileSystem.readAsStringAsync(result.uri, { encoding: FileSystem.EncodingType.Base64 }); const contentType = result.headers?.["Content-Type"] || result.headers?.["content-type"] || asset.contentType; return { dataUrl: `data:${contentType};base64,${encoded}`, sizeBytes: info.exists && "size" in info ? info.size : 0, contentType }; }
      finally { nextSignal?.removeEventListener("abort", cancel); await FileSystem.deleteAsync(tempUri, { idempotent: true }); }
    },
  });
}
export async function loadOfflinePackage(id) {
  const metadata = (await index())[id]; if (!metadata) return null;
  const value = JSON.parse(await FileSystem.readAsStringAsync(`${ROOT}${id}.json`));
  const plaintext = gcm(await encryptionKey(), from64(value.iv)).decrypt(from64(value.ciphertext));
  return { ...metadata, manifest: JSON.parse(new TextDecoder().decode(plaintext)) };
}
export async function listOfflinePackages() { return Object.values(await index()); }
export async function removeOfflinePackage(id) { await writeIndex(removePackageMetadata(await index(), id)); await FileSystem.deleteAsync(`${ROOT}${id}.json`, { idempotent: true }); }
export async function queueOfflineOperation(id, type, payload) { const values = await index(); if (!values[id]) throw new Error("Download this analysis before editing offline."); values[id].pending.push({ idempotencyKey: Crypto.randomUUID(), type, payload, queuedAt: new Date().toISOString() }); await writeIndex(values); return values[id].pending.length; }
export async function synchronizeOfflinePackage(id, push, pull) { const values = await index(); const value = values[id]; if (!value) return null; try { if (value.pending.length) await push(value.pending); value.pending = []; const changes = await pull(value.cursor); value.cursor = changes.cursor; value.lastSyncAt = new Date().toISOString(); await writeIndex(values); return value; } catch(error) { if(["ANALYSIS_NOT_FOUND","ACCOUNT_ACCESS_REVOKED"].includes(error?.code)){await removeOfflinePackage(id);error.accessRevoked=true;} throw error; } }
