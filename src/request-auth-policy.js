const UNAUTHENTICATED_ACCOUNT_PATHS = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/resend-verification",
]);

export function requestRequiresAuthentication(path) {
  const accountPrefix = "/api/account";
  if (!String(path).startsWith(accountPrefix)) return true;
  return !UNAUTHENTICATED_ACCOUNT_PATHS.has(String(path).slice(accountPrefix.length));
}

export function isInvalidSessionResponse({ requiresAuthentication, status, code }) {
  return code === "ACCOUNT_ACCESS_REVOKED" || (requiresAuthentication && Number(status) === 401);
}

export async function invalidateSessionIfRequired({
  requiresAuthentication,
  status,
  code,
  error,
  clearSession,
  onSessionExpired,
}) {
  if (!isInvalidSessionResponse({ requiresAuthentication, status, code })) return false;
  await clearSession();
  if (typeof onSessionExpired === "function") onSessionExpired(error);
  return true;
}

export function requestErrorMessage({ path, status, serverMessage, sessionInvalid }) {
  if (sessionInvalid) return "Your session has expired. Please sign in again.";
  if (typeof serverMessage === "string" && serverMessage.trim()) return serverMessage;
  if (path === "/api/account/login" && Number(status) === 401) return "Email or password is incorrect.";
  return "HuntIntel Terrain could not complete that request.";
}
