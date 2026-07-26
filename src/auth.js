import * as SecureStore from "expo-secure-store";
import { sessionStateForToken } from "./auth-state";
export { tokenExpiresAt } from "./auth-state";
export const ACCESS_TOKEN_KEY = "huntintel.terrain.accessToken";

export async function accessToken() { return SecureStore.getItemAsync(ACCESS_TOKEN_KEY); }

export async function storeSession(payload) {
  const access = payload?.token;
  if (!access || typeof access !== "string") throw new Error("Sign-in did not return a valid session.");
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access);
}

export async function clearSession(storage = SecureStore) { await storage.deleteItemAsync(ACCESS_TOKEN_KEY); }

export async function restoreSession(storage = SecureStore, now = Date.now()) {
  const token = await storage.getItemAsync(ACCESS_TOKEN_KEY);
  const state = sessionStateForToken(token, now);
  if (state.status !== "authenticated") {
    await storage.deleteItemAsync(ACCESS_TOKEN_KEY);
    return { ...state, token: null };
  }
  return { ...state, token };
}
