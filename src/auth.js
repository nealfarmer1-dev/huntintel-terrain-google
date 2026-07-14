import * as SecureStore from "expo-secure-store";
const ACCESS_TOKEN_KEY = "huntintel.terrain.accessToken";
const REFRESH_TOKEN_KEY = "huntintel.terrain.refreshToken";
export async function accessToken() { return SecureStore.getItemAsync(ACCESS_TOKEN_KEY); }
export async function storeSession(payload) {
  const access = payload?.accessToken || payload?.tokens?.accessToken;
  const refresh = payload?.refreshToken || payload?.tokens?.refreshToken;
  if (access) await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access);
  if (refresh) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh);
}
export async function clearSession() { await Promise.all([SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY), SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY)]); }
