import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { gcm } from "@noble/ciphers/aes";

const INDEX_KEY = "terrain.offline.index.v1"; const KEY = "terrain.offline.encryption.v1"; const ROOT = `${FileSystem.documentDirectory}offline/`;
const to64 = (bytes) => globalThis.btoa(String.fromCharCode(...bytes)); const from64 = (value) => Uint8Array.from(globalThis.atob(value), (item) => item.charCodeAt(0));
async function encryptionKey() { let value = await SecureStore.getItemAsync(KEY); if (!value) { value = to64(await Crypto.getRandomBytesAsync(32)); await SecureStore.setItemAsync(KEY, value); } return from64(value); }
async function index() { return JSON.parse((await SecureStore.getItemAsync(INDEX_KEY)) || "{}"); }
async function writeIndex(value) { await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(value)); }
/** @param {any} manifest @param {(progress: number) => void} [onProgress] */
export async function saveOfflinePackage(manifest, onProgress = () => {}) { onProgress(10); await FileSystem.makeDirectoryAsync(ROOT, { intermediates: true }); const iv = await Crypto.getRandomBytesAsync(12); const encrypted = gcm(await encryptionKey(), iv).encrypt(new TextEncoder().encode(JSON.stringify(manifest))); onProgress(80); await FileSystem.writeAsStringAsync(`${ROOT}${manifest.analysisJobId}.json`, JSON.stringify({ iv: to64(iv), ciphertext: to64(encrypted) })); const values = await index(); values[manifest.analysisJobId] = { analysisJobId: manifest.analysisJobId, packageVersion: manifest.packageVersion, estimatedSizeBytes: manifest.estimatedSizeBytes, progress: 100, pending: [], cursor: 0, updatedAt: new Date().toISOString() }; await writeIndex(values); onProgress(100); return values[manifest.analysisJobId]; }
export async function loadOfflinePackage(id) { const metadata = (await index())[id]; if (!metadata) return null; const value = JSON.parse(await FileSystem.readAsStringAsync(`${ROOT}${id}.json`)); const plaintext = gcm(await encryptionKey(), from64(value.iv)).decrypt(from64(value.ciphertext)); return { ...metadata, manifest: JSON.parse(new TextDecoder().decode(plaintext)) }; }
export async function listOfflinePackages() { return Object.values(await index()); }
export async function removeOfflinePackage(id) { const values = await index(); delete values[id]; await writeIndex(values); await FileSystem.deleteAsync(`${ROOT}${id}.json`, { idempotent: true }); }
export async function queueOfflineOperation(id, type, payload) { const values = await index(); if (!values[id]) throw new Error("Download this analysis before editing offline."); values[id].pending.push({ idempotencyKey: Crypto.randomUUID(), type, payload, queuedAt: new Date().toISOString() }); await writeIndex(values); return values[id].pending.length; }
export async function synchronizeOfflinePackage(id, push, pull) { const values = await index(); const value = values[id]; if (!value) return null; if (value.pending.length) await push(value.pending); value.pending = []; const changes = await pull(value.cursor); value.cursor = changes.cursor; value.lastSyncAt = new Date().toISOString(); await writeIndex(values); return value; }
