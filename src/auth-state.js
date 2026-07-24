export function tokenExpiresAt(token, decode = globalThis.atob) {
  try {
    const segment = String(token || "").split(".")[1];
    if (!segment || typeof decode !== "function") return null;
    const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(decode(padded));
    return Number.isFinite(Number(payload.exp)) ? Number(payload.exp) * 1000 : null;
  } catch {
    return null;
  }
}

export function sessionStateForToken(token, now = Date.now(), decode = globalThis.atob) {
  if (!token) return { status: "unauthenticated", reason: "missing" };
  const expiresAt = tokenExpiresAt(token, decode);
  if (expiresAt === null) return { status: "unauthenticated", reason: "invalid" };
  if (expiresAt <= now) return { status: "unauthenticated", reason: "expired" };
  return { status: "authenticated", expiresAt };
}
