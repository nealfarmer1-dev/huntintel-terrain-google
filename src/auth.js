import * as SecureStore from "expo-secure-store";
const ACCESS_TOKEN_KEY = "huntintel.terrain.accessToken";
export async function accessToken() { return SecureStore.getItemAsync(ACCESS_TOKEN_KEY); }
export async function storeSession(payload) {
  const access = payload?.token;
  if (access) await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access);
}
export async function clearSession() { await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY); }
