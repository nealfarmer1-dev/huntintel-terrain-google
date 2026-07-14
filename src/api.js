import { accessToken } from "./auth";

const baseUrl = (process.env.EXPO_PUBLIC_TERRAIN_API_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");

async function request(path, options = {}) {
  const token = await accessToken();
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Terrain API request failed.");
  }

  return payload;
}

export function accountRequest(path, body, method = "POST") { return request(`/api/account${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body) }); }
export function fetchAccount() { return request("/api/account/session"); }

export function createAnalysis(input) {
  return request("/api/terrain/analyses", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchAnalysis(analysisJobId) {
  return request(`/api/terrain/analyses/${encodeURIComponent(analysisJobId)}`);
}

export { baseUrl as terrainApiBaseUrl };
