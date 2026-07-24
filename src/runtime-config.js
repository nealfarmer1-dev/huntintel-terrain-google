export const PRODUCTION_TERRAIN_API_BASE_URL =
  "https://huntintel-terrain-api-epfaeccebkhhcwc0.centralus-01.azurewebsites.net";

export function resolveTerrainApiBaseUrl(env = {}, production = false) {
  const value = String(env.EXPO_PUBLIC_TERRAIN_API_BASE_URL || "").trim().replace(/\/+$/, "");
  if (!value) throw new Error("EXPO_PUBLIC_TERRAIN_API_BASE_URL is required.");
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error("EXPO_PUBLIC_TERRAIN_API_BASE_URL must be a valid URL."); }
  if (production && (parsed.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(parsed.hostname))) {
    throw new Error("Production Terrain builds require an HTTPS API URL and cannot use localhost.");
  }
  if (production && value !== PRODUCTION_TERRAIN_API_BASE_URL) {
    throw new Error("Production Terrain builds must use the canonical Terrain API URL.");
  }
  return value;
}
